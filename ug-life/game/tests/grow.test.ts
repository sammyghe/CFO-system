import { describe, expect, it } from "vitest";
import { newPlayer } from "../src/game/state";
import { visit, acceptJob, jobOffers } from "../src/game/actions";
import { energyNow, maxEnergy, spendEnergy } from "../src/game/energy";
import * as Sh from "../src/game/shifts";
import * as St from "../src/game/street";
import * as M from "../src/game/money";
import { validateSave, type ServerFacts } from "../src/game/validate";
import { SHIFTS } from "../src/content/catalog";

const T = Date.parse("2026-10-26T09:00:00Z");
const facts = (f: Partial<ServerFacts> = {}): ServerFacts => ({ plotClaims: new Set(), referrals: new Set(), referred: false, ...f });

function player() {
  const s = newPlayer(T, "p_grow");
  visit(s, T);
  return s;
}

describe("energy", () => {
  it("starts full, work uses it, it refills slowly and food tops it up", () => {
    const s = player();
    expect(energyNow(s, T)).toBe(maxEnergy(s));
    expect(spendEnergy(s, 95, T)).toBe(true);
    expect(spendEnergy(s, 10, T)).toBe(false); // too tired
    const offer = jobOffers(s, T)[0];
    expect(acceptJob(s, offer.id, T).message).toMatch(/too tired/);
    expect(energyNow(s, T + 20 * 60_000)).toBe(15); // 10 back after 20 minutes
    St.buySnack(s, "mandazi", T);
    expect(energyNow(s, T)).toBe(13);
    St.buyFood(s, "rolex", T + 1);
    expect(energyNow(s, T + 1)).toBe(58);
  });

  it("a new day refills it", () => {
    const s = player();
    spendEnergy(s, 90, T);
    visit(s, T + 24 * 3600_000);
    expect(energyNow(s, T + 24 * 3600_000)).toBe(maxEnergy(s));
  });
});

describe("shifts", () => {
  it("pays only when you stay to the end, and the server accepts it", () => {
    const s = player();
    const prev = structuredClone(s);
    const sh = SHIFTS.find((x) => x.minLevel === 1)!;
    expect(Sh.startShift(s, sh.id, T).ok).toBe(true);
    expect(Sh.finishShift(s, T + 1000)).toBeNull(); // not yet
    const r = Sh.finishShift(s, T + sh.seconds * 1000);
    expect(r?.ok).toBe(true);
    expect(validateSave(prev, s, T + sh.seconds * 1000, facts()).errors).toEqual([]);
  });

  it("locks better shifts behind levels and refuses made-up shift pay", () => {
    const s = player();
    const hard = SHIFTS.find((x) => x.minLevel > 1)!;
    expect(Sh.startShift(s, hard.id, T).ok).toBe(false);
    const prev = structuredClone(s);
    s.ledger.entries.push({ key: "shift:2026-10-26:0", amount: 9_999, reason: "", at: T });
    expect(validateSave(prev, s, T, facts()).errors.join()).toMatch(/shift pay/);
  });
});

describe("money the server confirms", () => {
  it("top-ups, event rewards and billboard rentals must match the server's records", () => {
    const s = player();
    const prev = structuredClone(s);
    M.claimTopUp(s, "tp_abc", 5_500, T);
    M.claimEvent(s, "ev_1", 1_000, "Launch party", T);
    M.payBillboard(s, "stage", "2026-10-26", 3_000, T);
    const good = facts({ topups: new Map([["tp_abc", 5_500]]), eventRewards: new Map([["ev_1", 1_000]]), billboardClaims: new Map([["stage:2026-10-26", 3_000]]) });
    expect(validateSave(prev, s, T, good).errors).toEqual([]);
    const bad = validateSave(prev, s, T, facts());
    expect(bad.errors.join()).toMatch(/top-up not confirmed/);
    expect(bad.errors.join()).toMatch(/event reward not confirmed/);
    expect(bad.errors.join()).toMatch(/billboard not rented/);
    expect(M.claimTopUp(s, "tp_abc", 5_500, T)).toBeNull(); // only once
  });
});
