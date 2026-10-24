import { describe, expect, it } from "vitest";
import { balanceOf, post } from "../src/game/ledger";
import { newPlayer } from "../src/game/state";
import * as A from "../src/game/actions";
import * as S from "../src/game/street";
import { validateSave, type ServerFacts } from "../src/game/validate";
import { BODA } from "../src/content/catalog";
import { DAY_MS } from "../src/game/time";

const T0 = Date.parse("2026-10-24T09:00:00Z");
const facts = (over: Partial<ServerFacts> = {}): ServerFacts => ({ plotClaims: new Set(), referrals: new Set(), referred: false, ...over });

function rich() {
  const s = newPlayer(T0, "p1");
  s.tag.name = "Sammy";
  A.visit(s, T0);
  post(s.ledger, "test-grant", 200_000, "test", T0);
  return s;
}

function doRide(s: ReturnType<typeof rich>, now: number) {
  const o = S.rideOffers(s, now)[0];
  expect(S.acceptRide(s, o.id, now).ok).toBe(true);
  expect(S.rideArrive(s, o.fromId, now)?.ok).toBe(true);
  return S.rideArrive(s, o.toId, now);
}

describe("boda", () => {
  it("needs a rented boda to carry passengers, and pays once per ride", () => {
    const s = rich();
    const o = S.rideOffers(s, T0)[0];
    expect(S.acceptRide(s, o.id, T0).ok).toBe(false);
    expect(S.rentBoda(s, T0).ok).toBe(true);
    expect(S.rentBoda(s, T0).ok).toBe(false);
    const before = balanceOf(s.ledger);
    expect(doRide(s, T0)?.ok).toBe(true);
    expect(balanceOf(s.ledger)).toBeGreaterThan(before);
    expect(s.goals).toContain("rider");
  });

  it("caps rides per day and the rent runs out at midnight", () => {
    const s = rich();
    S.rentBoda(s, T0);
    for (let i = 0; i < BODA.ridesPerDay; i++) expect(doRide(s, T0 + i)?.ok).toBe(true);
    const o = S.rideOffers(s, T0)[0];
    expect(S.acceptRide(s, o.id, T0).ok).toBe(false);
    expect(S.hasBoda(s, T0 + DAY_MS)).toBe(false);
  });

  it("charges a fare to ride somewhere and refuses tiny trips", () => {
    const s = rich();
    const b = balanceOf(s.ledger);
    expect(S.payFare(s, "guesthouse", { x: 3, y: 11 }, T0).ok).toBe(true);
    expect(balanceOf(s.ledger)).toBe(b - S.fareTo({ x: 3, y: 11 }, "guesthouse"));
    expect(S.payFare(s, "stage", { x: 3, y: 11 }, T0 + 1).ok).toBe(false);
  });

  it("can't take a delivery and a passenger at once", () => {
    const s = rich();
    S.rentBoda(s, T0);
    const o = S.rideOffers(s, T0)[0];
    S.acceptRide(s, o.id, T0);
    expect(A.acceptJob(s, A.jobOffers(s, T0)[0].id, T0).ok).toBe(false);
  });
});

describe("food", () => {
  it("a rolex raises delivery pay while it lasts", () => {
    const s = rich();
    const plain = A.jobOffers(s, T0)[0].pay;
    expect(S.buyFood(s, "rolex", T0).ok).toBe(true);
    expect(A.jobOffers(s, T0)[0].pay).toBeGreaterThan(plain);
    expect(A.jobOffers(s, T0 + 31 * 60_000)[0].pay).toBe(plain);
    expect(s.goals).toContain("rolex");
  });
});

describe("yard", () => {
  it("needs a kiosk, charges per item and adds kiosk sales", () => {
    const s = rich();
    expect(S.buildInYard(s, 0, "chairs", T0).ok).toBe(false);
    A.leaseKiosk(s, "plot-a", T0);
    const before = A.kioskSalesToday(s, T0).max;
    expect(S.buildInYard(s, 0, "chairs", T0).ok).toBe(true);
    expect(S.buildInYard(s, 1, "lights", T0).ok).toBe(true);
    expect(S.buildInYard(s, 9, "plant", T0).ok).toBe(false);
    expect(A.kioskSalesToday(s, T0).max).toBeGreaterThan(before);
  });
});

describe("rewards", () => {
  it("goal rewards are claimed once, only after the goal", () => {
    const s = rich();
    expect(S.claimGoal(s, "delivery", T0).ok).toBe(false);
    s.goals.push("delivery");
    expect(S.claimGoal(s, "delivery", T0).ok).toBe(true);
    expect(S.claimGoal(s, "delivery", T0).ok).toBe(false);
  });
});

describe("server checks for the new money", () => {
  it("accepts honest boda, food, yard and goal entries", () => {
    const s = newPlayer(T0, "p2");
    A.visit(s, T0);
    s.goals.push("walk");
    S.claimGoal(s, "walk", T0);
    S.buyFood(s, "maize", T0);
    expect(validateSave(null, s, T0, facts()).ok).toBe(true);
  });

  it("refuses a lease the server never granted, and accepts one it did", () => {
    const s = rich();
    s.ledger.entries = s.ledger.entries.filter((e) => e.key !== "test-grant");
    for (let i = 0; i < 6; i++) post(s.ledger, `goal:${["walk", "delivery", "pothole", "earn25", "kiosk", "rider"][i]}`, S.GOAL_REWARDS[["walk", "delivery", "pothole", "earn25", "kiosk", "rider"][i] as "walk"], "", T0);
    for (let i = 0; i < 10; i++) post(s.ledger, `job:t${i}`, 2000, "", T0);
    A.leaseKiosk(s, "plot-a", T0);
    expect(validateSave(null, s, T0, facts()).errors).toContain("kiosk lease without a server claim");
    expect(validateSave(null, s, T0, facts({ plotClaims: new Set(["plot-a:2026-10-24"]) })).ok).toBe(true);
  });

  it("refuses unconfirmed referrals and inflated rides", () => {
    const s = newPlayer(T0, "p3");
    A.visit(s, T0);
    post(s.ledger, "referral:p_friend", S.REFERRAL_REWARD, "", T0);
    expect(validateSave(null, s, T0, facts()).ok).toBe(false);
    expect(validateSave(null, s, T0, facts({ referrals: new Set(["p_friend"]) })).ok).toBe(true);
    post(s.ledger, "ride:2026-10-24:0", 50_000, "", T0);
    expect(validateSave(null, s, T0, facts({ referrals: new Set(["p_friend"]) })).ok).toBe(false);
  });
});
