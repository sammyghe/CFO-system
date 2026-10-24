// Ug Life API. Runs on Netlify Functions (netlify/functions/api.mts, Postgres + Blobs)
// or on Cloudflare Pages Functions (functions/api/[[path]].ts, D1).
// The game never depends on it to be playable: if this is down or over its free
// limit, phones keep playing and sync later.

import { validateSave } from "../src/game/validate";
import { checkDisplayName, checkFreeText } from "../src/game/moderation";
import { AREAS, SNAPS_PER_DAY } from "../src/game/snaps";
import { balanceOf } from "../src/game/ledger";
import { levelForXp } from "../src/game/economy";
import { kampalaDateKey } from "../src/game/time";
import type { PlayerState } from "../src/game/state";
import type { PhotoStore } from "./photostore";
import type { Db } from "./db";

export interface Env {
  db: Db;
  photos: PhotoStore;
  adminToken?: string;
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
  id: string;
  frozen: number;
  save_json: string | null;
  save_version: number;
  name: string;
}

async function auth(req: Request, env: Env): Promise<PlayerRow | null> {
  const t = bearer(req);
  if (!t || t.length < 20 || t.length > 64) return null;
  return env.db.prepare("SELECT id, frozen, save_json, save_version, name FROM players WHERE token_hash = ?").bind(await sha256(t)).first<PlayerRow>();
}

function isAdmin(req: Request, env: Env) {
  const t = bearer(req);
  return !!env.adminToken && env.adminToken.length >= 24 && !!t && timingSafeEqual(t, env.adminToken);
}

async function config(env: Env): Promise<Record<string, string>> {
  const { results } = await env.db.prepare("SELECT key, value FROM config").all<{ key: string; value: string }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
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
    { maintenance: c.maintenance_mode === "true", uploads: c.uploads_enabled !== "false", signups: c.signups_enabled !== "false", announcement: c.announcement ?? "" },
    200,
    { "cache-control": "public, max-age=30" },
  );
};

const createSession: Handler = async (req, env, _p, { now }) => {
  const c = await config(env);
  if (c.signups_enabled === "false" || c.maintenance_mode === "true") return fail(503, "Sign-ups are paused for a moment. You can keep playing.");
  if (!(await take(env, await ipKey(req), "signup", 30, now))) return fail(429, "Too many new accounts from this connection today.");
  const token = randomToken();
  const playerId = id("p");
  await env.db.prepare("INSERT INTO players (id, token_hash, created_at, last_seen) VALUES (?, ?, ?, ?)").bind(playerId, await sha256(token), now, now).run();
  return json({ playerId, token });
};

const restoreSession: Handler = async (req, env) => {
  const me = await auth(req, env);
  if (!me) return fail(404, "That code doesn't match any player. Check it and try again.");
  return json({ playerId: me.id, version: me.save_version, save: me.save_json ? JSON.parse(me.save_json) : null });
};

const putSave: Handler = async (req, env, _p, { now }) => {
  const me = await auth(req, env);
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
  const verdict = validateSave(prev, next, now);
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
  return json({ ok: true, version });
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

const KNOWN_EVENTS = new Set(["age_confirmed", "onboarded", "session_start", "job_accepted", "job_completed", "kiosk_leased", "kiosk_painted", "upgrade_bought", "pothole_reported", "card_shared", "ticket_saved", "snap_made", "snap_uploaded", "visitor_viewed"]);

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
  const allowed = ["maintenance_mode", "uploads_enabled", "signups_enabled", "announcement"];
  if (!body?.key || !allowed.includes(body.key)) return fail(400, `key must be one of ${allowed.join(", ")}`);
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
];

export async function handle(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  if (!env.db) return fail(503, "The server isn't connected to its database yet.");
  for (const [method, re, handler, admin] of routes) {
    const m = path.match(re);
    if (!m || method !== req.method) continue;
    if (admin && !isAdmin(req, env)) return fail(401, "Admin token required.");
    try {
      return await handler(req, env, m.slice(1), { url, now: Date.now(), photos: env.photos });
    } catch (e) {
      console.error("api error", path, e);
      return fail(500, "Something went wrong on our side. Your progress is safe on your phone.");
    }
  }
  return fail(404, "Unknown endpoint.");
}
