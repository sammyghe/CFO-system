import { describe, expect, it } from "vitest";
import { newPlayer } from "../src/game/state";
import { visit } from "../src/game/actions";
import * as L from "../src/game/land";
import * as St from "../src/game/street";
import { validateSave, type ServerFacts } from "../src/game/validate";
import { LAND_AREAS, hotArea, landPrice, rentFor } from "../src/content/land";
import { PHRASES, EMOTES, phraseById } from "../src/content/talk";
import { checkFreeText } from "../src/game/moderation";
import { kampalaDateKey } from "../src/game/time";

const T = Date.parse("2026-10-25T09:00:00Z");
const facts = (land: [string, number][] = []): ServerFacts => ({ plotClaims: new Set(), referrals: new Set(), referred: false, landClaims: new Map(land) });

function rich() {
  const s = newPlayer(T, "p_test");
  visit(s, T);
  for (let i = 0; i < 8; i++) s.ledger.entries.push({ key: `job:x:${i}`, amount: 3000, reason: "", at: T });
  return s;
}

describe("Kampala land", () => {
  it("prices rise as an area fills, and the hot area costs more", () => {
    const day = kampalaDateKey(T);
    const hot = hotArea(day);
    const cold = LAND_AREAS.find((a) => a.id !== hot.id)!;
    expect(landPrice(cold.id, 0, day)).toBe(cold.basePrice);
    expect(landPrice(cold.id, 5, day)).toBeGreaterThan(cold.basePrice);
    expect(landPrice(hot.id, 0, day)).toBe(Math.round((hot.basePrice * 1.5) / 100) * 100);
    // the hot area changes from day to day
    const days = new Set(Array.from({ length: 10 }, (_, i) => hotArea(kampalaDateKey(T + i * 86_400_000)).id));
    expect(days.size).toBeGreaterThan(3);
  });

  it("buy, build and collect rent once a day; the server accepts it", () => {
    const s = rich();
    const prev = structuredClone(s);
    expect(L.buyLand(s, "bwaise", 0, 3000, T).ok).toBe(true);
    expect(L.buildLand(s, "bwaise", 0, T).ok).toBe(true);
    expect(s.land[0].level).toBe(1);
    const r = L.collectRent(s, T);
    expect(r.ok).toBe(true);
    expect(L.collectRent(s, T).ok).toBe(false);
    expect(validateSave(prev, s, T, facts([["bwaise:0", 3000]])).errors).toEqual([]);
  });

  it("refuses land the server didn't sell at that price, unbuilt levels and inflated rent", () => {
    const s = rich();
    const prev = structuredClone(s);
    L.buyLand(s, "bwaise", 0, 1000, T);
    expect(validateSave(prev, s, T, facts([["bwaise:0", 3000]])).errors.join()).toMatch(/not sold by the server/);
    const s2 = rich();
    const p2 = structuredClone(s2);
    L.buyLand(s2, "bwaise", 0, 3000, T);
    s2.land[0].level = 4;
    expect(validateSave(p2, s2, T, facts([["bwaise:0", 3000]])).errors.join()).toMatch(/never built/);
    const s3 = rich();
    const p3 = structuredClone(s3);
    L.buyLand(s3, "bwaise", 0, 3000, T);
    s3.ledger.entries.push({ key: `rent:${kampalaDateKey(T)}`, amount: rentFor(s3.land, kampalaDateKey(T)) + 5000, reason: "", at: T });
    expect(validateSave(p3, s3, T, facts([["bwaise:0", 3000]])).errors.join()).toMatch(/rent out of range/);
  });
});

describe("cheap snacks", () => {
  it("costs a few hundred shillings and gives a small boost", () => {
    const s = rich();
    expect(St.buySnack(s, "mandazi", T).ok).toBe(true);
    expect(s.boost?.pct).toBe(2);
    expect(St.buySnack(s, "kikomando", T + 1).ok).toBe(true);
    expect(s.boost?.pct).toBe(12);
    expect(St.buySnack(s, "caviar", T + 2).ok).toBe(false);
  });
});

describe("street talk content", () => {
  it("has unique phrase and emote ids and phrases pass the text filter", () => {
    expect(new Set(PHRASES.map((p) => p.id)).size).toBe(PHRASES.length);
    expect(new Set(EMOTES.map((e) => e.id)).size).toBe(EMOTES.length);
    for (const p of PHRASES) expect(checkFreeText(p.text, 80).ok).toBe(true);
    expect(phraseById("otya")?.text).toBe("Oli otya?");
  });
});
