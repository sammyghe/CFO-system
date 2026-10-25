// Everything players can buy, eat, ride or build, in one place.
// To add something new, add one entry here; see CONTENT.md for the full guide.

// ---------- boda boda ----------

export const BODA = {
  /** Daily rent to work as a rider. */
  rentPrice: 3_000,
  /** Passenger fare when you take a boda somewhere. */
  fareBase: 500,
  farePerTile: 80,
  /** What a rider earns per passenger. */
  payBase: 1_000,
  payPerTile: 110,
  payMax: 4_000,
  ridesPerDay: 15,
  speed: 5.5,
  walkSpeed: 3.2,
  xpPerRide: 8,
};

export function bodaFare(distanceTiles: number): number {
  return Math.round((BODA.fareBase + distanceTiles * BODA.farePerTile) / 100) * 100;
}

export function ridePay(distanceTiles: number, multiplier: number): number {
  const raw = Math.min(BODA.payMax, BODA.payBase + distanceTiles * BODA.payPerTile);
  return Math.round((raw * multiplier) / 50) * 50;
}

// ---------- street food ----------

export interface Vendor {
  id: string;
  /** Who sells it. */
  seller: string;
  /** What the cart is called on the street. */
  name: string;
  product: string;
  blurb: string;
  price: number;
  /** Extra pay on deliveries and boda rides while you're full. */
  boostPct: number;
  boostMinutes: number;
  /** Tile the cart stands on, and the tile you walk to. */
  at: { x: number; y: number };
  stand: { x: number; y: number };
  cart: "rolex" | "maize" | "fruit";
}

export const VENDORS: Vendor[] = [
  {
    id: "rolex", seller: "Musa", name: "Musa's Rolex", product: "Rolex",
    blurb: "Chapati rolled with eggs, tomato, onion and cabbage, cooked while you wait. Fills you up for a long shift.",
    price: 2_000, boostPct: 20, boostMinutes: 30, at: { x: 7, y: 12 }, stand: { x: 7, y: 11 }, cart: "rolex",
  },
  {
    id: "maize", seller: "Auntie Sarah", name: "Roasted maize", product: "Roasted maize",
    blurb: "Maize roasted on charcoal right by the road. A quick snack between jobs.",
    price: 1_000, boostPct: 10, boostMinutes: 15, at: { x: 15, y: 12 }, stand: { x: 16, y: 11 }, cart: "maize",
  },
  {
    id: "fruit", seller: "Kizza", name: "Fresh fruit", product: "Pineapple slices",
    blurb: "Cold pineapple and watermelon slices on a hot day.",
    price: 800, boostPct: 5, boostMinutes: 20, at: { x: 13, y: 14 }, stand: { x: 13, y: 15 }, cart: "fruit",
  },
];

// ---------- your yard (things you build around your kiosk) ----------

// ---------- cheap snacks (sold at the carts and Mama Rose's) ----------

export interface Snack {
  id: string;
  name: string;
  price: number;
  boostPct: number;
  boostMinutes: number;
  icon: string;
  /** Vendor ids from VENDORS, or "chapati" for Mama Rose's shop. */
  soldAt: string[];
}

export const SNACKS: Snack[] = [
  { id: "mandazi", name: "Mandazi", price: 200, boostPct: 2, boostMinutes: 10, icon: "🍩", soldAt: ["chapati", "rolex"] },
  { id: "chai", name: "Chai (spiced tea)", price: 300, boostPct: 3, boostMinutes: 10, icon: "🍵", soldAt: ["chapati"] },
  { id: "water", name: "Bottle of water", price: 300, boostPct: 2, boostMinutes: 10, icon: "💧", soldAt: ["fruit", "maize"] },
  { id: "sugarcane", name: "Sugarcane", price: 300, boostPct: 3, boostMinutes: 10, icon: "🎋", soldAt: ["fruit"] },
  { id: "chapati", name: "Chapati", price: 500, boostPct: 6, boostMinutes: 15, icon: "🫓", soldAt: ["chapati", "rolex"] },
  { id: "samosa", name: "Samosa", price: 500, boostPct: 5, boostMinutes: 15, icon: "🥟", soldAt: ["chapati", "maize"] },
  { id: "gonja", name: "Roasted gonja", price: 500, boostPct: 5, boostMinutes: 15, icon: "🍌", soldAt: ["maize"] },
  { id: "mango", name: "Mango", price: 500, boostPct: 4, boostMinutes: 15, icon: "🥭", soldAt: ["fruit"] },
  { id: "soda", name: "Cold soda", price: 1_000, boostPct: 5, boostMinutes: 20, icon: "🥤", soldAt: ["chapati", "fruit"] },
  { id: "kikomando", name: "Kikomando (chapati and beans)", price: 1_500, boostPct: 12, boostMinutes: 25, icon: "🫘", soldAt: ["rolex", "chapati"] },
];

export interface YardItem {
  id: string;
  name: string;
  price: number;
  blurb: string;
  /** Extra kiosk customers a day, in UGX of sales. */
  incomeBonus: number;
}

export const YARD_ITEMS: YardItem[] = [
  { id: "chairs", name: "Plastic chairs", price: 2_000, blurb: "Somewhere for customers to sit.", incomeBonus: 300 },
  { id: "plant", name: "Potted plant", price: 1_000, blurb: "A bit of green.", incomeBonus: 0 },
  { id: "banana", name: "Banana plant", price: 1_500, blurb: "Every compound needs one.", incomeBonus: 0 },
  { id: "crates", name: "Soda crates", price: 1_500, blurb: "Stacked crates. Looks like business.", incomeBonus: 200 },
  { id: "board", name: "Menu board", price: 1_500, blurb: "Chalkboard with today's prices.", incomeBonus: 300 },
  { id: "lights", name: "String lights", price: 3_000, blurb: "Glows at night. Customers come after dark.", incomeBonus: 400 },
  { id: "flag", name: "Uganda flag", price: 1_000, blurb: "Black, yellow and red, flying high.", incomeBonus: 0 },
  { id: "jerrycan", name: "Water jerrycans", price: 500, blurb: "The yellow jerrycans every street has.", incomeBonus: 0 },
  { id: "bicycle", name: "Parked bicycle", price: 2_500, blurb: "Your delivery bike, parked up.", incomeBonus: 0 },
];

export const YARD_SLOTS = 5;

/** Tiles of a plot's yard: the row in front and the column beside it. */
export function yardTiles(plot: { x: number; y: number }): { x: number; y: number }[] {
  return [
    { x: plot.x, y: plot.y + 2 },
    { x: plot.x + 1, y: plot.y + 2 },
    { x: plot.x + 2, y: plot.y },
    { x: plot.x + 2, y: plot.y + 1 },
    { x: plot.x + 2, y: plot.y + 2 },
  ];
}

// ---------- more people on the street ----------

const FIRST = ["Joseph", "Grace", "Peter", "Florence", "Moses", "Esther", "Ronald", "Sharon", "Isaac", "Joan", "Ivan", "Patience", "Henry", "Agnes", "Allan", "Doreen"];
const ROLES = [
  "Student at the university", "Shop assistant", "Mobile money customer", "Walking to campus", "Selling airtime", "Waiting for a taxi",
  "On lunch break", "Market trader", "Looking for a boda", "Carrying shopping", "Hostel resident", "Visiting from Mukono",
];

/** Passers-by: fill the street. Deterministic so everyone sees the same people. */
export function passersBy(count: number) {
  const skins = ["#f1c7a5", "#c68a62", "#a86b45", "#8d5a3b", "#6b4228", "#4e3020"];
  const shirts = ["#1f4fd1", "#b4442a", "#2f7a4b", "#f2d23c", "#7a2fa8", "#13202b", "#f4efe4", "#e0457b", "#e07a1f", "#3b8ea5"];
  const hairs = ["short", "bun", "braids", "cap"] as const;
  const pants = ["#2b2f38", "#3a3f4a", "#1f4fd1", "#5a3b24", "#13202b"];
  return Array.from({ length: count }, (_, i) => ({
    id: `pb-${i}`,
    name: FIRST[i % FIRST.length],
    role: ROLES[(i * 7) % ROLES.length],
    look: { skin: skins[(i * 5) % skins.length], shirt: shirts[(i * 3) % shirts.length], hair: hairs[(i * 7) % hairs.length], pants: pants[i % pants.length] },
  }));
}
