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
