// Energy: every kind of work uses some, food gives it back, it refills slowly on its
// own and fully after a night's sleep (your first visit of the day). Higher levels
// hold more. Energy only decides what you can do next; money is checked by the server.

import { levelForXp } from "./economy";
import type { PlayerState } from "./state";

/** Minutes for one point to come back by itself. */
const REGEN_MINUTES = 2;

export const ENERGY_COST = { delivery: 8, ride: 6 } as const;

export function maxEnergy(state: PlayerState): number {
  return Math.min(200, 100 + (levelForXp(state.xp) - 1) * 10);
}

export function energyNow(state: PlayerState, now: number): number {
  const e = state.energy ?? { value: maxEnergy(state), at: now };
  const regen = Math.max(0, (now - e.at) / (REGEN_MINUTES * 60_000));
  return Math.min(maxEnergy(state), Math.floor(e.value + regen));
}

function set(state: PlayerState, value: number, now: number) {
  state.energy = { value: Math.max(0, Math.min(maxEnergy(state), value)), at: now };
}

export function hasEnergy(state: PlayerState, cost: number, now: number) {
  return energyNow(state, now) >= cost;
}

/** Uses energy; false (and nothing used) if there isn't enough. */
export function spendEnergy(state: PlayerState, cost: number, now: number): boolean {
  const e = energyNow(state, now);
  if (e < cost) return false;
  set(state, e - cost, now);
  return true;
}

export function gainEnergy(state: PlayerState, amount: number, now: number) {
  set(state, energyNow(state, now) + amount, now);
}

export function sleep(state: PlayerState, now: number) {
  set(state, maxEnergy(state), now);
}

export function tiredMessage(cost: number) {
  return `You're too tired (this needs ⚡${cost}). Eat something: a rolex gives ⚡45, a mandazi ⚡8. Energy also comes back slowly by itself.`;
}
