// Getting around Kampala: matatu (cheap, slow), boda (dear, fast) or walk (free,
// but it costs energy). You can't travel mid-delivery, mid-ride or mid-shift.

import { post } from "./ledger";
import type { Result } from "./actions";
import { spendEnergy, tiredMessage } from "./energy";
import type { PlayerState } from "./state";

export type TravelMode = "matatu" | "boda" | "walk";

export const TRAVEL: Record<TravelMode, { label: string; fare: number; seconds: number; energy: number; blurb: string }> = {
  matatu: { label: "Matatu", fare: 1_000, seconds: 7, energy: 0, blurb: "Cheapest. Squeeze in with 14 others." },
  boda: { label: "Boda", fare: 3_000, seconds: 3, energy: 0, blurb: "Fastest. Hold on tight." },
  walk: { label: "Walk", fare: 0, seconds: 12, energy: 20, blurb: "Free, but tiring (⚡20)." },
};

export function canTravel(state: PlayerState): Result {
  if (state.job) return { ok: false, message: "Finish or drop your delivery before you leave the area." };
  if (state.ride) return { ok: false, message: "Drop off your passenger first." };
  if (state.shift) return { ok: false, message: "Finish your shift first." };
  return { ok: true, message: "" };
}

export function payTravel(state: PlayerState, to: string, mode: TravelMode, now: number): Result {
  const c = canTravel(state);
  if (!c.ok) return c;
  if (state.area === to) return { ok: false, message: "You're already here." };
  const t = TRAVEL[mode];
  if (mode === "walk") {
    if (!spendEnergy(state, t.energy, now)) return { ok: false, message: tiredMessage(t.energy) };
    return { ok: true, message: "" };
  }
  const r = post(state.ledger, `travel:${now}`, -t.fare, `${t.label} to ${to}`, now);
  if (!r.ok) return { ok: false, message: r.error === "insufficient" ? `The ${t.label.toLowerCase()} costs UGX ${t.fare.toLocaleString()}.` : "Already paid." };
  return { ok: true, message: "" };
}
