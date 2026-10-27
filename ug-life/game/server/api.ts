// Ug Life API. Runs on Netlify Functions (netlify/functions/api.mts, Postgres + Blobs)
// or on Cloudflare Pages Functions (functions/api/[[path]].ts, D1).
// The game never depends on it to be playable: if this is down or over its free
// limit, phones keep playing and sync later.

import { validateSave, type ServerFacts } from "../src/game/validate";
import { ALL_PLOTS as PLOTS, areaById as mapArea, findPlace } from "../src/world/map";
import { KIOSK_LEASE_DAYS } from "../src/game/economy";
import { YARD_ITEMS } from "../src/content/catalog";
import { checkDisplayName, checkFreeText } from "../src/game/moderation";
import { AREAS, SNAPS_PER_DAY } from "../src/game/snaps";
import { balanceOf } from "../src/game/ledger";
import { levelForXp } from "../src/game/economy";
import { kampalaDateKey } from "../src/game/time";
import { TALK_MAX, VOICE_MAX_MS, emoteById, phraseById } from "../src/content/talk";
import { BILLBOARD_COLORS, BILLBOARD_MAX_DAYS, BILLBOARD_SUB, BILLBOARD_TEXT, slotById } from "../src/content/billboards";
import { EVENT_MAX_REWARD, PROPOSALS_PER_DAY, PROPOSAL_BODY, PROPOSAL_HIDE_REPORTS, PROPOSAL_TITLE } from "../src/content/community";
import { LAND_AREAS, LAND_LEVELS, MAX_LAND, areaById, hotArea, landPrice } from "../src/content/land";
import type { PlayerState } from "../src/game/state";
import type { PhotoStore } from "./photostore";
import type { Db } from "./db";
import type { PaymentProvider } from "./payments";
import { CRYPTO_PACKS, CRYPTO_WINDOW_MS, DEFAULT_USD_UGX, TOPUP_DAILY_LIMIT, TOPUP_PACKS, cryptoCredit } from "../src/content/topup";
import { isTronAddress, type ChainWatcher } from "./crypto";
import { CANDIDATE_MIN_LEVEL, DMS_PER_DAY, DM_MAX, FRIENDS_MAX, SLOGAN_MAX, lastWeekKey, weekKey } from "../src/content/social";

export interface Env {
  db: Db;
  photos: PhotoStore;
  adminToken?: string;
  /** Mobile money top-ups; absent = top-ups are off. */
  payments?: PaymentProvider;
  /** Reads the blockchain for crypto top-ups; absent = crypto is off. */
  chain?: ChainWatcher;
}

type Handler = (req: Request, env: Env, params: string[], ctx: Ctx) => Promise<Response>;
interface Ctx {
  url: URL;
  now: number;
  photos: PhotoStore;
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
const fail = (status: number, error: string) => json({ error }, status);

const MAX_SAVE_BYTES = 200_000;
const MAX_PHOTO_BYTES = 700_000;

// ---------- helpers ----------

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
}

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${randomToken(6)}`;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

interface PlayerRow {
  start?: string;
  area?: string;
  last_seen?: number;
  id: string;
  frozen: number;
  /** Only loaded by auth(…, true). */
  save_json?: string | null;
  save_version: number;
  name: string;
  referred_by: string | null;
}

/**
 * Who is calling. Most calls don't need the save (up to 200 KB), so only `withSave`
 * reads it: a crowd polling every few seconds then costs the database very little.
 */
async function auth(req: Request, env: Env, withSave = false): Promise<PlayerRow | null> {
  const t = bearer(req);
  if (!t || t.length < 20 || t.length > 64) return null;
  const cols = withSave ? "save_json, " : "";
  return env.db.prepare(`SELECT id, frozen, ${cols}save_version, name, referred_by, start, area, last_seen FROM players WHERE token_hash = ?`).bind(await sha256(t)).first<PlayerRow>();
}

function isAdmin(req: Request, env: Env) {
  const t = bearer(req);
  return !!env.adminToken && env.adminToken.length >= 24 && !!t && timingSafeEqual(t, env.adminToken);
}

// Settings change rarely and are read on most calls, so each server keeps them for a few seconds.
const configCache = new WeakMap<Db, { at: number; c: Record<string, string> }>();
const CONFIG_TTL = 5_000;

async function config(env: Env): Promise<Record<string, string>> {
  const hit = configCache.get(env.db);
  if (hit && Date.now() - hit.at < CONFIG_TTL) return hit.c;
  const { results } = await env.db.prepare("SELECT key, value FROM config").all<{ key: string; value: string }>();
  const c = Object.fromEntries(results.map((r) => [r.key, r.value]));
  configCache.set(env.db, { at: Date.now(), c });
  return c;
}

function cryptoOn(env: Env, c: Record<string, string>) {
  return !!env.chain && c.crypto_enabled === "true" && isTronAddress(c.crypto_address ?? "");
}

function usdRate(c: Record<string, string>) {
  const r = Number(c.usd_ugx);
  return Number.isFinite(r) && r >= 1_000 && r <= 10_000 ? Math.round(r) : DEFAULT_USD_UGX;
}

/** Per-player daily counters. Returns false when the limit is used up. */
async function take(env: Env, who: string, bucket: string, limit: number, now: number): Promise<boolean> {
  const day = kampalaDateKey(now);
  const row = await env.db.prepare(
    "INSERT INTO rate_limits (player_id, bucket, day, count) VALUES (?, ?, ?, 1) ON CONFLICT (player_id, bucket, day) DO UPDATE SET count = rate_limits.count + 1 RETURNING count",
  ).bind(who, bucket, day).first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

async function ipKey(req: Request) {
  return "ip:" + (await sha256((req.headers.get("cf-connecting-ip") ?? req.headers.get("x-nf-client-connection-ip") ?? "local") + ":ug")).slice(0, 16);
}

async function flag(env: Env, playerId: string, kind: string, detail: string, now: number) {
  await env.db.prepare("INSERT INTO flags (id, player_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)").bind(id("f"), playerId, kind, detail.slice(0, 1000), now).run();
}

// ---------- player routes ----------

const getConfig: Handler = async (_req, env) => {
  const c = await config(env);
  return json(
    { maintenance: c.maintenance_mode === "true", uploads: c.uploads_enabled !== "false", signups: c.signups_enabled !== "false", announcement: c.announcement ?? "", topups: !!env.payments && c.topups_enabled === "true", crypto: cryptoOn(env, c), usdUgx: usdRate(c) },
    200,
    { "cache-control": "public, max-age=30" },
  );
};

const createSession: Handler = async (req, env, _p, { now }) => {
  const c = await config(env);
  if (c.signups_enabled === "false" || c.maintenance_mode === "true") return fail(503, "Sign-ups are paused for a moment. You can keep playing.");
  if (!(await take(env, await ipKey(req), "signup", 30, now))) return fail(429, "Too many new accounts from this connection today.");
  const body = (await req.json().catch(() => null)) as { ref?: string } | null;
  const token = randomToken();
  const playerId = id("p");
  // like Lagos Life: some lives start rich, most start from scratch
  const start = crypto.getRandomValues(new Uint8Array(1))[0] < 51 ? "nepo" : "hustler";
  const ref = typeof body?.ref === "string" && /^p_[a-z0-9]{6,40}$/.test(body.ref) ? body.ref : null;
  const referrer = ref ? await env.db.prepare("SELECT id FROM players WHERE id = ?").bind(ref).first<{ id: string }>() : null;
  await env.db.prepare("INSERT INTO players (id, token_hash, created_at, last_seen, referred_by, start) VALUES (?, ?, ?, ?, ?, ?)").bind(playerId, await sha256(token), now, now, referrer?.id ?? null, start).run();
  if (referrer) await env.db.prepare("INSERT INTO referrals (referred_id, referrer_id, created_at) VALUES (?, ?, ?)").bind(playerId, referrer.id, now).run();
  return json({ playerId, token, referred: !!referrer, start });
};

const restoreSession: Handler = async (req, env) => {
  const me = await auth(req, env, true);
  if (!me) return fail(404, "That code doesn't match any player. Check it and try again.");
  return json({ playerId: me.id, version: me.save_version, save: me.save_json ? JSON.parse(me.save_json) : null });
};

const putSave: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env, true);
  if (!me) return fail(401, "Not signed in.");
  const c = await config(env);
  if (c.maintenance_mode === "true") return fail(503, "Saving is paused for maintenance. Your progress is safe on your phone.");
  if (me.frozen) return fail(423, "This account is under review. Contact support from the Help panel.");
  const text = await req.text();
  if (text.length > MAX_SAVE_BYTES) return fail(413, "Save is too large.");
  let body: { save: PlayerState; baseVersion: number };
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "Bad save.");
  }
  if (body.baseVersion !== me.save_version) {
    return json({ error: "Another phone saved newer progress.", version: me.save_version, save: me.save_json ? JSON.parse(me.save_json) : null }, 409);
  }
  const prev = me.save_json ? (JSON.parse(me.save_json) as PlayerState) : null;
  const next = body.save;
  const facts = await serverFacts(env, me);
  const verdict = validateSave(prev, next, now, facts);
  if (!verdict.ok) {
    await flag(env, me.id, "save_refused", verdict.errors.join("; "), now);
    return json({ error: "This save breaks the game rules, so it wasn't kept.", details: verdict.errors, version: me.save_version, save: prev }, 422);
  }
  if (verdict.warnings.length) await flag(env, me.id, "unusual", verdict.warnings.join("; "), now);
  const name = checkDisplayName(next.tag?.name ?? "");
  const status = checkFreeText(next.tag?.status ?? "", 60);
  const tag = {
    name: name.ok ? name.value : "Resident",
    status: status.ok ? status.value : "",
    socials: (next.tag?.socials ?? []).slice(0, 3).map((s) => ({ platform: s.platform, handle: String(s.handle).slice(0, 40), verified: false })),
  };
  const version = me.save_version + 1;
  await env.db.prepare(
    `UPDATE players SET save_json = ?, save_version = ?, name = ?, tag_json = ?, look_json = ?, level = ?, balance = ?, pos_x = ?, pos_y = ?,
     kiosk_json = ?, ghost = ?, last_seen = ? WHERE id = ?`,
  ).bind(
    JSON.stringify(next), version, tag.name, JSON.stringify(tag), JSON.stringify(next.look ?? {}), levelForXp(next.xp ?? 0), balanceOf(next.ledger),
    Number(next.pos?.x) || 3.5, Number(next.pos?.y) || 11.5, next.kiosk ? JSON.stringify({ name: next.kiosk.name, color: next.kiosk.color }) : null,
    next.tag?.ghost ? 1 : 0, now, me.id,
  ).run();
  await afterSave(env, me, next, now);
  return json({ ok: true, version });
};

async function serverFacts(env: Env, me: PlayerRow): Promise<ServerFacts> {
  const claims = await env.db.prepare("SELECT plot_id, day FROM plot_claims WHERE player_id = ?").bind(me.id).all<{ plot_id: string; day: string }>();
  const refs = await env.db.prepare("SELECT referred_id FROM referrals WHERE referrer_id = ? AND qualified = 1").bind(me.id).all<{ referred_id: string }>();
  const land = await env.db.prepare("SELECT area, slot, price FROM land WHERE player_id = ?").bind(me.id).all<{ area: string; slot: number; price: number }>();
  const boards = await env.db.prepare("SELECT slot, day, price FROM billboards WHERE owner_id = ? AND kind = 'player'").bind(me.id).all<{ slot: string; day: string; price: number }>();
  const attended = await env.db.prepare("SELECT a.event_id AS id, e.reward FROM event_attendance a JOIN live_events e ON e.id = a.event_id WHERE a.player_id = ?").bind(me.id).all<{ id: string; reward: number }>();
  const topups = await env.db.prepare("SELECT ref, credit FROM topups WHERE player_id = ? AND status = 'paid'").bind(me.id).all<{ ref: string; credit: number }>();
  return {
    start: me.start ?? "",
    topups: new Map(topups.results.map((t) => [t.ref, t.credit])),
    eventRewards: new Map(attended.results.map((a) => [a.id, a.reward])),
    billboardClaims: new Map(boards.results.map((b) => [`${b.slot}:${b.day}`, b.price])),
    landClaims: new Map(land.results.map((l) => [`${l.area}:${l.slot}`, l.price])),
    plotClaims: new Set(claims.results.map((c) => `${c.plot_id}:${c.day}`)),
    referrals: new Set(refs.results.map((r) => r.referred_id)),
    referred: !!me.referred_by,
  };
}

/** Keeps shared things in step with an accepted save: the kiosk everyone sees, referrals, unpaid claims. */
async function afterSave(env: Env, me: PlayerRow, next: PlayerState, now: number) {
  const k = next.kiosk;
  if (k) {
    const yard = (next.yard ?? []).map((i) => (YARD_ITEMS.some((y) => y.id === i) ? i : null)).slice(0, 5);
    const kiosk = { name: String(k.name).slice(0, 24), color: k.color, product: k.product, upgrades: k.upgrades, yard };
    await env.db.prepare("UPDATE plots SET kiosk_json = ?, owner_name = ?, updated_at = ? WHERE plot_id = ? AND player_id = ?")
      .bind(JSON.stringify(kiosk), next.tag?.name ?? "", now, k.plotId, me.id).run();
  }
  // a friend who joined through a link counts once they've done real work
  if (me.referred_by && next.ledger.entries.some((e) => e.key.startsWith("job:") || e.key.startsWith("ride:"))) {
    await env.db.prepare("UPDATE referrals SET qualified = 1 WHERE referred_id = ? AND qualified = 0").bind(me.id).run();
  }
  // land: mark paid plots and their building level; unpaid ones go back after 10 minutes
  const myLand = await env.db.prepare("SELECT area, slot, paid, level, bought_at FROM land WHERE player_id = ?").bind(me.id).all<{ area: string; slot: number; paid: number; level: number; bought_at: number }>();
  for (const l of myLand.results) {
    const bought = next.ledger.entries.some((e) => e.key === `land:${l.area}:${l.slot}`);
    const owned = (next.land ?? []).find((x) => x.area === l.area && x.slot === l.slot);
    if (bought && owned) {
      const level = Math.max(0, Math.min(LAND_LEVELS.length - 1, Number(owned.level) || 0));
      if (!l.paid || level !== l.level) await env.db.prepare("UPDATE land SET paid = 1, level = ?, owner_name = ? WHERE area = ? AND slot = ?").bind(level, next.tag?.name ?? "", l.area, l.slot).run();
    } else if (!bought && now - l.bought_at > 10 * 60_000) {
      await env.db.prepare("DELETE FROM land WHERE area = ? AND slot = ? AND player_id = ?").bind(l.area, l.slot, me.id).run();
    }
  }
  // billboards: a rental counts once its payment is in a save
  const unpaid = await env.db.prepare("SELECT slot, day FROM billboards WHERE owner_id = ? AND kind = 'player' AND paid = 0").bind(me.id).all<{ slot: string; day: string }>();
  for (const u of unpaid.results) {
    if (next.ledger.entries.some((e) => e.key === `billboard:${u.slot}:${u.day}`)) await env.db.prepare("UPDATE billboards SET paid = 1 WHERE slot = ? AND kind = 'player'").bind(u.slot).run();
  }
  // a plot claimed but never paid for (10 minutes grace) goes back on the market
  const claims = await env.db.prepare("SELECT plot_id, day, created_at FROM plot_claims WHERE player_id = ? AND created_at < ?").bind(me.id, now - 10 * 60_000).all<{ plot_id: string; day: string; created_at: number }>();
  for (const c of claims.results) {
    const paid = next.ledger.entries.some((e) => e.key === `lease:${c.plot_id}:${c.day}` || e.key === `renew:${c.plot_id}:${c.day}`);
    if (paid) continue;
    const held = await env.db.prepare("SELECT plot_id FROM plots WHERE plot_id = ? AND player_id = ? AND leased_until > ?").bind(c.plot_id, me.id, now).first();
    await env.db.prepare("UPDATE plots SET leased_until = 0 WHERE plot_id = ? AND player_id = ?").bind(c.plot_id, me.id).run();
    await env.db.prepare("DELETE FROM plot_claims WHERE player_id = ? AND plot_id = ? AND day = ?").bind(me.id, c.plot_id, c.day).run();
    if (held) await flag(env, me.id, "unpaid_lease", `Claimed ${c.plot_id} on ${c.day} but never paid; released`, now);
  }
}

// ---------- shared kiosk plots ----------

const listPlots: Handler = async (_req, env, _p, { now }) => {
  const { results } = await env.db.prepare("SELECT plot_id, player_id, owner_name, kiosk_json, leased_until FROM plots WHERE leased_until > ?").bind(now)
    .all<{ plot_id: string; player_id: string; owner_name: string; kiosk_json: string | null; leased_until: number }>();
  return json({ plots: results.map((r) => ({ plotId: r.plot_id, playerId: r.player_id, owner: r.owner_name, kiosk: r.kiosk_json ? JSON.parse(r.kiosk_json) : null, leasedUntil: r.leased_until })) },
    200, { "cache-control": "public, max-age=10" });
};

/** Claims a free plot (or extends your own). The player then pays the lease in their save. */
const claimPlot: Handler = async (req, env, [plotId], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const plot = PLOTS.find((p) => p.id === plotId);
  if (!plot || plot.npcOwner) return fail(404, "That plot isn't for lease.");
  const bal = await env.db.prepare("SELECT balance FROM players WHERE id = ?").bind(me.id).first<{ balance: number }>();
  if ((bal?.balance ?? 0) < 25_000) return fail(402, "You need UGX 25,000 saved to lease a kiosk.");
  const other = await env.db.prepare("SELECT plot_id FROM plots WHERE player_id = ? AND leased_until > ? AND plot_id != ?").bind(me.id, now, plotId).first();
  if (other) return fail(409, "You already lease a kiosk. One per player.");
  const week = KIOSK_LEASE_DAYS * 24 * 3600_000;
  const existing = await env.db.prepare("SELECT player_id, owner_name, leased_until FROM plots WHERE plot_id = ?").bind(plotId).first<{ player_id: string; owner_name: string; leased_until: number }>();
  const mine = existing?.player_id === me.id && existing.leased_until > now;
  const until = mine ? existing.leased_until + week : now + week;
  // atomic: only take the plot if it's free, expired, or already ours
  const row = await env.db.prepare(
    `INSERT INTO plots (plot_id, player_id, owner_name, leased_until, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (plot_id) DO UPDATE SET player_id = excluded.player_id, owner_name = excluded.owner_name, leased_until = excluded.leased_until, updated_at = excluded.updated_at,
       kiosk_json = CASE WHEN plots.player_id = excluded.player_id THEN plots.kiosk_json ELSE NULL END
     WHERE plots.leased_until < ? OR plots.player_id = ?
     RETURNING player_id, leased_until`,
  ).bind(plotId, me.id, me.name, until, now, now, me.id).first<{ player_id: string; leased_until: number }>();
  if (!row || row.player_id !== me.id) return fail(409, `${existing?.owner_name || "Another player"} already leases this kiosk. Try another plot.`);
  const day = kampalaDateKey(now);
  await env.db.prepare("INSERT INTO plot_claims (player_id, plot_id, day, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (player_id, plot_id, day) DO NOTHING").bind(me.id, plotId, day, now).run();
  return json({ ok: true, plotId, day, leasedUntil: row.leased_until, renewed: mine });
};

// ---------- community: proposals, votes, news, events ----------

const community: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  const open = await env.db.prepare("SELECT id, player_id, name, title, body, votes, status, note, created_at FROM proposals WHERE status = 'open' ORDER BY votes DESC, created_at DESC LIMIT 30").all<Record<string, unknown>>();
  const done = await env.db.prepare("SELECT id, player_id, name, title, body, votes, status, note, created_at FROM proposals WHERE status = 'done' ORDER BY created_at DESC LIMIT 5").all<Record<string, unknown>>();
  const mine = me ? new Set((await env.db.prepare("SELECT proposal_id FROM votes WHERE player_id = ?").bind(me.id).all<{ proposal_id: string }>()).results.map((v) => v.proposal_id)) : new Set<string>();
  const news = await env.db.prepare("SELECT id, title, body, created_at FROM news ORDER BY created_at DESC LIMIT 10").all<{ id: string; title: string; body: string; created_at: number }>();
  const events = await env.db.prepare("SELECT * FROM live_events WHERE ends_at > ? ORDER BY starts_at ASC LIMIT 10").bind(now).all<{ id: string; title: string; body: string; place: string; starts_at: number; ends_at: number; reward: number }>();
  const went = me ? new Set((await env.db.prepare("SELECT event_id FROM event_attendance WHERE player_id = ?").bind(me.id).all<{ event_id: string }>()).results.map((a) => a.event_id)) : new Set<string>();
  const prop = (r: Record<string, unknown>) => ({ id: r.id, playerId: r.player_id, name: r.name, title: r.title, body: r.body, votes: r.votes, status: r.status, note: r.note, at: r.created_at, mine: mine.has(String(r.id)) });
  return json({
    now,
    proposals: open.results.map(prop),
    done: done.results.map(prop),
    news: news.results.map((n) => ({ id: n.id, title: n.title, body: n.body, at: n.created_at })),
    events: events.results.map((e) => ({ id: e.id, title: e.title, body: e.body, place: e.place, startsAt: e.starts_at, endsAt: e.ends_at, reward: e.reward, attended: went.has(e.id) })),
  });
};

const createProposal: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  if (!me.name) return fail(400, "Make your Ug Tag first, so people know whose idea it is.");
  const b = (await req.json().catch(() => null)) as { title?: string; body?: string } | null;
  const title = checkFreeText(String(b?.title ?? ""), PROPOSAL_TITLE);
  if (!title.ok) return fail(400, title.reason);
  if (title.value.length < 6) return fail(400, "Say what you want in a few words, e.g. “Street lights on the side road”.");
  const body = checkFreeText(String(b?.body ?? ""), PROPOSAL_BODY);
  if (!body.ok) return fail(400, body.reason);
  if (!(await take(env, me.id, "proposal", PROPOSALS_PER_DAY, now))) return fail(429, `That's ${PROPOSALS_PER_DAY} ideas today. Get people voting on them!`);
  const pid = id("pr");
  await env.db.prepare("INSERT INTO proposals (id, player_id, name, title, body, votes, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)").bind(pid, me.id, me.name, title.value, body.value, now).run();
  await env.db.prepare("INSERT INTO votes (proposal_id, player_id, created_at) VALUES (?, ?, ?)").bind(pid, me.id, now).run();
  return json({ id: pid });
};

const voteProposal: Handler = async (req, env, [pid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const p = await env.db.prepare("SELECT status FROM proposals WHERE id = ?").bind(pid).first<{ status: string }>();
  if (!p || p.status !== "open") return fail(404, "That idea is closed.");
  const row = await env.db.prepare("INSERT INTO votes (proposal_id, player_id, created_at) VALUES (?, ?, ?) ON CONFLICT (proposal_id, player_id) DO NOTHING RETURNING proposal_id").bind(pid, me.id, now).first();
  if (!row) return fail(409, "You already voted for this.");
  const n = (await env.db.prepare("SELECT COUNT(*) AS n FROM votes WHERE proposal_id = ?").bind(pid).first<{ n: number }>())?.n ?? 1;
  await env.db.prepare("UPDATE proposals SET votes = ? WHERE id = ?").bind(n, pid).run();
  return json({ ok: true, votes: n });
};

const reportProposal: Handler = async (req, env, [pid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  if (!(await take(env, me.id, "report", 20, now))) return fail(429, "Too many reports today.");
  const p = await env.db.prepare("SELECT title, name, player_id FROM proposals WHERE id = ?").bind(pid).first<{ title: string; name: string; player_id: string }>();
  if (!p) return fail(404, "Gone.");
  const fresh = await env.db.prepare("INSERT INTO talk_reports (talk_id, reporter_id, created_at) VALUES (?, ?, ?) ON CONFLICT (talk_id, reporter_id) DO NOTHING RETURNING talk_id").bind(pid, me.id, now).first();
  if (fresh) {
    const n = (await env.db.prepare("SELECT COUNT(*) AS n FROM talk_reports WHERE talk_id = ?").bind(pid).first<{ n: number }>())?.n ?? 1;
    await env.db.prepare("UPDATE proposals SET reports = ?, status = CASE WHEN ? >= ? THEN 'hidden' ELSE status END WHERE id = ?").bind(n, n, PROPOSAL_HIDE_REPORTS, pid).run();
    await env.db.prepare("INSERT INTO reports (id, reporter_id, target, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(id("r"), me.id, `proposal:${pid}:${p.player_id}`, `Idea by ${p.name}: ${p.title}`, now).run();
  }
  return json({ ok: true });
};

/** You're at a live event: the server notes it once and you get the reward. */
const attendEvent: Handler = async (req, env, [eid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const e = await env.db.prepare("SELECT starts_at, ends_at, reward, place FROM live_events WHERE id = ?").bind(eid).first<{ starts_at: number; ends_at: number; reward: number; place: string }>();
  if (!e) return fail(404, "No such event.");
  if (now < e.starts_at) return fail(409, "It hasn't started yet. Come back when it starts.");
  if (now > e.ends_at) return fail(409, "You missed this one. Watch What's new for the next.");
  // you must actually be there: your last position on the street, sent by the game
  const pos = await env.db.prepare("SELECT pos_x, pos_y, area FROM players WHERE id = ?").bind(me.id).first<{ pos_x: number; pos_y: number; area: string }>();
  const found = findPlace(e.place);
  if (found && pos && (pos.area !== found.area.id || Math.hypot(pos.pos_x - found.place.x, pos.pos_y - found.place.y) > 4)) return fail(409, `Go to ${found.place.name} in ${found.area.name} to join.`);
  const row = await env.db.prepare("INSERT INTO event_attendance (event_id, player_id, created_at) VALUES (?, ?, ?) ON CONFLICT (event_id, player_id) DO NOTHING RETURNING event_id").bind(eid, me.id, now).first();
  return json({ ok: true, reward: e.reward, already: !row });
};

const adminNews: Handler = async (req, env, [nid], { now }) => {
  if (req.method === "DELETE") {
    await env.db.prepare("DELETE FROM news WHERE id = ?").bind(nid).run();
    return json({ ok: true });
  }
  const b = (await req.json().catch(() => null)) as { title?: string; body?: string } | null;
  const title = String(b?.title ?? "").trim().slice(0, 80);
  if (!title) return fail(400, "title is required");
  await env.db.prepare("INSERT INTO news (id, title, body, created_at) VALUES (?, ?, ?, ?)").bind(id("n"), title, String(b?.body ?? "").slice(0, 1000), now).run();
  return json({ ok: true });
};

const adminEvent: Handler = async (req, env, [eid], { now }) => {
  if (req.method === "DELETE") {
    await env.db.prepare("DELETE FROM live_events WHERE id = ?").bind(eid).run();
    return json({ ok: true });
  }
  const b = (await req.json().catch(() => null)) as { title?: string; body?: string; place?: string; startsAt?: number; endsAt?: number; reward?: number } | null;
  const title = String(b?.title ?? "").trim().slice(0, 80);
  if (!title || !findPlace(String(b?.place))) return fail(400, "title and a place id are required");
  const startsAt = Number(b?.startsAt) || now;
  const endsAt = Number(b?.endsAt) || startsAt + 3600_000;
  if (endsAt <= startsAt || endsAt - startsAt > 7 * 24 * 3600_000) return fail(400, "an event lasts up to 7 days");
  const reward = Math.max(0, Math.min(EVENT_MAX_REWARD, Math.round(Number(b?.reward) || 0)));
  await env.db.prepare("INSERT INTO live_events (id, title, body, place, starts_at, ends_at, reward, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id("ev"), title, String(b?.body ?? "").slice(0, 500), String(b!.place), startsAt, endsAt, reward, now).run();
  return json({ ok: true });
};

const adminProposal: Handler = async (req, env, [pid]) => {
  const b = (await req.json().catch(() => null)) as { status?: string; note?: string } | null;
  if (!["open", "done", "hidden"].includes(String(b?.status))) return fail(400, "status must be open, done or hidden");
  await env.db.prepare("UPDATE proposals SET status = ?, note = ? WHERE id = ?").bind(b!.status, String(b?.note ?? "").slice(0, 200), pid).run();
  return json({ ok: true });
};

// ---------- friends and private messages ----------

const PID = /^p_[a-z0-9]{6,40}$/;

async function areFriends(env: Env, a: string, b: string) {
  const one = await env.db.prepare("SELECT status FROM friends WHERE player_id = ? AND friend_id = ?").bind(a, b).first<{ status: string }>();
  return one?.status === "friends";
}

/** Ask someone to be friends, or accept their request (same call). */
const addFriend: Handler = async (req, env, [fid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  if (!PID.test(fid) || fid === me.id) return fail(400, "That isn't a player.");
  const other = await env.db.prepare("SELECT name, frozen FROM players WHERE id = ?").bind(fid).first<{ name: string; frozen: number }>();
  if (!other || other.frozen) return fail(404, "That player isn't around.");
  const count = (await env.db.prepare("SELECT COUNT(*) AS n FROM friends WHERE player_id = ?").bind(me.id).first<{ n: number }>())?.n ?? 0;
  if (count >= FRIENDS_MAX) return fail(409, `You have ${FRIENDS_MAX} friends already.`);
  if (!(await take(env, me.id, "friend", 50, now))) return fail(429, "That's a lot of friend requests today.");
  const theirs = await env.db.prepare("SELECT status FROM friends WHERE player_id = ? AND friend_id = ?").bind(fid, me.id).first<{ status: string }>();
  if (theirs) {
    // they asked first: accepting makes it mutual
    await env.db.prepare("UPDATE friends SET status = 'friends' WHERE player_id = ? AND friend_id = ?").bind(fid, me.id).run();
    await env.db.prepare("INSERT INTO friends (player_id, friend_id, status, created_at) VALUES (?, ?, 'friends', ?) ON CONFLICT (player_id, friend_id) DO UPDATE SET status = 'friends'").bind(me.id, fid, now).run();
    return json({ ok: true, status: "friends", name: other.name });
  }
  await env.db.prepare("INSERT INTO friends (player_id, friend_id, status, created_at) VALUES (?, ?, 'requested', ?) ON CONFLICT (player_id, friend_id) DO NOTHING").bind(me.id, fid, now).run();
  return json({ ok: true, status: "outgoing", name: other.name });
};

const removeFriend: Handler = async (req, env, [fid]) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  await env.db.prepare("DELETE FROM friends WHERE (player_id = ? AND friend_id = ?) OR (player_id = ? AND friend_id = ?)").bind(me.id, fid, fid, me.id).run();
  return json({ ok: true });
};

const listFriends: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const mine = await env.db.prepare(
    `SELECT f.friend_id AS id, f.status, p.name, p.last_seen, p.area FROM friends f JOIN players p ON p.id = f.friend_id WHERE f.player_id = ?`,
  ).bind(me.id).all<{ id: string; status: string; name: string; last_seen: number; area: string }>();
  const incoming = await env.db.prepare(
    `SELECT f.player_id AS id, p.name, p.last_seen, p.area FROM friends f JOIN players p ON p.id = f.player_id
     WHERE f.friend_id = ? AND f.status = 'requested' AND NOT EXISTS (SELECT 1 FROM friends g WHERE g.player_id = ? AND g.friend_id = f.player_id)`,
  ).bind(me.id, me.id).all<{ id: string; name: string; last_seen: number; area: string }>();
  const unread = await env.db.prepare("SELECT from_id, COUNT(*) AS n FROM dms WHERE to_id = ? AND read = 0 AND hidden = 0 GROUP BY from_id").bind(me.id).all<{ from_id: string; n: number }>();
  const un = new Map(unread.results.map((u) => [u.from_id, u.n]));
  const online = (t: number) => now - t < 5 * 60_000;
  return json({
    friends: [
      ...mine.results.map((f) => ({ id: f.id, name: f.name, status: f.status === "friends" ? "friends" : "outgoing", unread: un.get(f.id) ?? 0, online: online(f.last_seen), area: f.area })),
      ...incoming.results.map((f) => ({ id: f.id, name: f.name, status: "incoming", unread: 0, online: online(f.last_seen), area: f.area })),
    ],
  });
};

const getDms: Handler = async (req, env, [fid], { url }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  if (!(await areFriends(env, me.id, fid))) return fail(403, "You can message friends only.");
  const since = Number(url.searchParams.get("since")) || 0;
  const { results } = await env.db.prepare(
    `SELECT id, from_id, to_id, body, created_at FROM dms WHERE hidden = 0 AND created_at > ? AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) ORDER BY created_at DESC LIMIT 60`,
  ).bind(since, me.id, fid, fid, me.id).all<{ id: string; from_id: string; to_id: string; body: string; created_at: number }>();
  await env.db.prepare("UPDATE dms SET read = 1 WHERE to_id = ? AND from_id = ? AND read = 0").bind(me.id, fid).run();
  return json({ messages: results.reverse().map((m) => ({ id: m.id, from: m.from_id, to: m.to_id, body: m.body, at: m.created_at })) });
};

const sendDm: Handler = async (req, env, [fid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  if (me.frozen) return fail(423, "This account is under review.");
  const c = await config(env);
  if (c.talk_enabled === "false") return fail(503, "Messages are paused for a moment.");
  if (!(await areFriends(env, me.id, fid))) return fail(403, "You can message friends only.");
  const b = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = checkFreeText(String(b?.body ?? ""), DM_MAX);
  if (!text.ok) return fail(400, text.reason);
  if (!text.value) return fail(400, "Write something first.");
  if (!(await take(env, me.id, "dm", DMS_PER_DAY, now))) return fail(429, "That's a lot of messages today. More tomorrow.");
  const mid = id("dm");
  await env.db.prepare("INSERT INTO dms (id, from_id, to_id, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(mid, me.id, fid, text.value, now).run();
  return json({ id: mid, at: now, body: text.value });
};

const reportDm: Handler = async (req, env, [mid], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const m = await env.db.prepare("SELECT from_id, to_id, body FROM dms WHERE id = ?").bind(mid).first<{ from_id: string; to_id: string; body: string }>();
  if (!m || m.to_id !== me.id) return fail(404, "Not found.");
  await env.db.prepare("UPDATE dms SET hidden = 1 WHERE id = ?").bind(mid).run();
  await env.db.prepare("INSERT INTO reports (id, reporter_id, target, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(id("r"), me.id, `dm:${mid}:${m.from_id}`, `Private message: ${m.body}`.slice(0, 500), now).run();
  return json({ ok: true });
};

// ---------- street chairperson elections ----------

async function electionOf(env: Env, area: string, now: number, meId?: string) {
  const week = weekKey(now);
  const tally = async (w: string) => (await env.db.prepare(
    `SELECT c.player_id AS id, c.name, c.slogan, (SELECT COUNT(*) FROM election_votes v WHERE v.week = c.week AND v.area = c.area AND v.candidate_id = c.player_id) AS votes
     FROM candidates c WHERE c.week = ? AND c.area = ? ORDER BY votes DESC, c.created_at ASC LIMIT 20`,
  ).bind(w, area).all<{ id: string; name: string; slogan: string; votes: number }>()).results;
  const candidates = await tally(week);
  const last = (await tally(lastWeekKey(now)))[0];
  const mine = meId ? await env.db.prepare("SELECT candidate_id FROM election_votes WHERE week = ? AND area = ? AND voter_id = ?").bind(week, area, meId).first<{ candidate_id: string }>() : null;
  return { week, area, candidates, myVote: mine?.candidate_id ?? null, chair: last && last.votes > 0 ? { id: last.id, name: last.name, votes: last.votes } : null };
}

const getElection: Handler = async (req, env, _p, { now, url }) => {
  const me = await auth(req, env);
  const area = mapArea(url.searchParams.get("area"))?.id ?? "wandegeya";
  return json(await electionOf(env, area, now, me?.id));
};

const runForChair: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const b = (await req.json().catch(() => null)) as { area?: string; slogan?: string } | null;
  const area = mapArea(b?.area)?.id;
  if (!area) return fail(400, "Pick an area.");
  const lv = (await env.db.prepare("SELECT level FROM players WHERE id = ?").bind(me.id).first<{ level: number }>())?.level ?? 1;
  if (lv < CANDIDATE_MIN_LEVEL) return fail(403, `You need level ${CANDIDATE_MIN_LEVEL} to stand. Work and level up first.`);
  const slogan = checkFreeText(String(b?.slogan ?? ""), SLOGAN_MAX);
  if (!slogan.ok) return fail(400, slogan.reason);
  const week = weekKey(now);
  const other = await env.db.prepare("SELECT area FROM candidates WHERE week = ? AND player_id = ?").bind(week, me.id).first<{ area: string }>();
  if (other && other.area !== area) return fail(409, "You're already standing in another area this week.");
  await env.db.prepare("INSERT INTO candidates (week, area, player_id, name, slogan, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (week, area, player_id) DO UPDATE SET slogan = excluded.slogan")
    .bind(week, area, me.id, me.name, slogan.value, now).run();
  return json(await electionOf(env, area, now, me.id));
};

const voteChair: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const b = (await req.json().catch(() => null)) as { area?: string; candidate?: string } | null;
  const area = mapArea(b?.area)?.id;
  if (!area || !PID.test(String(b?.candidate))) return fail(400, "Pick a candidate.");
  const week = weekKey(now);
  const cand = await env.db.prepare("SELECT player_id FROM candidates WHERE week = ? AND area = ? AND player_id = ?").bind(week, area, b!.candidate).first();
  if (!cand) return fail(404, "That person isn't standing.");
  const row = await env.db.prepare("INSERT INTO election_votes (week, area, voter_id, candidate_id, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (week, area, voter_id) DO NOTHING RETURNING voter_id")
    .bind(week, area, me.id, b!.candidate, now).first();
  if (!row) return fail(409, "You've already voted here this week.");
  return json(await electionOf(env, area, now, me.id));
};

// ---------- billboards ----------

interface BoardRow { slot: string; kind: string; owner_id: string | null; owner_name: string; text: string; sub: string; color: string; link: string | null; until: number; paid: number; created_at: number }

async function activeBoards(env: Env, now: number) {
  // rentals never paid for within 10 minutes are dropped
  await env.db.prepare("DELETE FROM billboards WHERE kind = 'player' AND paid = 0 AND created_at < ?").bind(now - 10 * 60_000).run();
  const { results } = await env.db.prepare("SELECT * FROM billboards WHERE until > ?").bind(now).all<BoardRow>();
  return results;
}

const listBillboards: Handler = async (_req, env, _p, { now }) => {
  const rows = await activeBoards(env, now);
  // a brand booking shows over a player's rental on the same spot
  const ads = new Map<string, BoardRow>();
  for (const r of rows) if (!ads.has(r.slot) || r.kind === "brand") ads.set(r.slot, r);
  return json({
    ads: [...ads.values()].map((r) => ({ slot: r.slot, kind: r.kind, owner: r.owner_name, ownerId: r.owner_id ?? undefined, text: r.text, sub: r.sub, color: r.color, until: r.until, link: r.link ?? undefined })),
  }, 200, { "cache-control": "public, max-age=20" });
};

/** Rents a billboard spot for 1-3 days. The player then pays for it in their save. */
const rentBillboard: Handler = async (req, env, [slotId], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const slot = slotById(slotId);
  if (!slot) return fail(404, "Unknown billboard.");
  const b = (await req.json().catch(() => null)) as { text?: string; sub?: string; color?: string; days?: number } | null;
  const text = checkFreeText(String(b?.text ?? ""), BILLBOARD_TEXT);
  if (!text.ok) return fail(400, text.reason);
  if (text.value.length < 2) return fail(400, "Write what the billboard says.");
  const sub = checkFreeText(String(b?.sub ?? ""), BILLBOARD_SUB);
  if (!sub.ok) return fail(400, sub.reason);
  const color = (BILLBOARD_COLORS as readonly string[]).includes(String(b?.color)) ? String(b!.color) : BILLBOARD_COLORS[0];
  const days = Math.max(1, Math.min(BILLBOARD_MAX_DAYS, Math.floor(Number(b?.days) || 1)));
  const rows = await activeBoards(env, now);
  const brand = rows.find((r) => r.slot === slot.id && r.kind === "brand");
  if (brand) return fail(409, `${brand.owner_name || "A sponsor"} has this billboard booked. Try another one.`);
  const taken = rows.find((r) => r.slot === slot.id && r.kind === "player");
  if (taken && taken.owner_id !== me.id) return fail(409, `${taken.owner_name} has this billboard until ${new Date(taken.until).toLocaleString("en-GB", { timeZone: "Africa/Kampala", weekday: "short", hour: "2-digit", minute: "2-digit" })}.`);
  if (taken) return fail(409, "You already have this billboard. Rent again when it ends.");
  const price = slot.pricePerDay * days;
  const bal = await env.db.prepare("SELECT balance FROM players WHERE id = ?").bind(me.id).first<{ balance: number }>();
  if ((bal?.balance ?? 0) < price) return fail(402, `That costs UGX ${price.toLocaleString()}. Your saved balance is lower.`);
  const day = kampalaDateKey(now);
  const row = await env.db.prepare(
    `INSERT INTO billboards (slot, kind, owner_id, owner_name, text, sub, color, price, day, until, created_at) VALUES (?, 'player', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (slot, kind) DO UPDATE SET owner_id = excluded.owner_id, owner_name = excluded.owner_name, text = excluded.text, sub = excluded.sub, color = excluded.color,
       price = excluded.price, day = excluded.day, until = excluded.until, created_at = excluded.created_at, paid = 0
     WHERE billboards.until < ? RETURNING owner_id`,
  ).bind(slot.id, me.id, me.name, text.value, sub.value, color, price, day, now + days * 24 * 3600_000, now, now).first<{ owner_id: string }>();
  if (!row || row.owner_id !== me.id) return fail(409, "Someone rented it a moment ago. Try another one.");
  return json({ ok: true, slot: slot.id, day, price, until: now + days * 24 * 3600_000 });
};

const adminBillboard: Handler = async (req, env, [slotId], { now }) => {
  const slot = slotById(slotId);
  if (!slot) return fail(404, "Unknown billboard.");
  const b = (await req.json().catch(() => null)) as { brand?: string; text?: string; sub?: string; color?: string; days?: number; link?: string; clear?: boolean } | null;
  if (b?.clear) {
    await env.db.prepare("DELETE FROM billboards WHERE slot = ? AND kind = 'brand'").bind(slot.id).run();
    return json({ ok: true });
  }
  const text = String(b?.text ?? "").trim().slice(0, BILLBOARD_TEXT);
  if (!text) return fail(400, "text is required");
  const link = typeof b?.link === "string" && /^https:\/\/[^\s]{4,200}$/.test(b.link) ? b.link : null;
  const days = Math.max(1, Math.min(90, Math.floor(Number(b?.days) || 7)));
  const color = /^#[0-9a-f]{6}$/i.test(String(b?.color)) ? String(b!.color) : "#13202b";
  await env.db.prepare(
    `INSERT INTO billboards (slot, kind, owner_name, text, sub, color, link, paid, until, created_at) VALUES (?, 'brand', ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT (slot, kind) DO UPDATE SET owner_name = excluded.owner_name, text = excluded.text, sub = excluded.sub, color = excluded.color, link = excluded.link, until = excluded.until, created_at = excluded.created_at`,
  ).bind(slot.id, String(b?.brand ?? "").slice(0, 40), text, String(b?.sub ?? "").slice(0, BILLBOARD_SUB), color, link, now + days * 24 * 3600_000, now).run();
  return json({ ok: true });
};

// ---------- Kampala land ----------

const listLand: Handler = async (_req, env, _p, { now }) => {
  const day = kampalaDateKey(now);
  const { results } = await env.db.prepare("SELECT area, slot, player_id, owner_name, level FROM land").all<{ area: string; slot: number; player_id: string; owner_name: string; level: number }>();
  const areas = LAND_AREAS.map((a) => {
    const rows = results.filter((r) => r.area === a.id);
    return { id: a.id, sold: rows.length, price: landPrice(a.id, rows.length, day), owners: rows.map((r) => ({ slot: r.slot, playerId: r.player_id, name: r.owner_name, level: r.level })) };
  });
  return json({ day, hot: hotArea(day).id, areas }, 200, { "cache-control": "public, max-age=15" });
};

/** Sells you the next free plot in an area at today's price. You then pay for it in your save. */
const claimLand: Handler = async (req, env, [areaId], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const area = areaById(areaId);
  if (!area) return fail(404, "Unknown area.");
  const mine = (await env.db.prepare("SELECT COUNT(*) AS n FROM land WHERE player_id = ?").bind(me.id).first<{ n: number }>())?.n ?? 0;
  if (mine >= MAX_LAND) return fail(409, `You own ${MAX_LAND} plots already. Build them up!`);
  const day = kampalaDateKey(now);
  // plots sold but never paid for within 30 minutes go back on sale
  await env.db.prepare("DELETE FROM land WHERE paid = 0 AND bought_at < ?").bind(now - 30 * 60_000).run();
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = await env.db.prepare("SELECT slot FROM land WHERE area = ?").bind(area.id).all<{ slot: number }>();
    if (taken.results.length >= area.plots) return fail(409, `${area.name} is sold out. Try another area.`);
    const used = new Set(taken.results.map((t) => t.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const price = landPrice(area.id, taken.results.length, day);
    const bal = await env.db.prepare("SELECT balance FROM players WHERE id = ?").bind(me.id).first<{ balance: number }>();
    if ((bal?.balance ?? 0) < price) return fail(402, `A plot in ${area.name} costs UGX ${price.toLocaleString()} today. Your saved balance is lower.`);
    const row = await env.db.prepare("INSERT INTO land (area, slot, player_id, owner_name, price, bought_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (area, slot) DO NOTHING RETURNING slot")
      .bind(area.id, slot, me.id, me.name, price, now).first<{ slot: number }>();
    if (row) return json({ ok: true, area: area.id, slot, price });
  }
  return fail(409, "Someone bought that plot a moment ago. Try again.");
};

// ---------- mobile money top-ups ----------

const startTopUp: Handler = async (req, env, _p, { now, url }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const c = await config(env);
  if (!env.payments || c.topups_enabled !== "true") return fail(503, "Top-ups aren't open yet.");
  const b = (await req.json().catch(() => null)) as { pack?: string } | null;
  const pack = TOPUP_PACKS.find((p) => p.id === b?.pack);
  if (!pack) return fail(400, "Pick a pack.");
  const today = await env.db.prepare("SELECT COALESCE(SUM(price), 0) AS n FROM topups WHERE player_id = ? AND status = 'paid' AND paid_at > ?").bind(me.id, now - 24 * 3600_000).first<{ n: number }>();
  if ((today?.n ?? 0) + pack.price > TOPUP_DAILY_LIMIT) return fail(429, `You can top up at most UGX ${TOPUP_DAILY_LIMIT.toLocaleString()} a day.`);
  const ref = id("tp");
  await env.db.prepare("INSERT INTO topups (ref, player_id, pack, price, credit, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(ref, me.id, pack.id, pack.price, pack.credit, now).run();
  const link = await env.payments.create({ ref, amount: pack.price, playerId: me.id, name: me.name, redirect: `${url.origin}/?topup=${ref}` });
  if (!link) return fail(502, "The payment page didn't open. Try again in a minute.");
  return json({ ref, link });
};

/** After paying, the game asks the server to check with the provider. Credited once. */
const verifyTopUp: Handler = async (req, env, [ref], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const t = await env.db.prepare("SELECT player_id, price, credit, status FROM topups WHERE ref = ?").bind(ref).first<{ player_id: string; price: number; credit: number; status: string }>();
  if (!t || t.player_id !== me.id) return fail(404, "No such top-up.");
  if (t.status === "paid") return json({ ok: true, credit: t.credit });
  if (!env.payments) return fail(503, "Top-ups aren't open.");
  if (!(await env.payments.verify(ref, t.price))) return json({ ok: false, pending: true });
  await env.db.prepare("UPDATE topups SET status = 'paid', paid_at = ? WHERE ref = ? AND status = 'pending'").bind(now, ref).run();
  return json({ ok: true, credit: t.credit });
};

// ---------- crypto top-ups (USDT on TRON) ----------

/** Asks for a deposit: the player gets the address and their own exact amount to send. */
const startCrypto: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  const c = await config(env);
  if (!cryptoOn(env, c)) return fail(503, "Crypto top-ups aren't open yet.");
  const b = (await req.json().catch(() => null)) as { pack?: string } | null;
  const pack = CRYPTO_PACKS.find((p) => p.id === b?.pack);
  if (!pack) return fail(400, "Pick a pack.");
  const { price, credit } = cryptoCredit(pack, usdRate(c));
  const today = await env.db.prepare("SELECT COALESCE(SUM(price), 0) AS n FROM topups WHERE player_id = ? AND status = 'paid' AND paid_at > ?").bind(me.id, now - 24 * 3600_000).first<{ n: number }>();
  if ((today?.n ?? 0) + price > TOPUP_DAILY_LIMIT) return fail(429, `You can top up at most UGX ${TOPUP_DAILY_LIMIT.toLocaleString()} a day.`);
  // One open deposit per player: asking again gives back the same one.
  const open = await env.db.prepare("SELECT ref, pack, crypto_micro, created_at FROM topups WHERE player_id = ? AND method = 'crypto' AND status = 'pending' AND created_at > ? ORDER BY created_at DESC LIMIT 1")
    .bind(me.id, now - CRYPTO_WINDOW_MS).first<{ ref: string; pack: string; crypto_micro: number; created_at: number }>();
  if (open && open.pack === pack.id) return json({ ref: open.ref, address: c.crypto_address, micro: open.crypto_micro, until: open.created_at + CRYPTO_WINDOW_MS, credit });
  if (open) await env.db.prepare("UPDATE topups SET status = 'cancelled' WHERE ref = ?").bind(open.ref).run();
  // A unique amount (4 decimals) tells us whose deposit it is when it lands.
  const base = pack.usd * 1_000_000;
  for (let i = 0; i < 12; i++) {
    const micro = base + (1 + Math.floor(Math.random() * 999)) * 100;
    const taken = await env.db.prepare("SELECT 1 AS x FROM topups WHERE method = 'crypto' AND status = 'pending' AND crypto_micro = ? AND created_at > ?").bind(micro, now - CRYPTO_WINDOW_MS).first();
    if (taken) continue;
    const ref = id("cr");
    await env.db.prepare("INSERT INTO topups (ref, player_id, pack, price, credit, created_at, method, crypto_micro) VALUES (?, ?, ?, ?, ?, ?, 'crypto', ?)")
      .bind(ref, me.id, pack.id, price, credit, now, micro).run();
    return json({ ref, address: c.crypto_address, micro, until: now + CRYPTO_WINDOW_MS, credit });
  }
  return fail(503, "Lots of people are topping up right now. Try again in a minute.");
};

/** Looks on the blockchain for this player's exact amount. Credited once, ever. */
const checkCrypto: Handler = async (req, env, [ref], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const t = await env.db.prepare("SELECT player_id, credit, status, created_at, crypto_micro FROM topups WHERE ref = ? AND method = 'crypto'")
    .bind(ref).first<{ player_id: string; credit: number; status: string; created_at: number; crypto_micro: number }>();
  if (!t || t.player_id !== me.id) return fail(404, "No such top-up.");
  if (t.status === "paid") return json({ ok: true, credit: t.credit });
  if (t.status !== "pending") return json({ ok: false, expired: true });
  const c = await config(env);
  if (!env.chain || !isTronAddress(c.crypto_address ?? "")) return fail(503, "Crypto top-ups are paused.");
  const list = await env.chain.transfersTo(c.crypto_address, t.created_at - 120_000);
  if (!list) return json({ ok: false, pending: true, slow: true });
  for (const tx of list) {
    if (tx.micro !== t.crypto_micro) continue;
    const used = await env.db.prepare("SELECT ref FROM topups WHERE tx_id = ?").bind(tx.txId).first<{ ref: string }>();
    if (used) continue;
    try {
      await env.db.prepare("UPDATE topups SET status = 'paid', paid_at = ?, tx_id = ? WHERE ref = ? AND status = 'pending'").bind(now, tx.txId, ref).run();
    } catch {
      continue; // someone else's top-up took this transaction a moment ago
    }
    const row = await env.db.prepare("SELECT status FROM topups WHERE ref = ?").bind(ref).first<{ status: string }>();
    if (row?.status === "paid") return json({ ok: true, credit: t.credit, tx: tx.txId });
  }
  if (now - t.created_at > CRYPTO_WINDOW_MS) {
    await env.db.prepare("UPDATE topups SET status = 'expired' WHERE ref = ? AND status = 'pending'").bind(ref).run();
    return json({ ok: false, expired: true });
  }
  return json({ ok: false, pending: true });
};

const rewards: Handler = async (req, env) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const { results } = await env.db.prepare(
    "SELECT r.referred_id AS id, p.name AS name FROM referrals r JOIN players p ON p.id = r.referred_id WHERE r.referrer_id = ? AND r.qualified = 1",
  ).bind(me.id).all<{ id: string; name: string }>();
  const topups = await env.db.prepare("SELECT ref, credit FROM topups WHERE player_id = ? AND status = 'paid'").bind(me.id).all<{ ref: string; credit: number }>();
  return json({ referrals: results, referred: !!me.referred_by, topups: topups.results, start: me.start ?? "" });
};

// ---------- street talk ----------

const TALK_WINDOW = 10 * 60_000;
const VOICE_TTL = 24 * 3600_000;
const MAX_VOICE_BYTES = 120_000;

interface TalkRow { id: string; player_id: string; name: string; kind: string; body: string; to_id: string | null; x: number; y: number; created_at: number; title?: string | null }

const talkOut = (r: TalkRow) => ({ id: r.id, playerId: r.player_id, name: r.name, kind: r.kind, body: r.body, to: r.to_id, x: r.x, y: r.y, at: r.created_at, ...(r.title ? { title: r.title } : {}) });

function clampPos(v: unknown, max: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
}

// Who's online per area and each area's chairperson are the same for everyone, so a
// server works them out once every few seconds instead of on every phone's call.
const streetCache = new WeakMap<Db, { at: number; counts: Record<string, number>; chairs: Map<string, { id: string; name: string; votes: number } | null> }>();
const STREET_TTL = 10_000;

async function streetStats(env: Env, now: number) {
  let hit = streetCache.get(env.db);
  if (!hit || Date.now() - hit.at > STREET_TTL) {
    const counts = await env.db.prepare("SELECT area, COUNT(*) AS n FROM players WHERE last_seen > ? AND ghost = 0 AND frozen = 0 AND name != '' GROUP BY area").bind(now - 15 * 60_000).all<{ area: string; n: number }>();
    hit = { at: Date.now(), counts: Object.fromEntries(counts.results.map((c) => [c.area, c.n])), chairs: new Map() };
    streetCache.set(env.db, hit);
  }
  return hit;
}

/**
 * How long phones should wait before asking again. The busier the game, the slower
 * everyone polls, so the same server holds many more players. The Control Room's
 * poll_ms sets a floor (e.g. 60000 on a very busy day).
 */
export function pollFor(online: number, floor: number): number {
  const byLoad = online > 50_000 ? 90_000 : online > 10_000 ? 45_000 : online > 2_000 ? 20_000 : 0;
  return Math.max(byLoad, floor || 0);
}

/** Who is on the street right now and what they said. Also marks you as here. */
const live: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  const body = (await req.json().catch(() => null)) as { x?: number; y?: number; since?: number; area?: string } | null;
  const area = mapArea(body?.area)?.id ?? "wandegeya";
  if (me && !me.frozen && body && typeof body.x === "number" && typeof body.y === "number") {
    await env.db.prepare("UPDATE players SET pos_x = ?, pos_y = ?, area = ?, last_seen = ? WHERE id = ?").bind(clampPos(body.x, 60), clampPos(body.y, 30), area, now, me.id).run();
    if (me.area !== area || !me.last_seen || now - me.last_seen > 15 * 60_000) streetCache.delete(env.db); // someone arrived: recount
  }
  const since = Math.max(Number(body?.since) || 0, now - TALK_WINDOW);
  const players = await env.db.prepare(
    `SELECT id, name, tag_json, look_json, level, pos_x, pos_y, kiosk_json, last_seen FROM players
     WHERE last_seen > ? AND area = ? AND ghost = 0 AND frozen = 0 AND name != '' ORDER BY last_seen DESC LIMIT 20`,
  ).bind(now - 15 * 60_000, area).all<{ id: string; name: string; tag_json: string; look_json: string; level: number; pos_x: number; pos_y: number; kiosk_json: string | null; last_seen: number }>();
  const stats = await streetStats(env, now);
  const talk = await env.db.prepare(
    `SELECT t.id, t.player_id, t.name, t.kind, t.body, t.to_id, t.x, t.y, t.created_at, p.title AS title FROM talk t
     LEFT JOIN proposals p ON t.kind = 'rally' AND p.id = t.body
     WHERE t.created_at > ? AND t.hidden = 0 AND (t.area = ? OR t.to_id IS NOT NULL) ORDER BY t.created_at DESC LIMIT 40`,
  ).bind(since, area).all<TalkRow>();
  let dmUnread = 0, friendRequests = 0;
  if (me) {
    dmUnread = (await env.db.prepare("SELECT COUNT(*) AS n FROM dms WHERE to_id = ? AND read = 0 AND hidden = 0").bind(me.id).first<{ n: number }>())?.n ?? 0;
    friendRequests = (await env.db.prepare("SELECT COUNT(*) AS n FROM friends f WHERE f.friend_id = ? AND f.status = 'requested' AND NOT EXISTS (SELECT 1 FROM friends g WHERE g.player_id = ? AND g.friend_id = f.player_id)").bind(me.id, me.id).first<{ n: number }>())?.n ?? 0;
  }
  if (!stats.chairs.has(area)) stats.chairs.set(area, (await electionOf(env, area, now)).chair);
  const chair = stats.chairs.get(area) ?? null;
  const online = Object.values(stats.counts).reduce((a, b) => a + b, 0);
  return json({
    now,
    next: pollFor(online, Number((await config(env)).poll_ms) || 0),
    dmUnread,
    friendRequests,
    chair,
    players: players.results.map((r) => ({ id: r.id, name: r.name, level: r.level, tag: JSON.parse(r.tag_json), look: JSON.parse(r.look_json), pos: { x: r.pos_x, y: r.pos_y }, kiosk: r.kiosk_json ? JSON.parse(r.kiosk_json) : null, seen: r.last_seen })),
    talk: talk.results.reverse().map(talkOut),
    areas: stats.counts,
  });
};

async function canTalk(env: Env, me: PlayerRow | null, now: number): Promise<Response | null> {
  if (!me) return fail(401, "Make your Ug Tag first.");
  if (me.frozen) return fail(423, "This account is under review.");
  if (!me.name) return fail(400, "Make your Ug Tag first, so people know who's talking.");
  const c = await config(env);
  if (c.maintenance_mode === "true" || c.talk_enabled === "false") return fail(503, "Street talk is paused for a moment.");
  const last = await env.db.prepare("SELECT created_at FROM talk WHERE player_id = ? ORDER BY created_at DESC LIMIT 1").bind(me.id).first<{ created_at: number }>();
  if (last && now - last.created_at < 700) return fail(429, "Slow down a little.");
  return null;
}

const postTalk: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  const blocked = await canTalk(env, me, now);
  if (blocked) return blocked;
  const b = (await req.json().catch(() => null)) as { kind?: string; body?: string; to?: string; x?: number; y?: number; area?: string } | null;
  const kind = b?.kind;
  let text = String(b?.body ?? "");
  if (kind === "phrase") {
    if (!phraseById(text)) return fail(400, "Unknown phrase.");
  } else if (kind === "emote") {
    if (!emoteById(text)) return fail(400, "Unknown emote.");
  } else if (kind === "rally") {
    const p = await env.db.prepare("SELECT status FROM proposals WHERE id = ?").bind(text).first<{ status: string }>();
    if (!p || p.status !== "open") return fail(404, "That idea is closed.");
  } else if (kind === "text") {
    const r = checkFreeText(text, TALK_MAX);
    if (!r.ok) return fail(400, r.reason);
    if (!r.value) return fail(400, "Say something first.");
    text = r.value;
  } else return fail(400, "kind must be phrase, text, emote or rally");
  if (!(await take(env, me!.id, "talk", 500, now))) return fail(429, "That's a lot of talking today. Rest your voice until tomorrow.");
  const to = typeof b?.to === "string" && /^p_[a-z0-9]{6,40}$/.test(b.to) ? b.to : null;
  const talkId = id("k");
  await env.db.prepare("INSERT INTO talk (id, player_id, name, kind, body, to_id, x, y, area, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(talkId, me!.id, me!.name, kind, text, to, clampPos(b?.x, 60), clampPos(b?.y, 30), mapArea(b?.area)?.id ?? "wandegeya", now).run();
  return json({ id: talkId, at: now, body: text });
};

const postVoice: Handler = async (req, env, _p, { now, photos }) => {
  const me = await auth(req, env);
  const blocked = await canTalk(env, me, now);
  if (blocked) return blocked;
  const form = await req.formData();
  const raw = form.get("audio") as unknown;
  const file = raw && typeof raw === "object" && "arrayBuffer" in raw ? (raw as File) : null;
  if (!file) return fail(400, "No recording attached.");
  const mime = file.type.split(";")[0];
  if (!["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac"].includes(mime)) return fail(415, "That recording format isn't supported.");
  if (file.size > MAX_VOICE_BYTES) return fail(413, "Keep it to a few seconds.");
  if (Number(form.get("ms")) > VOICE_MAX_MS + 600) return fail(400, "Keep it to 4 seconds.");
  if (!(await take(env, me!.id, "voice", 30, now))) return fail(429, "That's 30 voice hellos today. More tomorrow.");
  const voiceId = id("vc");
  await photos.put(voiceId, mime, await file.arrayBuffer());
  const talkId = id("k");
  await env.db.prepare("INSERT INTO talk (id, player_id, name, kind, body, to_id, x, y, area, created_at) VALUES (?, ?, ?, 'voice', ?, NULL, ?, ?, ?, ?)")
    .bind(talkId, me!.id, me!.name, voiceId, clampPos(form.get("x"), 60), clampPos(form.get("y"), 30), mapArea(String(form.get("area")))?.id ?? "wandegeya", now).run();
  return json({ id: talkId, at: now, body: voiceId });
};

const serveVoice: Handler = async (_req, env, [voiceId], { now, photos }) => {
  const row = await env.db.prepare("SELECT created_at, hidden FROM talk WHERE kind = 'voice' AND body = ?").bind(voiceId).first<{ created_at: number; hidden: number }>();
  if (!row || row.hidden || now - row.created_at > VOICE_TTL) return fail(404, "That voice hello has gone.");
  const obj = await photos.get(voiceId);
  if (!obj) return fail(404, "Not found.");
  return new Response(obj.data, { headers: { "content-type": obj.mime, "cache-control": "private, max-age=3600" } });
};

/** Two different players reporting a message hides it for everyone; it also goes to the Control Room. */
const reportTalk: Handler = async (req, env, [talkId], { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const row = await env.db.prepare("SELECT id, player_id, name, kind, body FROM talk WHERE id = ?").bind(talkId).first<{ id: string; player_id: string; name: string; kind: string; body: string }>();
  if (!row) return fail(404, "That message is gone.");
  if (!(await take(env, me.id, "report", 20, now))) return fail(429, "Too many reports today.");
  await env.db.prepare("INSERT INTO talk_reports (talk_id, reporter_id, created_at) VALUES (?, ?, ?) ON CONFLICT (talk_id, reporter_id) DO NOTHING").bind(talkId, me.id, now).run();
  const n = (await env.db.prepare("SELECT COUNT(*) AS n FROM talk_reports WHERE talk_id = ?").bind(talkId).first<{ n: number }>())?.n ?? 1;
  await env.db.prepare("UPDATE talk SET reports = ?, hidden = CASE WHEN ? >= 2 THEN 1 ELSE hidden END WHERE id = ?").bind(n, n, talkId).run();
  await env.db.prepare("INSERT INTO reports (id, reporter_id, target, reason, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id("r"), me.id, `talk:${talkId}:${row.player_id}`, `Street talk by ${row.name} (${row.kind}): ${row.kind === "voice" ? "voice hello" : row.body}`.slice(0, 500), now).run();
  return json({ ok: true, hidden: n >= 2 });
};

const leaderboard: Handler = async (_req, env, _p, { now }) => {
  const week = now - 7 * 24 * 3600_000;
  const rich = await env.db.prepare("SELECT id, name, level, balance FROM players WHERE last_seen > ? AND ghost = 0 AND frozen = 0 AND name != '' ORDER BY balance DESC LIMIT 10").bind(week).all();
  const levels = await env.db.prepare("SELECT id, name, level, balance FROM players WHERE last_seen > ? AND ghost = 0 AND frozen = 0 AND name != '' ORDER BY level DESC, balance DESC LIMIT 10").bind(week).all();
  const snappers = await env.db.prepare("SELECT author AS name, COUNT(*) AS n FROM photos WHERE status = 'approved' GROUP BY author ORDER BY n DESC LIMIT 5").all();
  const landlords = await env.db.prepare("SELECT player_id AS id, MAX(owner_name) AS name, COUNT(*) AS plots, SUM(level) AS levels FROM land WHERE paid = 1 GROUP BY player_id ORDER BY plots DESC, levels DESC LIMIT 10").all();
  const talkers = await env.db.prepare("SELECT name, COUNT(*) AS n FROM talk WHERE created_at > ? AND hidden = 0 AND kind != 'emote' GROUP BY player_id, name ORDER BY n DESC LIMIT 5").bind(now - 24 * 3600_000).all();
  return json({ rich: rich.results, levels: levels.results, snappers: snappers.results, talkers: talkers.results, landlords: landlords.results }, 200, { "cache-control": "public, max-age=60" });
};

const adminTalk: Handler = async (_req, env) => {
  const { results } = await env.db.prepare("SELECT * FROM talk ORDER BY reports DESC, created_at DESC LIMIT 100").all();
  return json({ talk: results });
};

const adminTalkAction: Handler = async (req, env, [talkId]) => {
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "hide" && body?.action !== "show") return fail(400, "action must be hide or show");
  await env.db.prepare("UPDATE talk SET hidden = ? WHERE id = ?").bind(body.action === "hide" ? 1 : 0, talkId).run();
  return json({ ok: true });
};

const street: Handler = async (_req, env, _p, { now }) => {
  const { results } = await env.db.prepare(
    `SELECT id, name, tag_json, look_json, level, pos_x, pos_y, kiosk_json FROM players
     WHERE last_seen > ? AND ghost = 0 AND frozen = 0 AND name != '' ORDER BY last_seen DESC LIMIT 12`,
  ).bind(now - 15 * 60_000).all<{ id: string; name: string; tag_json: string; look_json: string; level: number; pos_x: number; pos_y: number; kiosk_json: string | null }>();
  return json(
    {
      players: results.map((r) => ({ id: r.id, name: r.name, level: r.level, tag: JSON.parse(r.tag_json), look: JSON.parse(r.look_json), pos: { x: r.pos_x, y: r.pos_y }, kiosk: r.kiosk_json ? JSON.parse(r.kiosk_json) : null })),
    },
    200,
    { "cache-control": "public, max-age=20" },
  );
};

const uploadPhoto: Handler = async (req, env, _p, { now, photos }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Make your Ug Tag first.");
  const c = await config(env);
  if (c.uploads_enabled === "false" || c.maintenance_mode === "true") return fail(503, "Uploads are paused right now. Your snap is saved on your phone.");
  if (me.frozen) return fail(423, "This account is under review.");
  const form = await req.formData();
  const raw = form.get("image") as unknown;
  const file = raw && typeof raw === "object" && "arrayBuffer" in raw ? (raw as File) : null;
  const area = String(form.get("area") ?? "");
  const place = String(form.get("place") ?? "").trim();
  if (form.get("consent") !== "yes") return fail(400, "Confirm the photo rules first.");
  if (!file) return fail(400, "No photo attached.");
  if (!["image/webp", "image/jpeg"].includes(file.type)) return fail(415, "Photos must be WebP or JPEG.");
  if (file.size > MAX_PHOTO_BYTES) return fail(413, "Photo is too large.");
  if (!(AREAS as readonly string[]).includes(area)) return fail(400, "Pick an area from the list.");
  const p = checkDisplayName(place.slice(0, 20));
  if (!p.ok) return fail(400, p.reason);
  if (!(await take(env, me.id, "photo", SNAPS_PER_DAY, now))) return fail(429, `That's ${SNAPS_PER_DAY} uploads today. Try again tomorrow.`);
  const width = Math.min(4000, Math.max(1, Number(form.get("width")) || 0));
  const height = Math.min(4000, Math.max(1, Number(form.get("height")) || 0));
  const photoId = id("ph");
  await photos.put(photoId, file.type, await file.arrayBuffer());
  await env.db.prepare("INSERT INTO photos (id, player_id, author, area, place, width, height, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(photoId, me.id, me.name || "Resident", area, p.value, width, height, file.size, now).run();
  return json({ id: photoId, status: "pending" });
};

const listPhotos: Handler = async (_req, env, _p, { url }) => {
  const area = url.searchParams.get("area");
  const limit = Math.min(60, Number(url.searchParams.get("limit")) || 30);
  const stmt = area
    ? env.db.prepare("SELECT id, author, area, place, width, height, featured, created_at FROM photos WHERE status = 'approved' AND area = ? ORDER BY featured DESC, created_at DESC LIMIT ?").bind(area, limit)
    : env.db.prepare("SELECT id, author, area, place, width, height, featured, created_at FROM photos WHERE status = 'approved' ORDER BY featured DESC, created_at DESC LIMIT ?").bind(limit);
  const { results } = await stmt.all();
  const areas = await env.db.prepare("SELECT area, COUNT(*) AS n FROM photos WHERE status = 'approved' GROUP BY area ORDER BY n DESC").all<{ area: string; n: number }>();
  return json({ photos: results, areas: areas.results }, 200, { "cache-control": "public, max-age=60" });
};

const myPhotos: Handler = async (req, env) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  const { results } = await env.db.prepare("SELECT id, area, place, status, reason, created_at FROM photos WHERE player_id = ? ORDER BY created_at DESC LIMIT 50").bind(me.id).all();
  return json({ photos: results });
};

const servePhoto: Handler = async (req, env, [photoId], { photos }) => {
  const clean = photoId.replace(/\.(webp|jpg)$/, "");
  const row = await env.db.prepare("SELECT status, player_id FROM photos WHERE id = ?").bind(clean).first<{ status: string; player_id: string }>();
  if (!row) return fail(404, "Not found.");
  if (row.status !== "approved" && !isAdmin(req, env)) {
    const me = await auth(req, env);
    if (!me || me.id !== row.player_id) return fail(404, "Not found.");
  }
  const obj = await photos.get(clean);
  if (!obj) return fail(404, "Not found.");
  return new Response(obj.data, {
    headers: { "content-type": obj.mime, "cache-control": row.status === "approved" ? "public, max-age=86400, immutable" : "private, no-store" },
  });
};

const createTicket: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  const who = me?.id ?? (await ipKey(req));
  if (!(await take(env, who, "ticket", 5, now))) return fail(429, "You've sent 5 notes today. We'll get to them.");
  const body = (await req.json().catch(() => null)) as { category?: string; text?: string } | null;
  const cats = ["how-to", "bug", "account", "safety", "other"];
  const category = cats.includes(body?.category ?? "") ? body!.category! : "other";
  const text = String(body?.text ?? "").trim();
  if (text.length < 5 || text.length > 1000) return fail(400, "Write between 5 and 1,000 characters.");
  const priority = category === "safety" ? "P0" : category === "account" ? "P1" : "P2";
  const tid = id("t");
  await env.db.prepare("INSERT INTO tickets (id, player_id, category, body, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(tid, me?.id ?? null, category, text, priority, now, now).run();
  return json({ id: tid, priority });
};

const myTickets: Handler = async (req, env) => {
  const me = await auth(req, env);
  if (!me) return json({ tickets: [] });
  const { results } = await env.db.prepare("SELECT id, category, body, status, reply, created_at, updated_at FROM tickets WHERE player_id = ? ORDER BY created_at DESC LIMIT 20").bind(me.id).all();
  return json({ tickets: results });
};

const createReport: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
  if (!me) return fail(401, "Not signed in.");
  if (!(await take(env, me.id, "report", 20, now))) return fail(429, "Too many reports today.");
  const body = (await req.json().catch(() => null)) as { target?: string; reason?: string } | null;
  const target = String(body?.target ?? "").slice(0, 80);
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  if (!target || reason.length < 3) return fail(400, "Say what happened.");
  await env.db.prepare("INSERT INTO reports (id, reporter_id, target, reason, created_at) VALUES (?, ?, ?, ?, ?)").bind(id("r"), me.id, target, reason, now).run();
  return json({ ok: true });
};

const KNOWN_EVENTS = new Set(["age_confirmed", "onboarded", "session_start", "job_accepted", "job_completed", "kiosk_leased", "kiosk_painted", "upgrade_bought", "pothole_reported", "card_shared", "ticket_saved", "snap_made", "snap_uploaded", "visitor_viewed", "boda_taken", "ride_done", "rolex_bought", "food_bought", "yard_built", "goal_claimed", "landmark_found", "talk_sent", "voice_sent", "emote_sent", "resident_greeted", "place_go", "sound_off", "leaderboard_viewed", "boda_offer_taken", "land_bought", "land_built", "rent_collected", "billboard_rented", "shift_done", "proposal_made", "voted", "rally_joined", "event_attended", "news_read", "topup_started", "travel", "friend_added", "dm_sent", "chair_run", "chair_voted", "date", "gift", "slept", "showered", "venue"]);

/** Free, private analytics: daily counters only, no personal data. */
const track: Handler = async (req, env, _p, { now }) => {
  const body = (await req.json().catch(() => null)) as { events?: string[] } | null;
  const counts = new Map<string, number>();
  for (const e of (body?.events ?? []).slice(0, 50)) if (KNOWN_EVENTS.has(e)) counts.set(e, (counts.get(e) ?? 0) + 1);
  if (!counts.size) return json({ ok: true });
  const day = kampalaDateKey(now);
  await env.db.batch([...counts].map(([name, n]) =>
    env.db.prepare("INSERT INTO events (day, name, count) VALUES (?, ?, ?) ON CONFLICT (day, name) DO UPDATE SET count = events.count + excluded.count").bind(day, name, n)));
  return json({ ok: true });
};

// ---------- admin routes (Sammy and the agents) ----------

const adminOverview: Handler = async (_req, env, _p, { now }) => {
  const one = async (sql: string, ...b: unknown[]) => (await env.db.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0;
  const day = 24 * 3600_000;
  return json({
    players: { total: await one("SELECT COUNT(*) n FROM players"), active24h: await one("SELECT COUNT(*) n FROM players WHERE last_seen > ?", now - day), active7d: await one("SELECT COUNT(*) n FROM players WHERE last_seen > ?", now - 7 * day), new24h: await one("SELECT COUNT(*) n FROM players WHERE created_at > ?", now - day) },
    photos: { pending: await one("SELECT COUNT(*) n FROM photos WHERE status = 'pending'"), approved: await one("SELECT COUNT(*) n FROM photos WHERE status = 'approved'") },
    tickets: { open: await one("SELECT COUNT(*) n FROM tickets WHERE status = 'open'"), p0: await one("SELECT COUNT(*) n FROM tickets WHERE status = 'open' AND priority = 'P0'") },
    reports: { open: await one("SELECT COUNT(*) n FROM reports WHERE status = 'open'") },
    flags: { open: await one("SELECT COUNT(*) n FROM flags WHERE resolved = 0") },
    economy: { circulating: await one("SELECT COALESCE(SUM(balance), 0) n FROM players WHERE last_seen > ?", now - 7 * day) },
    money: {
      crypto24h: await one("SELECT COALESCE(SUM(crypto_micro), 0) n FROM topups WHERE method = 'crypto' AND status = 'paid' AND paid_at > ?", now - day),
      cryptoAll: await one("SELECT COALESCE(SUM(crypto_micro), 0) n FROM topups WHERE method = 'crypto' AND status = 'paid'"),
      mobile24h: await one("SELECT COALESCE(SUM(price), 0) n FROM topups WHERE method = 'mobile' AND status = 'paid' AND paid_at > ?", now - day),
    },
    online: Object.values((await streetStats(env, now)).counts).reduce((a, b) => a + b, 0),
    config: await config(env),
  });
};

const adminPhotos: Handler = async (_req, env, _p, { url }) => {
  const status = url.searchParams.get("status") ?? "pending";
  const { results } = await env.db.prepare("SELECT * FROM photos WHERE status = ? ORDER BY created_at ASC LIMIT 100").bind(status).all();
  return json({ photos: results });
};

const adminPhotoAction: Handler = async (req, env, [photoId], { now, photos }) => {
  const body = (await req.json().catch(() => null)) as { action?: string; reason?: string } | null;
  const action = body?.action;
  const reason = String(body?.reason ?? "").slice(0, 300) || null;
  if (action === "approve") await env.db.prepare("UPDATE photos SET status = 'approved', reviewed_at = ?, reason = NULL WHERE id = ?").bind(now, photoId).run();
  else if (action === "reject") await env.db.prepare("UPDATE photos SET status = 'rejected', reviewed_at = ?, reason = ? WHERE id = ?").bind(now, reason ?? "Doesn't meet the photo rules", photoId).run();
  else if (action === "feature") await env.db.prepare("UPDATE photos SET featured = 1 - featured WHERE id = ? AND status = 'approved'").bind(photoId).run();
  else if (action === "remove") {
    await env.db.prepare("UPDATE photos SET status = 'removed', reviewed_at = ?, reason = ? WHERE id = ?").bind(now, reason ?? "Removed on request", photoId).run();
    await photos.delete(photoId);
  } else return fail(400, "action must be approve, reject, feature or remove");
  return json({ ok: true });
};

const adminTickets: Handler = async (_req, env, _p, { url }) => {
  const status = url.searchParams.get("status") ?? "open";
  const { results } = await env.db.prepare("SELECT * FROM tickets WHERE status = ? ORDER BY CASE priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END, created_at ASC LIMIT 100").bind(status).all();
  return json({ tickets: results });
};

const adminTicketUpdate: Handler = async (req, env, [ticketId], { now }) => {
  const body = (await req.json().catch(() => null)) as { reply?: string; status?: string; priority?: string } | null;
  const status = ["open", "answered", "escalated", "closed"].includes(body?.status ?? "") ? body!.status! : "answered";
  const priority = ["P0", "P1", "P2"].includes(body?.priority ?? "") ? body!.priority! : null;
  await env.db.prepare("UPDATE tickets SET reply = COALESCE(?, reply), status = ?, priority = COALESCE(?, priority), updated_at = ? WHERE id = ?")
    .bind(body?.reply ? String(body.reply).slice(0, 2000) : null, status, priority, now, ticketId).run();
  return json({ ok: true });
};

const adminList = (table: "flags" | "reports"): Handler => async (_req, env) => {
  const where = table === "flags" ? "resolved = 0" : "status = 'open'";
  const { results } = await env.db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at DESC LIMIT 100`).all();
  return json({ [table]: results });
};

const adminResolve = (table: "flags" | "reports"): Handler => async (_req, env, [rowId]) => {
  const set = table === "flags" ? "resolved = 1" : "status = 'closed'";
  await env.db.prepare(`UPDATE ${table} SET ${set} WHERE id = ?`).bind(rowId).run();
  return json({ ok: true });
};

const adminPlayer: Handler = async (req, env, [playerId]) => {
  if (req.method === "GET") {
    const row = await env.db.prepare("SELECT id, name, level, balance, frozen, created_at, last_seen, save_version FROM players WHERE id = ?").bind(playerId).first();
    return row ? json(row) : fail(404, "No such player");
  }
  const body = (await req.json().catch(() => null)) as { frozen?: boolean } | null;
  if (typeof body?.frozen !== "boolean") return fail(400, "Send { frozen: true|false }");
  await env.db.prepare("UPDATE players SET frozen = ? WHERE id = ?").bind(body.frozen ? 1 : 0, playerId).run();
  return json({ ok: true });
};

const adminConfig: Handler = async (req, env) => {
  const body = (await req.json().catch(() => null)) as { key?: string; value?: string } | null;
  const allowed = ["maintenance_mode", "uploads_enabled", "signups_enabled", "talk_enabled", "topups_enabled", "announcement", "crypto_enabled", "crypto_address", "usd_ugx", "poll_ms"];
  if (!body?.key || !allowed.includes(body.key)) return fail(400, `key must be one of ${allowed.join(", ")}`);
  const v = String(body.value ?? "").trim();
  if (body.key === "crypto_address" && v && !isTronAddress(v)) return fail(400, "That isn't a TRON (TRC20) address. It starts with T and has 34 characters.");
  if (body.key === "usd_ugx" && v && !(Number(v) >= 1_000 && Number(v) <= 10_000)) return fail(400, "The rate must be between 1,000 and 10,000 UGX per dollar.");
  if (body.key === "poll_ms" && v && !(Number(v) >= 5_000 && Number(v) <= 300_000)) return fail(400, "Poll time must be 5,000 to 300,000 ms.");
  if (body.key === "crypto_enabled" && v === "true" && !isTronAddress((await config(env)).crypto_address ?? "")) return fail(400, "Set the receiving address first.");
  configCache.delete(env.db);
  body.value = v;
  await env.db.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").bind(body.key, String(body.value ?? "").slice(0, 280)).run();
  return json({ ok: true });
};

const adminMetrics: Handler = async (_req, env, _p, { url, now }) => {
  const days = Math.min(60, Number(url.searchParams.get("days")) || 7);
  const since = kampalaDateKey(now - days * 24 * 3600_000);
  const { results } = await env.db.prepare("SELECT day, name, count FROM events WHERE day >= ? ORDER BY day, name").bind(since).all();
  return json({ since, events: results });
};

// ---------- router ----------

const routes: [string, RegExp, Handler, boolean][] = [
  ["GET", /^config$/, getConfig, false],
  ["POST", /^session$/, createSession, false],
  ["POST", /^session\/restore$/, restoreSession, false],
  ["PUT", /^save$/, putSave, false],
  ["GET", /^street$/, street, false],
  ["POST", /^photos$/, uploadPhoto, false],
  ["GET", /^photos$/, listPhotos, false],
  ["GET", /^photos\/mine$/, myPhotos, false],
  ["GET", /^photo\/([\w.]+)$/, servePhoto, false],
  ["POST", /^tickets$/, createTicket, false],
  ["GET", /^tickets\/mine$/, myTickets, false],
  ["POST", /^reports$/, createReport, false],
  ["GET", /^plots$/, listPlots, false],
  ["POST", /^plots\/([\w-]+)\/claim$/, claimPlot, false],
  ["GET", /^rewards$/, rewards, false],
  ["POST", /^live$/, live, false],
  ["POST", /^talk$/, postTalk, false],
  ["POST", /^talk\/voice$/, postVoice, false],
  ["POST", /^talk\/([\w]+)\/report$/, reportTalk, false],
  ["GET", /^voice\/([\w]+)$/, serveVoice, false],
  ["GET", /^leaderboard$/, leaderboard, false],
  ["GET", /^land$/, listLand, false],
  ["GET", /^billboards$/, listBillboards, false],
  ["GET", /^community$/, community, false],
  ["GET", /^friends$/, listFriends, false],
  ["POST", /^friends\/([\w]+)$/, addFriend, false],
  ["DELETE", /^friends\/([\w]+)$/, removeFriend, false],
  ["GET", /^dms\/([\w]+)$/, getDms, false],
  ["POST", /^dms\/([\w]+)$/, sendDm, false],
  ["POST", /^dms\/([\w]+)\/report$/, reportDm, false],
  ["GET", /^election$/, getElection, false],
  ["POST", /^election\/run$/, runForChair, false],
  ["POST", /^election\/vote$/, voteChair, false],
  ["POST", /^topup$/, startTopUp, false],
  ["POST", /^topup\/([\w]+)\/verify$/, verifyTopUp, false],
  ["POST", /^crypto$/, startCrypto, false],
  ["POST", /^crypto\/([\w]+)\/check$/, checkCrypto, false],
  ["POST", /^proposals$/, createProposal, false],
  ["POST", /^proposals\/([\w]+)\/vote$/, voteProposal, false],
  ["POST", /^proposals\/([\w]+)\/report$/, reportProposal, false],
  ["POST", /^events\/([\w]+)\/attend$/, attendEvent, false],
  ["POST", /^billboards\/([\w]+)\/rent$/, rentBillboard, false],
  ["POST", /^land\/([\w]+)\/claim$/, claimLand, false],
  ["POST", /^track$/, track, false],
  ["GET", /^admin\/overview$/, adminOverview, true],
  ["GET", /^admin\/photos$/, adminPhotos, true],
  ["POST", /^admin\/photos\/([\w]+)$/, adminPhotoAction, true],
  ["GET", /^admin\/tickets$/, adminTickets, true],
  ["POST", /^admin\/tickets\/([\w]+)$/, adminTicketUpdate, true],
  ["GET", /^admin\/flags$/, adminList("flags"), true],
  ["POST", /^admin\/flags\/([\w]+)$/, adminResolve("flags"), true],
  ["GET", /^admin\/reports$/, adminList("reports"), true],
  ["POST", /^admin\/reports\/([\w]+)$/, adminResolve("reports"), true],
  ["GET", /^admin\/players\/([\w]+)$/, adminPlayer, true],
  ["POST", /^admin\/players\/([\w]+)$/, adminPlayer, true],
  ["POST", /^admin\/config$/, adminConfig, true],
  ["GET", /^admin\/metrics$/, adminMetrics, true],
  ["GET", /^admin\/talk$/, adminTalk, true],
  ["POST", /^admin\/billboards\/([\w]+)$/, adminBillboard, true],
  ["POST", /^admin\/news$/, adminNews, true],
  ["DELETE", /^admin\/news\/([\w]+)$/, adminNews, true],
  ["POST", /^admin\/events$/, adminEvent, true],
  ["DELETE", /^admin\/events\/([\w]+)$/, adminEvent, true],
  ["POST", /^admin\/proposals\/([\w]+)$/, adminProposal, true],
  ["POST", /^admin\/talk\/([\w]+)$/, adminTalkAction, true],
];

/**
 * Public answers (the same for every player) are also kept by Netlify's CDN for as
 * long as the browser may keep them, so a crowd reading the leaderboard or the land
 * map costs one server call every few seconds, not one per phone.
 */
function edgeCache(req: Request, res: Response): Response {
  const m = /^public, max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
  if (req.method === "GET" && m && res.status === 200) res.headers.set("netlify-cdn-cache-control", `public, s-maxage=${m[1]}, stale-while-revalidate=${Number(m[1]) * 4}`);
  return res;
}

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  if (!env.db) return fail(503, "The server isn't connected to its database yet.");
  for (const [method, re, handler, admin] of routes) {
    const m = path.match(re);
    if (!m || method !== req.method) continue;
    if (admin && !isAdmin(req, env)) return fail(401, "Admin token required.");
    try {
      return edgeCache(req, await handler(req, env, m.slice(1), { url, now: Date.now(), photos: env.photos }));
    } catch (e) {
      console.error("api error", path, e);
      return fail(500, "Something went wrong on our side. Your progress is safe on your phone.");
    }
  }
  return fail(404, "Unknown endpoint.");
}
