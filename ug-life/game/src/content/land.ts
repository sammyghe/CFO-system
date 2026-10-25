// Kampala land: buy cheap plots in real neighbourhoods, build them up, collect
// rent. Every day one area is "hot": plots cost more there but rent doubles.
// Prices rise as an area fills up, so getting in early pays. The server holds who
// owns which plot (one owner each) and checks every price and rent in the save.

import { hashString } from "../game/time";

export interface Area {
  id: string;
  name: string;
  blurb: string;
  /** Price of the first plot; each plot sold makes the next one dearer. */
  basePrice: number;
  plots: number;
}

export const LAND_AREAS: Area[] = [
  { id: "bwaise", name: "Bwaise", blurb: "Busy, low-lying and cheap. Everyone starts somewhere.", basePrice: 3_000, plots: 16 },
  { id: "kalerwe", name: "Kalerwe", blurb: "The big market for food from upcountry.", basePrice: 3_500, plots: 16 },
  { id: "kisenyi", name: "Kisenyi", blurb: "Workshops, wholesalers and the bus park nearby.", basePrice: 4_000, plots: 14 },
  { id: "nakulabye", name: "Nakulabye", blurb: "Between Makerere and Kasubi, full of students.", basePrice: 5_000, plots: 14 },
  { id: "kikoni", name: "Kikoni", blurb: "Hostels and kiosks right behind Makerere.", basePrice: 6_000, plots: 12 },
  { id: "wandegeya", name: "Wandegeya", blurb: "Our street. Never quiet, day or night.", basePrice: 8_000, plots: 12 },
  { id: "najjera", name: "Najjera", blurb: "New homes going up on every corner.", basePrice: 7_000, plots: 14 },
  { id: "kansanga", name: "Kansanga", blurb: "Nightlife and students from the universities nearby.", basePrice: 9_000, plots: 12 },
  { id: "ntinda", name: "Ntinda", blurb: "Shops, offices and busy trading centre.", basePrice: 11_000, plots: 12 },
  { id: "kabalagala", name: "Kabalagala", blurb: "Music, food and late nights.", basePrice: 12_000, plots: 10 },
  { id: "bukoto", name: "Bukoto", blurb: "Quiet streets close to the city.", basePrice: 15_000, plots: 10 },
  { id: "kololo", name: "Kololo", blurb: "The big gardens on the hill. Expensive, but the rent!", basePrice: 25_000, plots: 8 },
];

export interface LandLevel {
  level: number;
  name: string;
  /** Cost to build this level (from the one before). */
  cost: number;
  /** Rent a day. */
  rent: number;
}

export const LAND_LEVELS: LandLevel[] = [
  { level: 0, name: "Empty plot", cost: 0, rent: 50 },
  { level: 1, name: "Banana garden", cost: 1_500, rent: 150 },
  { level: 2, name: "Mud-and-wattle house", cost: 4_000, rent: 400 },
  { level: 3, name: "Muzigo (rooms to rent)", cost: 10_000, rent: 1_000 },
  { level: 4, name: "Two-storey flats", cost: 25_000, rent: 2_500 },
  { level: 5, name: "Apartments with a shop below", cost: 60_000, rent: 6_000 },
];

export const MAX_LAND = 6;
export const HOT_PRICE = 1.5;
export const HOT_RENT = 2;
/** Each plot sold in an area makes the next one 12% dearer. */
export const LAND_PRICE_STEP = 0.12;

export function areaById(id: string) {
  return LAND_AREAS.find((a) => a.id === id);
}

/** Today's hot area, the same for everyone on a Kampala date. */
export function hotArea(dateKey: string): Area {
  return LAND_AREAS[hashString("ug-life:hot:" + dateKey) % LAND_AREAS.length];
}

/** Price of the next plot in an area, given how many are already owned. */
export function landPrice(areaId: string, sold: number, dateKey: string): number {
  const a = areaById(areaId);
  if (!a) return Infinity;
  const hot = hotArea(dateKey).id === a.id ? HOT_PRICE : 1;
  return Math.round((a.basePrice * (1 + LAND_PRICE_STEP * sold) * hot) / 100) * 100;
}

export interface OwnedLand {
  area: string;
  slot: number;
  level: number;
  /** What was paid for the plot (checked by the server). */
  paid: number;
  boughtAt: number;
}

/** A day's rent for these plots on a Kampala date (hot area doubles). */
export function rentFor(land: OwnedLand[], dateKey: string): number {
  const hot = hotArea(dateKey).id;
  return land.reduce((sum, l) => sum + (LAND_LEVELS[l.level]?.rent ?? 0) * (l.area === hot ? HOT_RENT : 1), 0);
}
