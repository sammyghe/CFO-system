// Billboards anyone on the street sees. Players rent a spot by the day with game
// money; Sammy books real local brands from the Control Room (brands take priority).

export interface BillboardSlot {
  id: string;
  name: string;
  /** Game UGX a day for players. */
  pricePerDay: number;
  /** Street billboards stand on a tile; the pharmacy one is on the roof. */
  at: { x: number; y: number } | null;
  /** Area it stands in (world/areas.ts). */
  area: string;
}

export const BILLBOARD_SLOTS: BillboardSlot[] = [
  { id: "pharmacy", name: "Wandegeya: pharmacy rooftop (the big one)", pricePerDay: 8_000, at: null, area: "wandegeya" },
  { id: "stage", name: "Wandegeya: taxi stage", pricePerDay: 3_000, at: { x: 2, y: 15 }, area: "wandegeya" },
  { id: "market", name: "Wandegeya: kiosk row", pricePerDay: 3_000, at: { x: 31, y: 15 }, area: "wandegeya" },
  { id: "mk-square", name: "Makerere: Freedom Square", pricePerDay: 4_000, at: { x: 30, y: 15 }, area: "makerere" },
  { id: "ow-market", name: "Owino: market entrance", pricePerDay: 3_500, at: { x: 25, y: 15 }, area: "owino" },
  { id: "kb-club", name: "Kabalagala: outside Club 256", pricePerDay: 5_000, at: { x: 10, y: 15 }, area: "kabalagala" },
  { id: "kb-strip", name: "Kabalagala: the strip", pricePerDay: 4_000, at: { x: 30, y: 15 }, area: "kabalagala" },
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
