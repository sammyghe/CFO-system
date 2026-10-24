// Street life rules: boda bodas (riding and working), street food, building in your
// kiosk yard, goal rewards and referral rewards. Same rules as actions.ts: change
// state and return ok, or change nothing and return a reason. The server repeats
// the money checks in validate.ts on every save.

import { post } from "./ledger";
import { eventForTime } from "./daily";
import { kampalaDateKey, hashString, seededRandom } from "./time";
import { complete, type Result } from "./actions";
import type { GoalId, PlayerState, Ride } from "./state";
import { BODA, VENDORS, YARD_ITEMS, YARD_SLOTS, bodaFare, ridePay } from "../content/catalog";
import { RESIDENTS } from "../content/residents";
import { PLACES, placeById } from "../world/map";
import { LANDMARKS, LANDMARK_REWARD, LANDMARKS_FOR_GOAL } from "../content/landmarks";
import { tileDistance } from "../world/path";

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

// ---------- food boosts ----------

export function boostMultiplier(state: PlayerState, now: number): number {
  return state.boost && now < state.boost.until ? 1 + state.boost.pct / 100 : 1;
}

export function buyFood(state: PlayerState, vendorId: string, now: number): Result {
  const v = VENDORS.find((x) => x.id === vendorId);
  if (!v) return fail("That vendor isn't here.");
  const r = post(state.ledger, `food:${v.id}:${now}`, -v.price, v.product, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `You need UGX ${v.price.toLocaleString()}.` : "Already bought.");
  const current = state.boost && now < state.boost.until ? state.boost : null;
  // a better meal replaces a smaller one; the same or smaller meal adds time
  if (!current || v.boostPct >= current.pct) state.boost = { until: Math.max(current?.until ?? now, now) + v.boostMinutes * 60_000, pct: v.boostPct, label: v.product };
  else current.until += v.boostMinutes * 30_000;
  if (v.id === "rolex") complete(state, "rolex");
  return ok(`${v.product} from ${v.seller}. +${v.boostPct}% pay on deliveries and rides for ${v.boostMinutes} min.`);
}

// ---------- boda: taking one ----------

export function fareTo(from: { x: number; y: number }, placeId: string): number {
  const p = placeById(placeId);
  return p ? bodaFare(tileDistance(from, p)) : 0;
}

/** Pays the fare for a boda ride to a place. The game then carries the player there. */
export function payFare(state: PlayerState, placeId: string, from: { x: number; y: number }, now: number): Result {
  const p = placeById(placeId);
  if (!p) return fail("Unknown place.");
  if (tileDistance(from, p) < 3) return fail("That's just here. Walk it.");
  const fare = fareTo(from, placeId);
  const r = post(state.ledger, `fare:${now}`, -fare, `Boda to ${p.name}`, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `The fare is UGX ${fare.toLocaleString()}. You don't have enough.` : "Already paid.");
  complete(state, "boda");
  return ok(`Boda to ${p.name}: UGX ${fare.toLocaleString()}. Hold on!`);
}

// ---------- boda: working as a rider ----------

export function hasBoda(state: PlayerState, now: number): boolean {
  return state.bodaRent === kampalaDateKey(now);
}

export function rentBoda(state: PlayerState, now: number): Result {
  const today = kampalaDateKey(now);
  if (state.bodaRent === today) return fail("You already have a boda today.");
  const r = post(state.ledger, `bodarent:${today}`, -BODA.rentPrice, "Boda rent for the day", now);
  if (!r.ok) return fail(r.error === "insufficient" ? `Boda rent is UGX ${BODA.rentPrice.toLocaleString()} a day.` : "Already rented today.");
  state.bodaRent = today;
  return ok("The boda is yours until midnight. Passengers are waiting.");
}

export interface RideOffer {
  id: string;
  passengerId: string;
  passenger: string;
  fromId: string;
  toId: string;
  pay: number;
  distance: number;
}

export function ridesToday(state: PlayerState, now: number): number {
  const prefix = `ride:${kampalaDateKey(now)}:`;
  return state.ledger.entries.filter((e) => e.key.startsWith(prefix)).length;
}

export function rideOffers(state: PlayerState, now: number): RideOffer[] {
  const today = kampalaDateKey(now);
  if (state.ridesOffers.date !== today) state.ridesOffers = { date: today, seq: 0 };
  const rand = seededRandom(hashString(`ride:${state.id}:${today}:${state.ridesOffers.seq}`));
  const mult = eventForTime(now).jobBonus * boostMultiplier(state, now);
  const out: RideOffer[] = [];
  let guard = 0;
  while (out.length < 3 && guard++ < 200) {
    const a = PLACES[Math.floor(rand() * PLACES.length)];
    const b = PLACES[Math.floor(rand() * PLACES.length)];
    const who = RESIDENTS[Math.floor(rand() * RESIDENTS.length)];
    const distance = tileDistance(a, b);
    if (a.id === b.id || distance < 8 || out.some((o) => o.passengerId === who.id || o.fromId === a.id)) continue;
    out.push({ id: `ride:${today}:${state.ridesOffers.seq}:${out.length}`, passengerId: who.id, passenger: who.name, fromId: a.id, toId: b.id, pay: ridePay(distance, mult), distance });
  }
  return out;
}

export function acceptRide(state: PlayerState, offerId: string, now: number): Result {
  if (!hasBoda(state, now)) return fail("Rent a boda for the day first.");
  if (state.ride) return fail("Finish your current ride first.");
  if (state.job) return fail("Finish your delivery first.");
  if (ridesToday(state, now) >= BODA.ridesPerDay) return fail(`That's ${BODA.ridesPerDay} rides today. Rest, and ride again tomorrow.`);
  const o = rideOffers(state, now).find((x) => x.id === offerId);
  if (!o) return fail("That passenger found another boda.");
  state.ride = { id: o.id, passengerId: o.passengerId, passenger: o.passenger, fromId: o.fromId, toId: o.toId, pay: o.pay, stage: "pickup", acceptedAt: now };
  return ok(`${o.passenger} is waiting at ${placeById(o.fromId)?.name}.`);
}

export function dropRide(state: PlayerState): Result {
  if (!state.ride) return fail("No passenger.");
  state.ride = null;
  state.ridesOffers.seq += 1;
  return ok("Ride cancelled.");
}

export function rideTarget(ride: Ride) {
  return placeById(ride.stage === "pickup" ? ride.fromId : ride.toId);
}

export function rideArrive(state: PlayerState, placeId: string, now: number): Result | null {
  const ride = state.ride;
  if (!ride) return null;
  if (ride.stage === "pickup" && placeId === ride.fromId) {
    ride.stage = "dropoff";
    return ok(`${ride.passenger} hops on. Take them to ${placeById(ride.toId)?.name}.`);
  }
  if (ride.stage === "dropoff" && placeId === ride.toId) {
    const n = ridesToday(state, now);
    const key = `ride:${kampalaDateKey(now)}:${n}`;
    state.ride = null;
    state.ridesOffers.seq += 1;
    if (n >= BODA.ridesPerDay) return fail("You've done all your rides for today.");
    const r = post(state.ledger, key, ride.pay, `Boda ride: ${ride.passenger}`, now);
    if (!r.ok) return fail("That ride was already paid.");
    state.xp += BODA.xpPerRide;
    state.stats.earned += ride.pay;
    complete(state, "rider");
    return ok(`${ride.passenger} pays you. +UGX ${ride.pay.toLocaleString()}`);
  }
  return null;
}

// ---------- building in the kiosk yard ----------

export function yardIncome(state: PlayerState): number {
  if (!state.kiosk) return 0;
  return state.yard.reduce((sum, id) => sum + (YARD_ITEMS.find((i) => i.id === id)?.incomeBonus ?? 0), 0);
}

export function buildInYard(state: PlayerState, slot: number, itemId: string, now: number): Result {
  const k = state.kiosk;
  if (!k) return fail("Lease a kiosk to get a yard.");
  if (!Number.isInteger(slot) || slot < 0 || slot >= YARD_SLOTS) return fail("Pick a spot in your yard.");
  const item = YARD_ITEMS.find((i) => i.id === itemId);
  if (!item) return fail("Unknown item.");
  if (state.yard[slot] === itemId) return fail("That's already there.");
  const r = post(state.ledger, `build:${k.plotId}:${slot}:${item.id}:${now}`, -item.price, `Built: ${item.name}`, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `You need UGX ${item.price.toLocaleString()}.` : "Already built.");
  state.yard[slot] = item.id;
  complete(state, "build");
  return ok(`${item.name} built.`);
}

export function clearYardSlot(state: PlayerState, slot: number): Result {
  if (!state.yard[slot]) return fail("That spot is empty.");
  state.yard[slot] = null;
  return ok("Cleared.");
}

// ---------- goal rewards ----------

export const GOAL_REWARDS: Record<GoalId, number> = {
  walk: 500, delivery: 1_000, pothole: 1_000, earn25: 2_000, kiosk: 2_000, paint: 500, profile: 500,
  snap: 1_000, share: 1_500, boda: 500, rolex: 500, rider: 1_500, build: 1_000, landmarks: 2_000,
};

// ---------- landmarks ----------

/** First time a player looks at a landmark: small reward, and the 5-landmark goal. */
export function discoverLandmark(state: PlayerState, id: string, now: number): Result | null {
  const lm = LANDMARKS.find((l) => l.id === id);
  if (!lm || state.landmarks.includes(id)) return null;
  state.landmarks.push(id);
  post(state.ledger, `landmark:${id}`, LANDMARK_REWARD, `Discovered ${lm.name}`, now);
  state.xp += 3;
  if (state.landmarks.length >= LANDMARKS_FOR_GOAL) complete(state, "landmarks");
  return ok(`New landmark: ${lm.name}. +UGX ${LANDMARK_REWARD}`);
}

export function goalClaimed(state: PlayerState, id: GoalId): boolean {
  return state.ledger.entries.some((e) => e.key === `goal:${id}`);
}

export function claimGoal(state: PlayerState, id: GoalId, now: number): Result {
  if (!state.goals.includes(id)) return fail("Finish the goal first.");
  const amount = GOAL_REWARDS[id];
  const r = post(state.ledger, `goal:${id}`, amount, "Goal reward", now);
  if (!r.ok) return fail("Already claimed.");
  state.xp += 5;
  return ok(`Claimed UGX ${amount.toLocaleString()}`);
}

// ---------- referral rewards (confirmed by the server) ----------

export const REFERRAL_REWARD = 3_000;
export const REFERRED_BONUS = 2_000;

export function claimReferral(state: PlayerState, friendId: string, friendName: string, now: number): Result | null {
  const r = post(state.ledger, `referral:${friendId}`, REFERRAL_REWARD, `Friend joined: ${friendName}`, now);
  return r.ok ? ok(`${friendName} joined through your link and did their first job. +UGX ${REFERRAL_REWARD.toLocaleString()}`) : null;
}

export function claimReferredBonus(state: PlayerState, now: number): Result | null {
  const r = post(state.ledger, "referred", REFERRED_BONUS, "Joined through a friend", now);
  return r.ok ? ok(`Welcome bonus for joining through a friend: +UGX ${REFERRED_BONUS.toLocaleString()}`) : null;
}
