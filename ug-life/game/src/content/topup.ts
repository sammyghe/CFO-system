// Top-up packs: real UGX paid with mobile money → game shillings. One way only.

export interface TopUpPack {
  id: string;
  /** Real UGX the player pays. */
  price: number;
  /** Game shillings they get. */
  credit: number;
}

export const TOPUP_PACKS: TopUpPack[] = [
  { id: "p1", price: 1_000, credit: 1_000 },
  { id: "p5", price: 5_000, credit: 5_500 },
  { id: "p10", price: 10_000, credit: 12_000 },
  { id: "p20", price: 20_000, credit: 25_000 },
];

/** Most real money one player can put in a day (protects players and stops fraud). */
export const TOPUP_DAILY_LIMIT = 50_000;

// Crypto top-ups: USDT on TRON (TRC20). Smallest pack is $2 because sending USDT
// costs about $1 in network fees; bigger packs get the same bonuses as mobile money.

export interface CryptoPack {
  id: string;
  usd: number;
  /** Extra game shillings, in percent. */
  bonus: number;
}

export const CRYPTO_PACKS: CryptoPack[] = [
  { id: "c2", usd: 2, bonus: 0 },
  { id: "c5", usd: 5, bonus: 10 },
  { id: "c10", usd: 10, bonus: 20 },
];

/** UGX per USDT when the Control Room hasn't set one. */
export const DEFAULT_USD_UGX = 3_600;
/** A crypto deposit must arrive within this long of asking for the address. */
export const CRYPTO_WINDOW_MS = 2 * 3600_000;

/** The UGX value (for the daily limit) and the game shillings a crypto pack gives. */
export function cryptoCredit(p: CryptoPack, rate: number): { price: number; credit: number } {
  const price = Math.round(p.usd * rate);
  return { price, credit: Math.round((price * (100 + p.bonus)) / 100 / 100) * 100 };
}
