// Land rules. Buying needs the server (one owner per plot, price set by the
// server); building and collecting rent work offline. validate.ts repeats the checks.

import { post } from "./ledger";
import { kampalaDateKey } from "./time";
import { complete, type Result } from "./actions";
import type { PlayerState } from "./state";
import { LAND_LEVELS, MAX_LAND, areaById, rentFor } from "../content/land";

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

/** Pays for a plot the server just gave you. */
export function buyLand(state: PlayerState, areaId: string, slot: number, price: number, now: number): Result {
  const a = areaById(areaId);
  if (!a) return fail("Unknown area.");
  if (state.land.length >= MAX_LAND) return fail(`You own ${MAX_LAND} plots already. Build them up!`);
  if (state.land.some((l) => l.area === areaId && l.slot === slot)) return fail("You already own that plot.");
  const r = post(state.ledger, `land:${areaId}:${slot}`, -price, `Plot in ${a.name}`, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `A plot here costs UGX ${price.toLocaleString()}.` : "Already bought.");
  state.land.push({ area: areaId, slot, level: 0, paid: price, boughtAt: now });
  complete(state, "land");
  return ok(`You own a plot in ${a.name}! Build on it to raise the rent.`);
}

export function nextLevel(level: number) {
  return LAND_LEVELS[level + 1] ?? null;
}

export function buildLand(state: PlayerState, areaId: string, slot: number, now: number): Result {
  const l = state.land.find((x) => x.area === areaId && x.slot === slot);
  if (!l) return fail("That isn't your plot.");
  const next = nextLevel(l.level);
  if (!next) return fail("That's as big as it gets.");
  const r = post(state.ledger, `landbuild:${areaId}:${slot}:${next.level}`, -next.cost, `Built: ${next.name}`, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `Building costs UGX ${next.cost.toLocaleString()}.` : "Already built.");
  l.level = next.level;
  state.xp += 4;
  if (l.level >= 3) complete(state, "landlord");
  return ok(`${next.name} built. Rent is now UGX ${next.rent.toLocaleString()} a day.`);
}

export function rentCollected(state: PlayerState, now: number) {
  return state.ledger.entries.some((e) => e.key === `rent:${kampalaDateKey(now)}`);
}

export function collectRent(state: PlayerState, now: number): Result {
  if (!state.land.length) return fail("Buy a plot to earn rent.");
  const day = kampalaDateKey(now);
  const amount = rentFor(state.land, day);
  const r = post(state.ledger, `rent:${day}`, amount, "Rent from your land", now);
  if (!r.ok) return fail("You've collected today's rent. Come back tomorrow.");
  state.stats.earned += amount;
  return ok(`Rent collected: UGX ${amount.toLocaleString()}`);
}
