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
