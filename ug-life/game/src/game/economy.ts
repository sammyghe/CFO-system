// All prices and payouts in simulated UGX. Simulated UGX is game currency only:
// it cannot be bought, sold, withdrawn or exchanged.

export const WELCOME_GRANT = 5_000;
export const DAILY_VISIT_BONUS = 2_000;

export const JOB_BASE = 1_500;
export const JOB_PER_TILE = 120;
export const JOB_MAX = 4_500;
export const JOBS_PER_DAY = 10;
export const JOB_XP = 10;

export const KIOSK_LEASE_PRICE = 25_000;
export const KIOSK_LEASE_DAYS = 7;
export const KIOSK_BASE_INCOME = 3_000;
/** Unclaimed kiosk income stops piling up after this many days. */
export const KIOSK_MAX_UNCOLLECTED_DAYS = 3;

export interface Upgrade {
  id: string;
  name: string;
  price: number;
  incomeBonus: number;
  blurb: string;
}

export const UPGRADES: Upgrade[] = [
  { id: "shade", name: "Sunshade umbrella", price: 8_000, incomeBonus: 1_500, blurb: "Customers stop when there's shade." },
  { id: "solar", name: "Solar light", price: 12_000, incomeBonus: 2_000, blurb: "Stay open after dark. Lights up at night." },
  { id: "speaker", name: "Small speaker", price: 6_000, incomeBonus: 1_000, blurb: "Music pulls people in." },
];

export const PRODUCTS = ["Rolex & chapati", "Fresh juice", "Airtime & data", "Phone repair", "Second-hand clothes", "Roasted maize"] as const;
export type Product = (typeof PRODUCTS)[number];

export const SIGN_COLORS = ["#1f4fd1", "#b4442a", "#2f7a4b", "#d9a400", "#7a2fa8", "#13202b"] as const;

export function jobPay(distanceTiles: number, bonus: number): number {
  const raw = JOB_BASE + Math.max(0, Math.round(distanceTiles)) * JOB_PER_TILE;
  return Math.round((Math.min(raw, JOB_MAX) * bonus) / 50) * 50;
}

export function kioskDailyIncome(upgradeIds: string[], kioskBonus: number): number {
  let base = KIOSK_BASE_INCOME;
  for (const id of upgradeIds) base += UPGRADES.find((u) => u.id === id)?.incomeBonus ?? 0;
  return Math.round((base * kioskBonus) / 50) * 50;
}

export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 20;
}

export function formatUGX(n: number): string {
  return "UGX " + Math.round(n).toLocaleString("en-UG");
}
