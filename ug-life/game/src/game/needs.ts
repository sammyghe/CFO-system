// Needs, like Lagos Life: hunger, hygiene, fun and social go down slowly in real
// time (energy is in energy.ts). Food fills hunger, a shower fixes hygiene, a
// night out or music gives fun, talking to people gives social. If hunger or
// hygiene runs out you can't work until you fix it. Homes: rent a room by the
// week to sleep (full energy) and shower for free.

import { post } from "./ledger";
import { kampalaDateKey } from "./time";
import type { Result } from "./actions";
import { gainEnergy, maxEnergy, sleep as fullEnergy } from "./energy";
import type { PlayerState } from "./state";

export type Need = "hunger" | "hygiene" | "fun" | "social";

export const NEED_INFO: Record<Need, { label: string; icon: string; perMinute: number; fix: string }> = {
  hunger: { label: "Food", icon: "🍲", perMinute: 0.25, fix: "Eat: a mandazi, a rolex, chips. Every cart and food shop helps." },
  hygiene: { label: "Clean", icon: "🚿", perMinute: 0.15, fix: "Shower at your room, or a public washroom (Owino, UGX 200)." },
  fun: { label: "Fun", icon: "🎉", perMinute: 0.2, fix: "Dance, go to Club 256 in Kabalagala, listen at Studio 256, come to events." },
  social: { label: "Friends", icon: "💬", perMinute: 0.12, fix: "Say hi, talk to people, greet residents, rally with others." },
};

export const NEEDS: Need[] = ["hunger", "hygiene", "fun", "social"];

/** Below this you can't work. */
export const NEED_MIN_TO_WORK = 10;

export function needsNow(state: PlayerState, now: number): Record<Need, number> {
  const n = state.needs ?? { hunger: 80, hygiene: 80, fun: 70, social: 60, at: now };
  const mins = Math.max(0, (now - n.at) / 60_000);
  const out = {} as Record<Need, number>;
  for (const k of NEEDS) out[k] = Math.max(0, Math.min(100, Math.round(n[k] - NEED_INFO[k].perMinute * mins)));
  return out;
}

function save(state: PlayerState, values: Record<Need, number>, now: number) {
  state.needs = { ...values, at: now };
}

export function addNeed(state: PlayerState, need: Need, amount: number, now: number) {
  const v = needsNow(state, now);
  v[need] = Math.max(0, Math.min(100, v[need] + amount));
  save(state, v, now);
}

/** Overall mood 0..100: the needs and energy together. */
export function mood(state: PlayerState, now: number, energy: number): number {
  const v = needsNow(state, now);
  const e = (energy / maxEnergy(state)) * 100;
  return Math.round((v.hunger + v.hygiene + v.fun + v.social + e) / 5);
}

export function moodLabel(m: number) {
  return m >= 75 ? "😄 Feeling great" : m >= 50 ? "🙂 Fine" : m >= 25 ? "😕 Struggling" : "😩 Not okay";
}

/** Why you can't work right now, or null. */
export function cantWork(state: PlayerState, now: number, needsClean = false): string | null {
  const v = needsNow(state, now);
  if (v.hunger < NEED_MIN_TO_WORK) return "You're too hungry to work. Eat something first: even a mandazi helps.";
  if (needsClean && v.hygiene < NEED_MIN_TO_WORK) return "You need a shower before this job. Use your room or a public washroom.";
  return null;
}

// ---------- homes ----------

export interface Home {
  area: string;
  building: string;
  name: string;
  pricePerWeek: number;
}

export const HOMES: Home[] = [
  { area: "makerere", building: "mk-lumumba", name: "Bed in Lumumba Hall", pricePerWeek: 4_000 },
  { area: "wandegeya", building: "hostel", name: "Room at Campus View Hostel", pricePerWeek: 6_000 },
  { area: "owino", building: "ow-hotel", name: "Room above Market View Hotel", pricePerWeek: 8_000 },
  { area: "kabalagala", building: "kb-apart", name: "Kabalagala apartment", pricePerWeek: 15_000 },
];

export function homeAt(building: string) {
  return HOMES.find((h) => h.building === building);
}

export function hasHome(state: PlayerState, now: number) {
  return !!state.home && state.home.until > now;
}

export function rentHome(state: PlayerState, building: string, now: number): Result {
  const h = homeAt(building);
  if (!h) return { ok: false, message: "No rooms to let here." };
  const day = kampalaDateKey(now);
  const r = post(state.ledger, `home:${h.building}:${day}`, -h.pricePerWeek, `Rent: ${h.name}`, now);
  if (!r.ok) return { ok: false, message: r.error === "insufficient" ? `Rent is UGX ${h.pricePerWeek.toLocaleString()} a week.` : "You already paid rent here today." };
  const base = state.home && state.home.building === h.building && state.home.until > now ? state.home.until : now;
  state.home = { area: h.area, building: h.building, until: base + 7 * 24 * 3600_000 };
  addNeed(state, "hygiene", 0, now);
  return { ok: true, message: `${h.name} is yours for a week. Sleep and shower here for free.` };
}

export function sleepAtHome(state: PlayerState, building: string, now: number): Result {
  if (!hasHome(state, now) || state.home!.building !== building) return { ok: false, message: "This isn't your room." };
  fullEnergy(state, now);
  addNeed(state, "hunger", -8, now);
  return { ok: true, message: "You slept well. Energy is full." };
}

export function shower(state: PlayerState, building: string, now: number): Result {
  const atHome = hasHome(state, now) && state.home!.building === building;
  const paid = WASHROOMS[building];
  if (!atHome && !paid) return { ok: false, message: "No shower for you here." };
  if (!atHome) {
    const r = post(state.ledger, `wash:${building}:${now}`, -paid, "Public washroom", now);
    if (!r.ok) return { ok: false, message: `The washroom costs UGX ${paid}.` };
  }
  addNeed(state, "hygiene", 100, now);
  return { ok: true, message: atHome ? "Fresh! Clean and ready." : `Fresh for UGX ${paid}. Clean and ready.` };
}

/** Public washrooms and gym showers anyone can pay to use. */
export const WASHROOMS: Record<string, number> = { "ow-wash": 200, "kb-gym": 300, guesthouse: 500, "mk-guild": 300 };

// ---------- fun ----------

/** Paid fun at venues: entry fee and how much fun it gives. */
export const VENUES: Record<string, { fee: number; fun: number; social: number; label: string }> = {
  "kb-club": { fee: 2_000, fun: 55, social: 20, label: "Dance at Club 256" },
  "kb-lounge": { fee: 3_000, fun: 40, social: 30, label: "Sundowner at Skyline Lounge" },
  studio: { fee: 0, fun: 15, social: 5, label: "Listen in at Studio 256" },
  "mk-library": { fee: 0, fun: 5, social: 5, label: "Study in the library" },
  "kb-gym": { fee: 1_000, fun: 25, social: 10, label: "Work out at Tank Hill Gym" },
};

export function enjoyVenue(state: PlayerState, building: string, now: number): Result {
  const v = VENUES[building];
  if (!v) return { ok: false, message: "Nothing on here." };
  if (v.fee) {
    const r = post(state.ledger, `fun:${building}:${now}`, -v.fee, v.label, now);
    if (!r.ok) return { ok: false, message: `Entry is UGX ${v.fee.toLocaleString()}.` };
  }
  addNeed(state, "fun", v.fun, now);
  addNeed(state, "social", v.social, now);
  if (building === "kb-gym") gainEnergy(state, -10, now);
  if (building === "mk-library") state.xp += 3;
  return { ok: true, message: `${v.label}: 🎉 +${v.fun} fun, 💬 +${v.social} social.` };
}
