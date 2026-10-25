// Runs the real API against a local Postgres (the same engine Netlify Database uses).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NetlifyDB } from "@netlify/database-dev";
import pg from "pg";
import { handle, type Env } from "../server/api";
import { PgDb } from "../server/db";
import type { PhotoStore } from "../server/photostore";
import { newPlayer } from "../src/game/state";
import { visit } from "../src/game/actions";

pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

const ADMIN = "test-admin-token-123456789012345";
let server: NetlifyDB;
let pool: pg.Pool;
let env: Env;
const blobs = new Map<string, { mime: string; data: ArrayBuffer }>();
const photos: PhotoStore = {
  put: async (id, mime, data) => void blobs.set(id, { mime, data }),
  get: async (id) => blobs.get(id) ?? null,
  delete: async (id) => void blobs.delete(id),
};

beforeAll(async () => {
  server = new NetlifyDB();
  const cs = await server.start();
  await server.applyMigrations("./netlify/database/migrations");
  pool = new pg.Pool({ connectionString: cs, max: 2 });
  env = { db: new PgDb(pool), photos, adminToken: ADMIN };
}, 60_000);

afterAll(async () => {
  await pool?.end();
  await server?.stop();
});

async function call(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await handle(new Request(`http://x/api/${path}`, { method, headers, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) }), env);
  return { status: res.status, data: (await res.json().catch(() => null)) as Record<string, any> };
}

describe("API on Postgres", () => {
  let token = "";
  let playerId = "";

  it("creates a session and reads config", async () => {
    expect((await call("GET", "config")).data.uploads).toBe(true);
    const s = await call("POST", "session", { body: {} });
    expect(s.status).toBe(200);
    token = s.data.token;
    playerId = s.data.playerId;
  });

  it("accepts an honest save, refuses invented money, detects a stale phone", async () => {
    const save = newPlayer(Date.now(), "x");
    save.tag.name = "Sammy";
    visit(save, Date.now());
    expect((await call("PUT", "save", { token, body: { save, baseVersion: 0 } })).data.version).toBe(1);
    const bad = structuredClone(save);
    bad.ledger.entries.push({ key: "gift", amount: 999_999, reason: "x", at: Date.now() });
    expect((await call("PUT", "save", { token, body: { save: bad, baseVersion: 1 } })).status).toBe(422);
    expect((await call("PUT", "save", { token, body: { save, baseVersion: 0 } })).status).toBe(409);
    const street = await call("GET", "street");
    expect(street.data.players[0].name).toBe("Sammy");
  });

  it("rate-limits and counts with Postgres upserts", async () => {
    for (let i = 0; i < 5; i++) expect((await call("POST", "tickets", { token, body: { category: "how-to", text: `question number ${i}` } })).status).toBe(200);
    expect((await call("POST", "tickets", { token, body: { category: "how-to", text: "one too many" } })).status).toBe(429);
    expect((await call("POST", "track", { body: { events: ["session_start", "session_start", "snap_made"] } })).status).toBe(200);
    await call("POST", "track", { body: { events: ["session_start"] } });
    const m = await call("GET", "admin/metrics", { token: ADMIN });
    expect(m.data.events.find((e: { name: string }) => e.name === "session_start").count).toBe(3);
  });

  it("runs the snap review loop", async () => {
    const form = new FormData();
    form.set("image", new File([new Uint8Array([1, 2, 3])], "s.jpg", { type: "image/jpeg" }));
    form.set("area", "Kikoni");
    form.set("place", "Kikoni road");
    form.set("width", "800");
    form.set("height", "600");
    form.set("consent", "yes");
    const up = await call("POST", "photos", { token, form });
    expect(up.status).toBe(200);
    expect((await call("GET", `photo/${up.data.id}`)).status).toBe(404); // not public until approved
    expect((await call("POST", `admin/photos/${up.data.id}`, { token: ADMIN, body: { action: "approve" } })).status).toBe(200);
    await call("POST", `admin/photos/${up.data.id}`, { token: ADMIN, body: { action: "feature" } });
    const list = await call("GET", "photos");
    expect(list.data.photos[0]).toMatchObject({ place: "Kikoni road", featured: 1 });
    expect(list.data.areas[0]).toMatchObject({ area: "Kikoni", n: 1 });
  });

  it("gives the admin an overview with numbers, and refuses others", async () => {
    expect((await call("GET", "admin/overview")).status).toBe(401);
    const o = await call("GET", "admin/overview", { token: ADMIN });
    expect(o.data.players.total).toBe(1);
    expect(o.data.flags.open).toBe(1);
    expect(o.data.economy.circulating).toBe(5000);
    expect((await call("POST", `admin/players/${playerId}`, { token: ADMIN, body: { frozen: true } })).status).toBe(200);
  });
});

describe("shared plots and referrals on Postgres", () => {
  async function player(name: string, ref?: string) {
    const s = await call("POST", "session", { body: ref ? { ref } : {} });
    const save = newPlayer(Date.now(), name);
    save.tag.name = name;
    visit(save, Date.now());
    return { token: s.data.token as string, id: s.data.playerId as string, save, version: 0 };
  }
  async function sync(p: Awaited<ReturnType<typeof player>>) {
    const r = await call("PUT", "save", { token: p.token, body: { save: p.save, baseVersion: p.version } });
    if (r.data.version) p.version = r.data.version;
    return r;
  }

  it("one owner per plot, everyone sees it, the lease is checked against the claim", async () => {
    const a = await player("Amina");
    const b = await player("Brian");
    expect((await call("POST", "plots/plot-d/claim", { token: a.token })).status).toBe(402); // no savings on record yet
    for (const p of [a, b]) {
      for (let i = 0; i < 9; i++) p.save.ledger.entries.push({ key: `job:${p.id}:${i}`, amount: 3000, reason: "", at: Date.now() });
      expect((await sync(p)).status).toBe(200);
    }
    const claim = await call("POST", "plots/plot-d/claim", { token: a.token });
    expect(claim.status).toBe(200);
    expect((await call("POST", "plots/plot-d/claim", { token: b.token })).status).toBe(409);
    // Brian can't pay a lease for a plot he never got
    const { leaseKiosk } = await import("../src/game/actions");
    leaseKiosk(b.save, "plot-d", Date.now());
    expect((await sync(b)).status).toBe(422);
    leaseKiosk(a.save, "plot-d", Date.now());
    a.save.kiosk!.name = "AMINA JUICE";
    a.save.yard[0] = "chairs";
    expect((await sync(a)).status).toBe(200);
    const plots = await call("GET", "plots");
    expect(plots.data.plots).toEqual([expect.objectContaining({ plotId: "plot-d", owner: "Amina", kiosk: expect.objectContaining({ name: "AMINA JUICE", yard: ["chairs", null, null, null, null] }) })]);
  });

  it("pays a referral only after the friend does real work", async () => {
    const host = await player("Host");
    const friend = await player("Friend", host.id);
    expect((await call("GET", "rewards", { token: friend.token })).data.referred).toBe(true);
    expect((await call("GET", "rewards", { token: host.token })).data.referrals).toEqual([]);
    friend.save.ledger.entries.push({ key: "job:x:1", amount: 2500, reason: "", at: Date.now() });
    await sync(friend);
    const r = await call("GET", "rewards", { token: host.token });
    expect(r.data.referrals).toEqual([{ id: friend.id, name: "Friend" }]);
    const { claimReferral } = await import("../src/game/street");
    claimReferral(host.save, friend.id, "Friend", Date.now());
    expect((await sync(host)).status).toBe(200);
    // a made-up referral is refused
    claimReferral(host.save, "p_notreal123", "Ghost", Date.now());
    expect((await sync(host)).status).toBe(422);
  });
});

describe("street talk and land on Postgres", () => {
  async function player(name: string) {
    const s = await call("POST", "session", { body: {} });
    const save = newPlayer(Date.now(), name);
    save.tag.name = name;
    visit(save, Date.now());
    const p = { token: s.data.token as string, id: s.data.playerId as string, save, version: 0 };
    const r = await call("PUT", "save", { token: p.token, body: { save: p.save, baseVersion: 0 } });
    p.version = r.data.version;
    return p;
  }

  it("talks: phrases and text go to everyone, scams are refused, two reports hide a message", async () => {
    const a = await player("Talker");
    const b = await player("Listener");
    const c = await player("Third");
    expect((await call("POST", "talk", { token: a.token, body: { kind: "phrase", body: "otya", x: 5, y: 11 } })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 750));
    expect((await call("POST", "talk", { token: a.token, body: { kind: "phrase", body: "not-a-phrase" } })).status).toBe(400);
    expect((await call("POST", "talk", { token: a.token, body: { kind: "text", body: "send money to 0772123456" } })).status).toBe(400);
    const t = await call("POST", "talk", { token: a.token, body: { kind: "text", body: "Who wants a rolex?", x: 5, y: 11 } });
    expect(t.status).toBe(200);
    expect((await call("POST", "talk", { token: a.token, body: { kind: "emote", body: "dance" } })).status).toBe(429); // too fast
    const live = await call("POST", "live", { token: b.token, body: { x: 6, y: 11, since: 0 } });
    expect(live.data.talk.map((m: { body: string }) => m.body)).toEqual(["otya", "Who wants a rolex?"]);
    expect(live.data.players.some((p: { name: string }) => p.name === "Talker")).toBe(true);
    await call("POST", `talk/${t.data.id}/report`, { token: b.token });
    expect((await call("POST", `talk/${t.data.id}/report`, { token: c.token })).data.hidden).toBe(true);
    const after = await call("POST", "live", { body: { since: 0 } });
    expect(after.data.talk.map((m: { body: string }) => m.body)).toEqual(["otya"]);
  });

  it("sells land at the server's price, one owner per plot, and checks the price in the save", async () => {
    const { buyLand } = await import("../src/game/land");
    const p = await player("Landlord");
    expect((await call("POST", "land/kololo/claim", { token: p.token })).status).toBe(402); // UGX 25,000+, more than the welcome money
    for (let i = 0; i < 4; i++) p.save.ledger.entries.push({ key: `job:land:${i}`, amount: 3000, reason: "", at: Date.now() });
    p.version = (await call("PUT", "save", { token: p.token, body: { save: p.save, baseVersion: p.version } })).data.version;
    const claim = await call("POST", "land/bwaise/claim", { token: p.token });
    expect(claim.status).toBe(200);
    const cheat = structuredClone(p.save);
    buyLand(cheat, "bwaise", claim.data.slot, 100, Date.now());
    expect((await call("PUT", "save", { token: p.token, body: { save: cheat, baseVersion: p.version } })).status).toBe(422);
    buyLand(p.save, "bwaise", claim.data.slot, claim.data.price, Date.now());
    expect((await call("PUT", "save", { token: p.token, body: { save: p.save, baseVersion: p.version } })).status).toBe(200);
    const market = await call("GET", "land");
    const bw = market.data.areas.find((a: { id: string }) => a.id === "bwaise");
    expect(bw.sold).toBe(1);
    expect(bw.owners[0]).toMatchObject({ name: "Landlord", slot: claim.data.slot });
    expect(bw.price).toBeGreaterThan(claim.data.price);
    const board = await call("GET", "leaderboard");
    expect(board.data.landlords[0]).toMatchObject({ name: "Landlord", plots: 1 });
  });
});
