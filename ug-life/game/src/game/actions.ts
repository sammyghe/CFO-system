// Game rules. In this build they run on the device; with the online backend the
// same checks run on the server and the device only asks. Every function either
// changes state and returns ok, or changes nothing and returns a reason.

import { balanceOf, post } from "./ledger";
import { eventForDate, eventForTime } from "./daily";
import { kampalaDateKey, hashString, seededRandom, DAY_MS } from "./time";
import {
  DAILY_VISIT_BONUS, JOBS_PER_DAY, JOB_XP, KIOSK_LEASE_DAYS, KIOSK_LEASE_PRICE, KIOSK_MAX_UNCOLLECTED_DAYS,
  PRODUCTS, SIGN_COLORS, UPGRADES, WELCOME_GRANT, jobPay, kioskDailyIncome,
} from "./economy";
import { report } from "./civic";
import { checkDisplayName, checkFreeText, checkHandle, type Platform } from "./moderation";
import type { GoalId, Job, PlayerState } from "./state";
import { PLACES, PLOTS, placeById } from "../world/map";
import { tileDistance } from "../world/path";

export type Result = { ok: true; message: string } | { ok: false; message: string };

const ok = (message: string): Result => ({ ok: true, message });
const fail = (message: string): Result => ({ ok: false, message });

export const SALE_AMOUNT = 500;
export const AWAY_SHARE = 0.6;

export function complete(state: PlayerState, goal: GoalId): boolean {
  if (state.goals.includes(goal)) return false;
  state.goals.push(goal);
  return true;
}

function checkSavings(state: PlayerState) {
  if (balanceOf(state.ledger) >= 25_000) complete(state, "earn25");
}

/** Runs once when the game opens. Pays the welcome grant, daily bonus and kiosk income from days away. */
export function visit(state: PlayerState, now: number): string[] {
  const today = kampalaDateKey(now);
  const notes: string[] = [];
  if (post(state.ledger, "welcome", WELCOME_GRANT, "Welcome to the street", now).ok) notes.push(`Welcome grant: UGX ${WELCOME_GRANT.toLocaleString()}`);
  if (state.lastVisitDate !== today) {
    const prev = state.lastVisitDate;
    state.stats.daysVisited += 1;
    if (prev && post(state.ledger, `daily:${today}`, DAILY_VISIT_BONUS, "Daily visit", now).ok) notes.push(`Daily visit bonus: UGX ${DAILY_VISIT_BONUS.toLocaleString()}`);
    const away = collectAway(state, prev, now);
    if (away > 0) notes.push(`Your kiosk earned UGX ${away.toLocaleString()} while you were away`);
    state.lastVisitDate = today;
  }
  expireKiosk(state, now);
  return notes;
}

function collectAway(state: PlayerState, prevDate: string | null, now: number): number {
  const k = state.kiosk;
  if (!k || !prevDate) return 0;
  const today = kampalaDateKey(now);
  // Whole days strictly between the last visit and today, newest first, capped.
  const days: string[] = [];
  for (let key = addDays(today, -1); key > prevDate && days.length < KIOSK_MAX_UNCOLLECTED_DAYS; key = addDays(key, -1)) days.push(key);
  let total = 0;
  for (const key of days) {
    const dayStart = Date.parse(key + "T00:00:00Z") - 3 * 3600_000;
    if (dayStart >= k.leasedUntil || dayStart + DAY_MS <= k.leasedAt) continue;
    const amount = Math.round((kioskDailyIncome(k.upgrades, eventForDate(key).kioskBonus) * AWAY_SHARE) / 50) * 50;
    if (post(state.ledger, `away:${k.plotId}:${key}`, amount, "Kiosk sales while away", now).ok) total += amount;
  }
  checkSavings(state);
  return total;
}

export function addDays(dateKey: string, n: number): string {
  return new Date(Date.parse(dateKey + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

function expireKiosk(state: PlayerState, now: number) {
  if (state.kiosk && now > state.kiosk.leasedUntil) state.kiosk = null;
}

// ---------- Deliveries ----------

const ITEMS = ["a box of chapati", "a phone charger", "medicine for a student", "a crate of soda", "hair products", "a bag of matooke", "printed posters", "a speaker cable", "fresh passion juice", "a sack of cement"];

export interface Offer {
  id: string;
  fromId: string;
  toId: string;
  item: string;
  pay: number;
  distance: number;
}

export function jobOffers(state: PlayerState, now: number): Offer[] {
  const today = kampalaDateKey(now);
  if (state.offers.date !== today) state.offers = { date: today, seq: 0 };
  const rand = seededRandom(hashString(`${state.id}:${today}:${state.offers.seq}`));
  const bonus = eventForTime(now).jobBonus;
  const out: Offer[] = [];
  while (out.length < 3) {
    const a = PLACES[Math.floor(rand() * PLACES.length)];
    const b = PLACES[Math.floor(rand() * PLACES.length)];
    const distance = tileDistance(a, b);
    if (a.id === b.id || distance < 6 || out.some((o) => o.fromId === a.id)) continue;
    out.push({
      id: `job:${today}:${state.offers.seq}:${out.length}`,
      fromId: a.id,
      toId: b.id,
      item: ITEMS[Math.floor(rand() * ITEMS.length)],
      pay: jobPay(distance, bonus),
      distance,
    });
  }
  return out;
}

export function jobsLeftToday(state: PlayerState, now: number): number {
  const today = kampalaDateKey(now);
  return JOBS_PER_DAY - (state.jobsToday.date === today ? state.jobsToday.count : 0);
}

export function acceptJob(state: PlayerState, offerId: string, now: number): Result {
  if (state.job) return fail("Finish or drop your current delivery first.");
  if (jobsLeftToday(state, now) <= 0) return fail(`That's ${JOBS_PER_DAY} deliveries today. Come back tomorrow.`);
  const offer = jobOffers(state, now).find((o) => o.id === offerId);
  if (!offer) return fail("That delivery isn't available any more.");
  state.job = { id: offer.id, fromId: offer.fromId, toId: offer.toId, item: offer.item, pay: offer.pay, stage: "pickup", acceptedAt: now };
  return ok(`Pick up ${offer.item} at ${placeById(offer.fromId)?.name}.`);
}

export function dropJob(state: PlayerState): Result {
  if (!state.job) return fail("No delivery to drop.");
  state.job = null;
  state.offers.seq += 1;
  return ok("Delivery dropped. New offers are on the board.");
}

export function jobTarget(job: Job) {
  return placeById(job.stage === "pickup" ? job.fromId : job.toId);
}

/** Called when the player stands on a place tile. */
export function arriveAt(state: PlayerState, placeId: string, now: number): Result | null {
  const job = state.job;
  if (!job) return null;
  if (job.stage === "pickup" && placeId === job.fromId) {
    job.stage = "dropoff";
    return ok(`Picked up ${job.item}. Take it to ${placeById(job.toId)?.name}.`);
  }
  if (job.stage === "dropoff" && placeId === job.toId) {
    const r = post(state.ledger, job.id, job.pay, `Delivery: ${job.item}`, now);
    state.job = null;
    state.offers.seq += 1;
    if (!r.ok) return fail("This delivery was already paid.");
    const today = kampalaDateKey(now);
    state.jobsToday = { date: today, count: (state.jobsToday.date === today ? state.jobsToday.count : 0) + 1 };
    state.xp += JOB_XP;
    state.stats.deliveries += 1;
    state.stats.earned += job.pay;
    complete(state, "delivery");
    checkSavings(state);
    return ok(`Delivered. +UGX ${job.pay.toLocaleString()}`);
  }
  return null;
}

// ---------- Kiosk ----------

export function plotIsFree(state: PlayerState, plotId: string): boolean {
  const plot = PLOTS.find((p) => p.id === plotId);
  return !!plot && !plot.npcOwner && state.kiosk?.plotId !== plotId;
}

export function leaseKiosk(state: PlayerState, plotId: string, now: number): Result {
  expireKiosk(state, now);
  const plot = PLOTS.find((p) => p.id === plotId);
  if (!plot) return fail("That plot doesn't exist.");
  if (plot.npcOwner) return fail(`${plot.npcOwner.name} already runs this kiosk.`);
  if (state.kiosk) return fail("You already lease a kiosk.");
  const r = post(state.ledger, `lease:${plotId}:${kampalaDateKey(now)}`, -KIOSK_LEASE_PRICE, "Kiosk lease (7 days)", now);
  if (!r.ok) return fail(r.error === "insufficient" ? `You need UGX ${KIOSK_LEASE_PRICE.toLocaleString()}. Do a few deliveries first.` : "You already paid for this lease today.");
  state.kiosk = {
    plotId,
    name: state.tag.name ? `${state.tag.name.toUpperCase()}'S` : "MY KIOSK",
    color: SIGN_COLORS[0],
    product: PRODUCTS[0],
    leasedAt: now,
    leasedUntil: now + KIOSK_LEASE_DAYS * DAY_MS,
    upgrades: [],
    collectedThrough: null,
  };
  complete(state, "kiosk");
  return ok("The kiosk is yours for 7 days. Paint your sign.");
}

export function renewKiosk(state: PlayerState, now: number): Result {
  const k = state.kiosk;
  if (!k) return fail("You don't have a kiosk to renew.");
  const r = post(state.ledger, `renew:${k.plotId}:${kampalaDateKey(now)}`, -KIOSK_LEASE_PRICE, "Kiosk lease renewal", now);
  if (!r.ok) return fail(r.error === "insufficient" ? "Not enough money to renew yet." : "You already renewed today.");
  k.leasedUntil = Math.max(k.leasedUntil, now) + KIOSK_LEASE_DAYS * DAY_MS;
  return ok("Lease extended by 7 days.");
}

export function paintKiosk(state: PlayerState, name: string, color: string, product: string): Result {
  const k = state.kiosk;
  if (!k) return fail("Lease a kiosk first.");
  const n = checkDisplayName(name);
  if (!n.ok) return fail(n.reason);
  if (!(SIGN_COLORS as readonly string[]).includes(color)) return fail("Pick one of the paint colours.");
  if (!(PRODUCTS as readonly string[]).includes(product)) return fail("Pick what you sell from the list.");
  k.name = n.value.toUpperCase();
  k.color = color;
  k.product = product;
  complete(state, "paint");
  return ok("Fresh paint. Your sign is up.");
}

export function buyUpgrade(state: PlayerState, upgradeId: string, now: number): Result {
  const k = state.kiosk;
  if (!k) return fail("Lease a kiosk first.");
  const u = UPGRADES.find((x) => x.id === upgradeId);
  if (!u) return fail("Unknown upgrade.");
  if (k.upgrades.includes(u.id)) return fail("You already have that.");
  const r = post(state.ledger, `upgrade:${k.plotId}:${u.id}:${k.leasedAt}`, -u.price, u.name, now);
  if (!r.ok) return fail(r.error === "insufficient" ? `You need UGX ${u.price.toLocaleString()}.` : "Already bought.");
  k.upgrades.push(u.id);
  return ok(`${u.name} installed. Your kiosk now earns more each day.`);
}

export function kioskSalesToday(state: PlayerState, now: number): { count: number; max: number } {
  const k = state.kiosk;
  if (!k) return { count: 0, max: 0 };
  const today = kampalaDateKey(now);
  const prefix = `sale:${k.plotId}:${today}:`;
  const count = state.ledger.entries.filter((e) => e.key.startsWith(prefix)).length;
  const max = Math.floor(kioskDailyIncome(k.upgrades, eventForTime(now).kioskBonus) / SALE_AMOUNT);
  return { count, max };
}

/** A customer bought something at the player's kiosk. Capped per day so income can't run away. */
export function kioskSale(state: PlayerState, now: number): Result {
  expireKiosk(state, now);
  const k = state.kiosk;
  if (!k) return fail("No kiosk.");
  const { count, max } = kioskSalesToday(state, now);
  if (count >= max) return fail("Sold out for today.");
  const r = post(state.ledger, `sale:${k.plotId}:${kampalaDateKey(now)}:${count}`, SALE_AMOUNT, `Sale: ${k.product}`, now);
  if (!r.ok) return fail("Sale already recorded.");
  state.stats.earned += SALE_AMOUNT;
  checkSavings(state);
  return ok(`+UGX ${SALE_AMOUNT} at your kiosk`);
}

// ---------- Civic ----------

export function reportPothole(state: PlayerState, now: number): Result {
  const r = report(state.civic, state.id, now);
  if (!r.ok) return fail(r.error === "closed" ? "It's already fixed." : "You already reported it. Two more residents need to report it.");
  complete(state, "pothole");
  state.xp += 5;
  return ok("Reported to the Ward 7 Works Office (fictional). Other residents can add their reports.");
}

export function residentReport(state: PlayerState, residentId: string, now: number): boolean {
  return report(state.civic, residentId, now).ok;
}

// ---------- Ug Tag ----------

export function setTag(state: PlayerState, name: string, status: string): Result {
  const n = checkDisplayName(name);
  if (!n.ok) return fail(n.reason);
  const s = checkFreeText(status, 60);
  if (!s.ok) return fail(s.reason);
  state.tag.name = n.value;
  state.tag.status = s.value;
  return ok("Ug Tag saved.");
}

export function addSocial(state: PlayerState, platform: Platform, handle: string): Result {
  if (state.tag.socials.length >= 3) return fail("You can show up to 3 socials.");
  if (state.tag.socials.some((s) => s.platform === platform)) return fail("You already added that platform.");
  const h = checkHandle(platform, handle);
  if (!h.ok) return fail(h.reason);
  state.tag.socials.push({ platform, handle: h.value, verified: false });
  complete(state, "profile");
  return ok("Added. It shows as unverified until sign-in verification goes live.");
}

export function removeSocial(state: PlayerState, platform: Platform): void {
  state.tag.socials = state.tag.socials.filter((s) => s.platform !== platform);
}

export function addTicket(state: PlayerState, category: PlayerState["tickets"][number]["category"], text: string, now: number): Result {
  const t = text.trim();
  if (t.length < 5) return fail("Tell us a little more (at least 5 characters).");
  if (t.length > 1000) return fail("Keep it under 1,000 characters.");
  state.tickets.push({ id: `t-${now}`, category, text: t, at: now, status: "saved" });
  return ok("Saved.");
}
