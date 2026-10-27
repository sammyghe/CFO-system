// Getting to know the street's characters: greet them every day, treat them to
// food, and once you're close, ask them out. Characters are fictional; this is
// about friendship and good times, nothing explicit.

import { post } from "./ledger";
import { kampalaDateKey } from "./time";
import type { Result } from "./actions";
import { addNeed } from "./needs";
import type { PlayerState } from "./state";

export const DATE_COST = 4_000;
export const GIFT_COST = 1_000;

export function friendship(state: PlayerState, id: string): number {
  return state.friendships?.[id]?.points ?? 0;
}

export function friendshipLabel(p: number) {
  return p >= 80 ? "Best friends" : p >= 50 ? "Close friends" : p >= 20 ? "Friends" : p > 0 ? "Getting to know each other" : "Strangers";
}

function bump(state: PlayerState, id: string, by: number, now: number) {
  state.friendships ??= {};
  const f = state.friendships[id] ?? { points: 0, greeted: "" };
  f.points = Math.max(0, Math.min(100, f.points + by));
  state.friendships[id] = f;
  void now;
}

/** Saying hi counts once a day per person. */
export function greeted(state: PlayerState, id: string, now: number): number {
  const today = kampalaDateKey(now);
  const f = state.friendships?.[id];
  if (f?.greeted === today) return 0;
  bump(state, id, 5, now);
  state.friendships![id].greeted = today;
  return 5;
}

export function giveGift(state: PlayerState, id: string, name: string, now: number): Result {
  const r = post(state.ledger, `gift:${id}:${now}`, -GIFT_COST, `Treat for ${name}`, now);
  if (!r.ok) return { ok: false, message: `A treat costs UGX ${GIFT_COST.toLocaleString()}.` };
  bump(state, id, 12, now);
  addNeed(state, "social", 10, now);
  return { ok: true, message: `You bought ${name} a rolex and a soda. 💛 +12 friendship.` };
}

export function canAskOut(state: PlayerState, id: string) {
  return friendship(state, id) >= 50 && state.partner !== id;
}

export function goOnDate(state: PlayerState, id: string, name: string, now: number): Result {
  if (friendship(state, id) < 50) return { ok: false, message: `Get to know ${name} better first (close friends).` };
  const r = post(state.ledger, `date:${id}:${now}`, -DATE_COST, `Date with ${name}`, now);
  if (!r.ok) return { ok: false, message: `A date costs UGX ${DATE_COST.toLocaleString()} (food and a boda home).` };
  bump(state, id, 10, now);
  addNeed(state, "fun", 40, now);
  addNeed(state, "social", 40, now);
  const first = state.partner !== id;
  state.partner = id;
  return { ok: true, message: first ? `${name} said yes! 💞 You're dating now. Chicken and chips, a walk, and a boda home.` : `Another lovely evening with ${name}. 💞` };
}

export function breakUp(state: PlayerState): Result {
  if (!state.partner) return { ok: false, message: "You're not dating anyone." };
  state.partner = null;
  return { ok: true, message: "You've parted ways, kindly. You're still friends." };
}
