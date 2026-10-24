import { describe, expect, it } from "vitest";
import { balanceOf, emptyLedger, post } from "../src/game/ledger";
import { newPlayer } from "../src/game/state";
import * as A from "../src/game/actions";
import { advance, newPothole, report } from "../src/game/civic";
import { checkDisplayName, checkFreeText, checkHandle, profileUrl } from "../src/game/moderation";
import { KIOSK_LEASE_PRICE, JOBS_PER_DAY, jobPay, levelForXp } from "../src/game/economy";
import { kampalaDateKey, DAY_MS } from "../src/game/time";
import { findPath } from "../src/world/path";
import { PLACES, isWalkable } from "../src/world/map";

const T0 = Date.parse("2026-10-24T09:00:00Z");

function player() {
  const s = newPlayer(T0, "p1");
  s.tag.name = "Sammy";
  A.visit(s, T0);
  return s;
}

function deliver(s: ReturnType<typeof player>, now: number) {
  const offer = A.jobOffers(s, now)[0];
  expect(A.acceptJob(s, offer.id, now).ok).toBe(true);
  expect(A.arriveAt(s, offer.fromId, now)?.ok).toBe(true);
  return A.arriveAt(s, offer.toId, now);
}

describe("ledger", () => {
  it("rejects duplicate keys, zero and overdraft", () => {
    const l = emptyLedger();
    expect(post(l, "a", 100, "x", 0).ok).toBe(true);
    expect(post(l, "a", 100, "x", 0)).toMatchObject({ ok: false, error: "duplicate" });
    expect(post(l, "b", 0, "x", 0)).toMatchObject({ ok: false, error: "invalid" });
    expect(post(l, "c", 1.5, "x", 0)).toMatchObject({ ok: false, error: "invalid" });
    expect(post(l, "d", -101, "x", 0)).toMatchObject({ ok: false, error: "insufficient" });
    expect(balanceOf(l)).toBe(100);
  });
});

describe("visits", () => {
  it("pays the welcome grant once and the daily bonus once per day", () => {
    const s = player();
    expect(balanceOf(s.ledger)).toBe(5000);
    A.visit(s, T0 + 1000);
    expect(balanceOf(s.ledger)).toBe(5000);
    A.visit(s, T0 + DAY_MS);
    expect(balanceOf(s.ledger)).toBe(7000);
    A.visit(s, T0 + DAY_MS + 5000);
    expect(balanceOf(s.ledger)).toBe(7000);
  });
});

describe("deliveries", () => {
  it("pays once per job and only at the right stops", () => {
    const s = player();
    const offer = A.jobOffers(s, T0)[0];
    A.acceptJob(s, offer.id, T0);
    expect(A.arriveAt(s, offer.toId, T0)).toBeNull(); // dropoff before pickup does nothing
    A.arriveAt(s, offer.fromId, T0);
    const before = balanceOf(s.ledger);
    expect(A.arriveAt(s, offer.toId, T0)?.ok).toBe(true);
    expect(balanceOf(s.ledger)).toBe(before + offer.pay);
    expect(A.arriveAt(s, offer.toId, T0)).toBeNull(); // no job active any more
    expect(s.goals).toContain("delivery");
  });

  it("cannot re-accept a paid job", () => {
    const s = player();
    const offer = A.jobOffers(s, T0)[0];
    deliver(s, T0);
    expect(A.acceptJob(s, offer.id, T0).ok).toBe(false);
  });

  it("caps deliveries per day", () => {
    const s = player();
    for (let i = 0; i < JOBS_PER_DAY; i++) expect(deliver(s, T0 + i)?.ok).toBe(true);
    const offer = A.jobOffers(s, T0)[0];
    expect(A.acceptJob(s, offer.id, T0).ok).toBe(false);
    expect(A.jobsLeftToday(s, T0 + DAY_MS)).toBe(JOBS_PER_DAY);
  });

  it("pays within bounds", () => {
    expect(jobPay(0, 1)).toBe(1500);
    expect(jobPay(100, 1)).toBe(4500);
    expect(jobPay(10, 1.2)).toBe(3250);
  });

  it("every job place is reachable from the start tile", () => {
    for (const p of PLACES) {
      expect(isWalkable(p.x, p.y), p.id).toBe(true);
      expect(findPath({ x: 3, y: 11 }, p), p.id).not.toBeNull();
    }
  });
});

describe("kiosk", () => {
  function rich() {
    const s = player();
    post(s.ledger, "test-grant", 100_000, "test", T0);
    return s;
  }

  it("needs enough money to lease", () => {
    const s = player();
    expect(A.leaseKiosk(s, "plot-a", T0).ok).toBe(false);
  });

  it("leases once, blocks NPC plots and a second lease", () => {
    const s = rich();
    const b = balanceOf(s.ledger);
    expect(A.leaseKiosk(s, "plot-b", T0).ok).toBe(false);
    expect(A.leaseKiosk(s, "plot-a", T0).ok).toBe(true);
    expect(balanceOf(s.ledger)).toBe(b - KIOSK_LEASE_PRICE);
    expect(A.leaseKiosk(s, "plot-c", T0).ok).toBe(false);
  });

  it("caps sales per day and pays away income for at most 3 days", () => {
    const s = rich();
    A.leaseKiosk(s, "plot-a", T0);
    const { max } = A.kioskSalesToday(s, T0);
    for (let i = 0; i < max; i++) expect(A.kioskSale(s, T0 + i).ok).toBe(true);
    expect(A.kioskSale(s, T0 + 999).ok).toBe(false);
    const before = balanceOf(s.ledger);
    A.visit(s, T0 + 6 * DAY_MS);
    const away = s.ledger.entries.filter((e) => e.key.startsWith("away:"));
    expect(away.length).toBe(3);
    expect(balanceOf(s.ledger)).toBeGreaterThan(before);
  });

  it("moderates the sign and rejects unknown upgrades", () => {
    const s = rich();
    A.leaseKiosk(s, "plot-a", T0);
    expect(A.paintKiosk(s, "send me money now", "#1f4fd1", "Fresh juice").ok).toBe(false);
    expect(A.paintKiosk(s, "Sam's Juice", "#ff00ff", "Fresh juice").ok).toBe(false);
    expect(A.paintKiosk(s, "Sam's Juice", "#1f4fd1", "Fresh juice").ok).toBe(true);
    expect(A.buyUpgrade(s, "rocket", T0).ok).toBe(false);
    expect(A.buyUpgrade(s, "shade", T0).ok).toBe(true);
    expect(A.buyUpgrade(s, "shade", T0).ok).toBe(false);
  });

  it("expires after the lease", () => {
    const s = rich();
    A.leaseKiosk(s, "plot-a", T0);
    A.visit(s, T0 + 8 * DAY_MS);
    expect(s.kiosk).toBeNull();
  });
});

describe("civic", () => {
  it("needs 3 different reporters, then moves through stages over time", () => {
    const i = newPothole();
    expect(report(i, "a", 0).ok).toBe(true);
    expect(report(i, "a", 0).ok).toBe(false);
    report(i, "b", 0);
    expect(i.status).toBe("reported");
    report(i, "c", 1000);
    expect(i.status).toBe("verified");
    advance(i, 1000 + 29_000);
    expect(i.status).toBe("verified");
    advance(i, 1000 + 1_000_000);
    expect(i.status).toBe("resolved");
    expect(i.timeline.map((e) => e.status)).toEqual(["reported", "verified", "assigned", "in_progress", "resolved"]);
  });
});

describe("moderation", () => {
  it("checks names", () => {
    expect(checkDisplayName("Nakato B").ok).toBe(true);
    expect(checkDisplayName("x").ok).toBe(false);
    expect(checkDisplayName("f u c k").ok).toBe(false);
    expect(checkDisplayName("sh1t").ok).toBe(false);
    expect(checkDisplayName("visit www.scam.com").ok).toBe(false);
    expect(checkDisplayName("0772 123 456").ok).toBe(false);
    expect(checkDisplayName("Ug Life Support").ok).toBe(false);
  });
  it("blocks scams in free text", () => {
    expect(checkFreeText("Send me money on mobile money", 60).ok).toBe(false);
    expect(checkFreeText("Free airtime here", 60).ok).toBe(false);
    expect(checkFreeText("Designer at Makerere", 60).ok).toBe(true);
  });
  it("builds social links itself", () => {
    expect(checkHandle("x", "bad handle!").ok).toBe(false);
    expect(profileUrl("tiktok", "sammy")).toBe("https://www.tiktok.com/@sammy");
  });
});

describe("misc", () => {
  it("uses Kampala dates", () => {
    expect(kampalaDateKey(Date.parse("2026-10-24T21:30:00Z"))).toBe("2026-10-25");
    expect(A.addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("levels", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(20)).toBe(2);
    expect(levelForXp(80)).toBe(3);
  });
});

import { validateSave } from "../src/game/validate";
import { rewardSnap } from "../src/game/snaps";

describe("server save check", () => {
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

  it("accepts honest play", () => {
    const s = player();
    deliver(s, T0);
    rewardSnap(s, T0);
    expect(validateSave(null, s, T0 + 1000)).toMatchObject({ ok: true });
  });

  it("refuses invented money", () => {
    const s = player();
    const prev = clone(s);
    s.ledger.entries.push({ key: "gift", amount: 1_000_000, reason: "hack", at: T0 });
    expect(validateSave(prev, s, T0).ok).toBe(false);
  });

  it("refuses an inflated job", () => {
    const s = player();
    s.ledger.entries.push({ key: "job:x", amount: 99_000, reason: "x", at: T0 });
    expect(validateSave(null, s, T0).ok).toBe(false);
  });

  it("refuses rewriting history", () => {
    const s = player();
    deliver(s, T0);
    const prev = clone(s);
    s.ledger.entries[1].amount = 4_000_000;
    expect(validateSave(prev, s, T0).errors[0]).toMatch(/changed/);
    const shorter = clone(prev);
    shorter.ledger.entries.pop();
    expect(validateSave(prev, shorter, T0).ok).toBe(false);
  });

  it("refuses more than 10 paid jobs in a day and a second snap reward", () => {
    const s = player();
    for (let i = 0; i < 11; i++) s.ledger.entries.push({ key: `job:x${i}`, amount: 3000, reason: "", at: T0 });
    expect(validateSave(null, s, T0).ok).toBe(false);
    const t = player();
    t.ledger.entries.push({ key: "snap:2026-10-24", amount: 1000, reason: "", at: T0 }, { key: "snap:2026-10-24b", amount: 1000, reason: "", at: T0 });
    expect(validateSave(null, t, T0).ok).toBe(false);
  });

  it("allows a real kiosk lease and upgrade", () => {
    const s = player();
    post(s.ledger, "test-grant", 100_000, "test", T0);
    const prev = clone(s);
    A.leaseKiosk(s, "plot-a", T0);
    A.buyUpgrade(s, "solar", T0);
    expect(validateSave(prev, s, T0).ok).toBe(true);
  });
});
