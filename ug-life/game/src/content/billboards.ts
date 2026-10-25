// Billboards anyone on the street sees. Players rent a spot by the day with game
// money; Sammy books real local brands from the Control Room (brands take priority).

export interface BillboardSlot {
  id: string;
  name: string;
  /** Game UGX a day for players. */
  pricePerDay: number;
  /** Street billboards stand on a tile; the pharmacy one is on the roof. */
  at: { x: number; y: number } | null;
}

export const BILLBOARD_SLOTS: BillboardSlot[] = [
  { id: "pharmacy", name: "Pharmacy rooftop (the big one)", pricePerDay: 8_000, at: null },
  { id: "stage", name: "Taxi stage billboard", pricePerDay: 3_000, at: { x: 2, y: 15 } },
  { id: "market", name: "Kiosk row billboard", pricePerDay: 3_000, at: { x: 31, y: 15 } },
];

export const BILLBOARD_COLORS = ["#1f4fd1", "#b4442a", "#2f7a4b", "#d9a400", "#7a2fa8", "#13202b", "#e0457b", "#e07a1f"] as const;
export const BILLBOARD_MAX_DAYS = 3;
export const BILLBOARD_TEXT = 26;
export const BILLBOARD_SUB = 40;

export interface BillboardAd {
  slot: string;
  kind: "player" | "brand";
  owner: string;
  ownerId?: string;
  text: string;
  sub: string;
  color: string;
  until: number;
  /** Brands only: a link Sammy set in the Control Room. */
  link?: string;
}

export function slotById(id: string) {
  return BILLBOARD_SLOTS.find((s) => s.id === id);
}
