import { hashString, kampalaDateKey } from "./time";

export interface StreetEvent {
  id: string;
  title: string;
  blurb: string;
  /** Multiplier on delivery pay, e.g. 1.2 = +20%. */
  jobBonus: number;
  rain: boolean;
  /** Extra kiosk customers, as a multiplier on daily kiosk income. */
  kioskBonus: number;
}

export const STREET_EVENTS: StreetEvent[] = [
  { id: "market", title: "Market day", blurb: "Traders are restocking. Deliveries pay 20% more today.", jobBonus: 1.2, rain: false, kioskBonus: 1 },
  { id: "rain", title: "Rainy afternoon", blurb: "The drains are full and the pothole is flooding. Couriers earn 10% extra.", jobBonus: 1.1, rain: true, kioskBonus: 0.9 },
  { id: "music", title: "Music night at Studio 256", blurb: "A crowd is coming to the street tonight. Kiosks sell 25% more.", jobBonus: 1, rain: false, kioskBonus: 1.25 },
  { id: "campus", title: "Campus rush", blurb: "Students are back. Kiosks sell 15% more and deliveries pay 10% more.", jobBonus: 1.1, rain: false, kioskBonus: 1.15 },
  { id: "quiet", title: "Quiet day", blurb: "A slow day on the street. A good day to paint your sign.", jobBonus: 1, rain: false, kioskBonus: 1 },
  { id: "drizzle", title: "Morning drizzle", blurb: "Light rain until the sun comes out. Normal pay.", jobBonus: 1, rain: true, kioskBonus: 1 },
];

export function eventForDate(dateKey: string): StreetEvent {
  return STREET_EVENTS[hashString("ug-life:" + dateKey) % STREET_EVENTS.length];
}

export function eventForTime(ts: number): StreetEvent {
  return eventForDate(kampalaDateKey(ts));
}
