import { describe, expect, it } from "vitest";
import { newPlayer } from "../src/game/state";
import { visit, acceptJob, jobOffers } from "../src/game/actions";
import * as N from "../src/game/needs";
import * as P from "../src/game/people";
import * as T from "../src/game/travel";
import * as St from "../src/game/street";
import { claimStart } from "../src/game/money";
import { validateSave, type ServerFacts } from "../src/game/validate";
import { weekKey } from "../src/content/social";
import { AREAS, setArea, isWalkable, PLACES, ALL_PLOTS, findPlace } from "../src/world/map";
import { SHIFTS, VENDORS } from "../src/content/catalog";
import { BILLBOARD_SLOTS } from "../src/content/billboards";
import { RESIDENTS } from "../src/content/residents";

const T0 = Date.parse("2026-10-27T09:00:00Z");
const facts = (f: Partial<ServerFacts> = {}): ServerFacts => ({ plotClaims: new Set(), referrals: new Set(), referred: false, ...f });
const player = () => { const s = newPlayer(T0, "p_life"); visit(s, T0); return s; };

describe("areas", () => {
  it("every area is walkable from its stage, with unique ids for plots, places and shifts", () => {
    for (const a of AREAS) {
      setArea(a.id);
      expect(isWalkable(a.stage.x, a.stage.y)).toBe(true);
      for (const p of PLACES) expect(isWalkable(p.x, p.y) || p.y === 4 || p.y === 11).toBe(true);
      for (const b of a.buildings) expect(b.door.y).toBe(4);
    }
    setArea("wandegeya");
    expect(new Set(ALL_PLOTS.map((p) => p.id)).size).toBe(ALL_PLOTS.length);
    for (const sh of SHIFTS) expect(AREAS.some((a) => a.buildings.some((b) => b.id === sh.building))).toBe(true);
    for (const v of VENDORS) expect(AREAS.find((a) => a.id === (v.area ?? "wandegeya"))!.props.some((p) => p.kind === "cart" && p.vendor === v.id)).toBe(true);
    for (const b of BILLBOARD_SLOTS) if (b.at) expect(AREAS.find((a) => a.id === b.area)!.props.some((p) => p.kind === "billboard" && p.slot === b.id)).toBe(true);
    expect(findPlace("mk-square")?.area.id).toBe("makerere");
    for (const a of AREAS) expect(RESIDENTS.filter((r) => (r.area ?? "wandegeya") === a.id).length).toBeGreaterThan(8);
  });

  it("travel costs a fare (or energy to walk) and is blocked mid-job", () => {
    const s = player();
    expect(T.payTravel(s, "makerere", "matatu", T0).ok).toBe(true);
    expect(s.ledger.entries[s.ledger.entries.length - 1].amount).toBe(-1000);
    expect(T.payTravel(s, "owino", "walk", T0).ok).toBe(true);
    const offer = jobOffers(s, T0)[0];
    acceptJob(s, offer.id, T0);
    expect(T.payTravel(s, "owino", "boda", T0).message).toMatch(/delivery/);
  });
});

describe("needs and homes", () => {
  it("needs drop over time, food fills hunger, and you can't work starving", () => {
    const s = player();
    const later = T0 + 6 * 3600_000;
    expect(N.needsNow(s, later).hunger).toBeLessThan(N.needsNow(s, T0).hunger);
    s.needs = { hunger: 2, hygiene: 80, fun: 50, social: 50, at: T0 };
    const offer = jobOffers(s, T0)[0];
    expect(acceptJob(s, offer.id, T0).message).toMatch(/hungry/);
    St.buyFood(s, "rolex", T0);
    expect(N.needsNow(s, T0).hunger).toBeGreaterThan(50);
    expect(acceptJob(s, offer.id, T0).ok).toBe(true);
  });

  it("a room lets you sleep and shower; washrooms cost a little", () => {
    const s = player();
    for (let i = 0; i < 4; i++) s.ledger.entries.push({ key: `job:x:${i}`, amount: 3_000, reason: "", at: T0 });
    s.needs = { hunger: 80, hygiene: 5, fun: 50, social: 50, at: T0 };
    expect(N.shower(s, "ow-wash", T0).ok).toBe(true);
    expect(N.needsNow(s, T0).hygiene).toBe(100);
    expect(N.rentHome(s, "mk-lumumba", T0).ok).toBe(true);
    expect(N.sleepAtHome(s, "mk-lumumba", T0).ok).toBe(true);
    expect(N.sleepAtHome(s, "hostel", T0).ok).toBe(false);
    expect(N.enjoyVenue(s, "kb-club", T0).ok).toBe(true);
    expect(validateSave(null, s, T0, facts()).errors).toEqual([]);
  });
});

describe("people", () => {
  it("friendship grows with daily greetings and treats, dates need close friends", () => {
    const s = player();
    s.ledger.entries.push({ key: "job:y", amount: 20_000, reason: "", at: T0 });
    expect(P.greeted(s, "r-amani", T0)).toBe(5);
    expect(P.greeted(s, "r-amani", T0)).toBe(0); // once a day
    expect(P.goOnDate(s, "r-amani", "Amani", T0).ok).toBe(false);
    for (let i = 0; i < 4; i++) P.giveGift(s, "r-amani", "Amani", T0 + i);
    expect(P.friendship(s, "r-amani")).toBeGreaterThanOrEqual(50);
    expect(P.goOnDate(s, "r-amani", "Amani", T0).ok).toBe(true);
    expect(s.partner).toBe("r-amani");
  });

  it("the Nepo start money needs the server's word", () => {
    const s = player();
    const prev = structuredClone(s);
    claimStart(s, "nepo", T0);
    expect(validateSave(prev, s, T0, facts({ start: "nepo" })).errors).toEqual([]);
    expect(validateSave(prev, s, T0, facts({ start: "hustler" })).errors.join()).toMatch(/starting money/);
    expect(claimStart(s, "nepo", T0)).toBeNull(); // once
  });

  it("election weeks run Monday to Sunday on Kampala time", () => {
    expect(weekKey(Date.parse("2026-10-26T00:30:00Z"))).toBe(weekKey(Date.parse("2026-11-01T20:00:00Z"))); // Mon → Sun
    expect(weekKey(Date.parse("2026-11-01T22:00:00Z"))).not.toBe(weekKey(Date.parse("2026-11-01T20:00:00Z"))); // Sunday 1am Monday Kampala
    expect(weekKey(Date.parse("2026-10-27T09:00:00Z"))).toBe("2026-W44");
  });
});

describe("crypto top-ups and load", () => {
  it("reads TronGrid's answer: only incoming USDT to our address", async () => {
    const { parseTronGrid, isTronAddress, USDT_TRC20 } = await import("../server/crypto");
    const me = "TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G";
    expect(isTronAddress(me)).toBe(true);
    expect(isTronAddress("0x1234")).toBe(false);
    expect(isTronAddress("TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc3l")).toBe(false); // l isn't base58
    const list = parseTronGrid({
      success: true,
      data: [
        { transaction_id: "a", token_info: { address: USDT_TRC20, decimals: 6 }, block_timestamp: 1, to: me, value: "5037100" },
        { transaction_id: "b", token_info: { address: "TFakeToken", decimals: 6 }, block_timestamp: 2, to: me, value: "5037100" },
        { transaction_id: "c", token_info: { address: USDT_TRC20, decimals: 6 }, block_timestamp: 3, to: "TSomeoneElse", value: "9" },
        { transaction_id: "d", token_info: { address: USDT_TRC20, decimals: 6 }, block_timestamp: 4, to: me, value: "nonsense" },
      ],
    }, me);
    expect(list).toEqual([{ txId: "a", micro: 5_037_100, at: 1, to: me }]);
  });

  it("prices packs and shows amounts with 4 decimals", async () => {
    const { CRYPTO_PACKS, cryptoCredit } = await import("../src/content/topup");
    const { usdtText } = await import("../src/ui/topupsheet");
    expect(cryptoCredit(CRYPTO_PACKS[0], 3600)).toEqual({ price: 7_200, credit: 7_200 });
    expect(cryptoCredit(CRYPTO_PACKS[2], 3600)).toEqual({ price: 36_000, credit: 43_200 });
    expect(usdtText(5_037_100)).toBe("5.0371");
    expect(usdtText(2_000_100)).toBe("2.0001");
  });

  it("slows everyone's polling as the game gets busy", async () => {
    const { pollFor } = await import("../server/api");
    expect(pollFor(50, 0)).toBe(0);
    expect(pollFor(5_000, 0)).toBe(20_000);
    expect(pollFor(20_000, 0)).toBe(45_000);
    expect(pollFor(500_000, 0)).toBe(90_000);
    expect(pollFor(10, 60_000)).toBe(60_000);
  });
});
