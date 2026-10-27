// Shifts: stand in for a shopkeeper for under a minute and get paid. You have to stay
// at the door until the shift ends. validate.ts checks the pay and the daily count.

import { post } from "./ledger";
import { kampalaDateKey } from "./time";
import { complete, type Result } from "./actions";
import { levelForXp } from "./economy";
import { spendEnergy, tiredMessage } from "./energy";
import { cantWork } from "./needs";
import type { PlayerState } from "./state";
import { SHIFTS, SHIFTS_PER_DAY } from "../content/catalog";

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export function shiftsToday(state: PlayerState, now: number) {
  const prefix = `shift:${kampalaDateKey(now)}:`;
  return state.ledger.entries.filter((e) => e.key.startsWith(prefix)).length;
}

export function shiftFor(buildingId: string) {
  return SHIFTS.find((s) => s.building === buildingId);
}

export function startShift(state: PlayerState, shiftId: string, now: number): Result {
  const sh = SHIFTS.find((s) => s.id === shiftId);
  if (!sh) return fail("No work here right now.");
  if (state.shift) return fail("You're already on a shift.");
  if (state.job || state.ride) return fail("Finish your delivery or ride first.");
  if (levelForXp(state.xp) < sh.minLevel) return fail(`This job needs level ${sh.minLevel}. Do deliveries to level up.`);
  if (shiftsToday(state, now) >= SHIFTS_PER_DAY) return fail(`That's ${SHIFTS_PER_DAY} shifts today. Rest and come back tomorrow.`);
  const notReady = cantWork(state, now, true);
  if (notReady) return fail(notReady);
  if (!spendEnergy(state, sh.energy, now)) return fail(tiredMessage(sh.energy));
  state.shift = { id: sh.id, startedAt: now, endsAt: now + sh.seconds * 1000 };
  return ok(`Shift started: ${sh.title}. Stay here for ${sh.seconds} seconds.`);
}

export function cancelShift(state: PlayerState): Result {
  if (!state.shift) return fail("You're not on a shift.");
  state.shift = null;
  return ok("You left the shift early, so it isn't paid.");
}

/** Pays a finished shift. Call when the time is up and you're still at the door. */
export function finishShift(state: PlayerState, now: number): Result | null {
  const cur = state.shift;
  if (!cur || now < cur.endsAt) return null;
  const sh = SHIFTS.find((s) => s.id === cur.id)!;
  state.shift = null;
  const n = shiftsToday(state, now);
  const r = post(state.ledger, `shift:${kampalaDateKey(now)}:${n}`, sh.pay, sh.title, now);
  if (!r.ok) return fail("That shift was already paid.");
  state.xp += 6;
  state.stats.earned += sh.pay;
  complete(state, "shift");
  return ok(`Shift done. +UGX ${sh.pay.toLocaleString()}`);
}
