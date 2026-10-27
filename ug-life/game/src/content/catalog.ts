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
  /** Energy it gives back. */
  energy: number;
  /** Tile the cart stands on, and the tile you walk to. */
  at: { x: number; y: number };
  stand: { x: number; y: number };
  cart: "rolex" | "maize" | "fruit";
  /** Area the cart stands in (world/areas.ts); missing = Wandegeya. */
  area?: string;
}

export const VENDORS: Vendor[] = [
  {
    id: "rolex", seller: "Musa", name: "Musa's Rolex", product: "Rolex",
    blurb: "Chapati rolled with eggs, tomato, onion and cabbage, cooked while you wait. Fills you up for a long shift.",
    price: 2_000, boostPct: 20, boostMinutes: 30, energy: 45, at: { x: 7, y: 12 }, stand: { x: 7, y: 11 }, cart: "rolex",
  },
  {
    id: "maize", seller: "Auntie Sarah", name: "Roasted maize", product: "Roasted maize",
    blurb: "Maize roasted on charcoal right by the road. A quick snack between jobs.",
    price: 1_000, boostPct: 10, boostMinutes: 15, energy: 20, at: { x: 15, y: 12 }, stand: { x: 16, y: 11 }, cart: "maize",
  },
  {
    id: "fruit", seller: "Kizza", name: "Fresh fruit", product: "Pineapple slices",
    blurb: "Cold pineapple and watermelon slices on a hot day.",
    price: 800, boostPct: 5, boostMinutes: 20, energy: 15, at: { x: 13, y: 14 }, stand: { x: 13, y: 15 }, cart: "fruit",
  },
  {
    id: "kb-rolex", seller: "Jjumba", name: "Jjumba's Late-Night Rolex", product: "Rolex",
    blurb: "The rolex that saves Kabalagala nights. Two eggs, extra cabbage, eaten standing up.",
    price: 2_000, boostPct: 20, boostMinutes: 30, energy: 45, at: { x: 13, y: 12 }, stand: { x: 13, y: 11 }, cart: "rolex", area: "kabalagala",
  },
  {
    id: "kb-muchomo", seller: "Ssebunya", name: "Muchomo grill", product: "Muchomo skewers",
    blurb: "Goat and beef skewers over charcoal, with a little salt and a lot of smoke.",
    price: 1_500, boostPct: 15, boostMinutes: 25, energy: 30, at: { x: 9, y: 12 }, stand: { x: 9, y: 11 }, cart: "maize", area: "kabalagala",
  },
  {
    id: "mk-chips", seller: "Auntie Grace", name: "Campus Chips", product: "Chips and chicken",
    blurb: "Students' favourite after lectures. Hot chips, a piece of chicken, tomato sauce.",
    price: 3_000, boostPct: 18, boostMinutes: 35, energy: 55, at: { x: 37, y: 12 }, stand: { x: 37, y: 11 }, cart: "rolex", area: "makerere",
  },
  {
    id: "ow-muwogo", seller: "Nakku", name: "Roasted muwogo", product: "Roasted cassava",
    blurb: "Cassava roasted on charcoal with a pinch of salt and chilli. Cheap and filling.",
    price: 500, boostPct: 5, boostMinutes: 15, energy: 18, at: { x: 25, y: 12 }, stand: { x: 25, y: 11 }, cart: "maize", area: "owino",
  },
  {
    id: "ow-chips", seller: "Hassan", name: "Market Chips", product: "Chips and sausage",
    blurb: "Chips with a sausage and kachumbari, wrapped in yesterday's newspaper.",
    price: 2_000, boostPct: 12, boostMinutes: 25, energy: 40, at: { x: 28, y: 13 }, stand: { x: 28, y: 12 }, cart: "rolex", area: "owino",
  },
];

// ---------- your yard (things you build around your kiosk) ----------

// ---------- shifts: paid work inside the shops ----------

export interface Shift {
  id: string;
  /** Building id in world/map.ts; you work at its door. */
  building: string;
  title: string;
  pay: number;
  seconds: number;
  energy: number;
  minLevel: number;
}

export const SHIFTS: Shift[] = [
  { id: "chapati", building: "chapati", title: "Roll chapatis for Mama Rose", pay: 1_500, seconds: 40, energy: 12, minLevel: 1 },
  { id: "salon", building: "salon", title: "Sweep and wash hair at Salon Nakato", pay: 1_500, seconds: 40, energy: 12, minLevel: 1 },
  { id: "juice", building: "juice", title: "Squeeze passion fruit at the juice bar", pay: 1_600, seconds: 45, energy: 12, minLevel: 1 },
  { id: "hostel", building: "hostel", title: "Clean rooms at Campus View Hostel", pay: 1_800, seconds: 50, energy: 15, minLevel: 2 },
  { id: "pharmacy", building: "pharmacy", title: "Stack shelves at the pharmacy", pay: 1_800, seconds: 50, energy: 14, minLevel: 2 },
  { id: "bakery", building: "bakery", title: "Bake bread at Sunrise Bakery", pay: 2_000, seconds: 55, energy: 16, minLevel: 2 },
  { id: "hardware", building: "hardware", title: "Carry cement bags at Kikoni Hardware", pay: 2_400, seconds: 60, energy: 22, minLevel: 3 },
  { id: "sacco", building: "sacco", title: "Count the day's savings at the boda sacco", pay: 2_200, seconds: 55, energy: 14, minLevel: 3 },
  { id: "studio", building: "studio", title: "Run the mixing desk at Studio 256", pay: 2_800, seconds: 60, energy: 16, minLevel: 4 },
  { id: "guesthouse", building: "guesthouse", title: "Work reception at the guest house", pay: 2_600, seconds: 60, energy: 14, minLevel: 4 },
  // Makerere University
  { id: "mk-library", building: "mk-library", title: "Shelve books at the Main Library", pay: 1_600, seconds: 45, energy: 10, minLevel: 1 },
  { id: "mk-food", building: "mk-food", title: "Serve lunch at the food court", pay: 1_500, seconds: 40, energy: 12, minLevel: 1 },
  { id: "mk-guild", building: "mk-guild", title: "Run the till at the Guild Canteen", pay: 1_900, seconds: 50, energy: 12, minLevel: 2 },
  { id: "mk-senate", building: "mk-senate", title: "File results at the Senate", pay: 2_300, seconds: 55, energy: 12, minLevel: 3 },
  { id: "mk-main", building: "mk-main", title: "Guide visitors round the Main Building", pay: 2_700, seconds: 60, energy: 14, minLevel: 5 },
  // Owino Market
  { id: "ow-whole", building: "ow-whole", title: "Carry sacks for Hajji Musoke", pay: 2_000, seconds: 45, energy: 22, minLevel: 1 },
  { id: "ow-mivumba", building: "ow-mivumba", title: "Sort second-hand clothes", pay: 1_500, seconds: 40, energy: 10, minLevel: 1 },
  { id: "ow-fabric", building: "ow-fabric", title: "Measure and cut kitenge", pay: 1_800, seconds: 45, energy: 10, minLevel: 2 },
  { id: "ow-hotel", building: "ow-hotel", title: "Wait tables at Market View Hotel", pay: 2_000, seconds: 50, energy: 14, minLevel: 2 },
  { id: "ow-electric", building: "ow-electric", title: "Fix phone screens with Wasswa", pay: 2_800, seconds: 60, energy: 12, minLevel: 4 },
  // Kabalagala
  { id: "kb-mart", building: "kb-mart", title: "Stock shelves at the 24/7", pay: 1_600, seconds: 45, energy: 14, minLevel: 1 },
  { id: "kb-chicken", building: "kb-chicken", title: "Fry chicken and chips", pay: 1_800, seconds: 45, energy: 14, minLevel: 1 },
  { id: "kb-pork", building: "kb-pork", title: "Grill pork for Mzee Lubega", pay: 2_100, seconds: 50, energy: 16, minLevel: 2 },
  { id: "kb-lounge", building: "kb-lounge", title: "Serve at Skyline Lounge", pay: 2_500, seconds: 55, energy: 14, minLevel: 3 },
  { id: "kb-club", building: "kb-club", title: "DJ a set at Club 256", pay: 3_200, seconds: 60, energy: 18, minLevel: 5 },
];

export const SHIFTS_PER_DAY = 6;

// ---------- cheap snacks (sold at the carts and Mama Rose's) ----------

export interface Snack {
  id: string;
  name: string;
  price: number;
  boostPct: number;
  boostMinutes: number;
  energy: number;
  icon: string;
  /** Vendor ids from VENDORS, or "chapati" for Mama Rose's shop. */
  soldAt: string[];
}

export const SNACKS: Snack[] = [
  { id: "mandazi", name: "Mandazi", price: 200, boostPct: 2, boostMinutes: 10, energy: 8, icon: "🍩", soldAt: ["chapati", "rolex", "kb-rolex", "ow-chips"] },
  { id: "chai", name: "Chai (spiced tea)", price: 300, boostPct: 3, boostMinutes: 10, energy: 10, icon: "🍵", soldAt: ["chapati"] },
  { id: "water", name: "Bottle of water", price: 300, boostPct: 2, boostMinutes: 10, energy: 5, icon: "💧", soldAt: ["fruit", "maize", "mk-chips", "ow-muwogo", "kb-muchomo"] },
  { id: "sugarcane", name: "Sugarcane", price: 300, boostPct: 3, boostMinutes: 10, energy: 8, icon: "🎋", soldAt: ["fruit"] },
  { id: "chapati", name: "Chapati", price: 500, boostPct: 6, boostMinutes: 15, energy: 15, icon: "🫓", soldAt: ["chapati", "rolex"] },
  { id: "samosa", name: "Samosa", price: 500, boostPct: 5, boostMinutes: 15, energy: 12, icon: "🥟", soldAt: ["chapati", "maize"] },
  { id: "gonja", name: "Roasted gonja", price: 500, boostPct: 5, boostMinutes: 15, energy: 15, icon: "🍌", soldAt: ["maize", "ow-muwogo"] },
  { id: "mango", name: "Mango", price: 500, boostPct: 4, boostMinutes: 15, energy: 10, icon: "🥭", soldAt: ["fruit"] },
  { id: "soda", name: "Cold soda", price: 1_000, boostPct: 5, boostMinutes: 20, energy: 12, icon: "🥤", soldAt: ["chapati", "fruit", "mk-chips", "ow-chips", "kb-muchomo"] },
  { id: "kikomando", name: "Kikomando (chapati and beans)", price: 1_500, boostPct: 12, boostMinutes: 25, energy: 35, icon: "🫘", soldAt: ["rolex", "chapati", "kb-rolex"] },
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
export function passersBy(count: number, seed = 0) {
  const skins = ["#f1c7a5", "#c68a62", "#a86b45", "#8d5a3b", "#6b4228", "#4e3020"];
  const shirts = ["#1f4fd1", "#b4442a", "#2f7a4b", "#f2d23c", "#7a2fa8", "#13202b", "#f4efe4", "#e0457b", "#e07a1f", "#3b8ea5"];
  const hairs = ["short", "bun", "braids", "cap"] as const;
  const pants = ["#2b2f38", "#3a3f4a", "#1f4fd1", "#5a3b24", "#13202b"];
  return Array.from({ length: count }, (_, j) => j + seed).map((i) => ({
    id: `pb-${i}`,
    name: FIRST[i % FIRST.length],
    role: ROLES[(i * 7) % ROLES.length],
    look: { skin: skins[(i * 5) % skins.length], shirt: shirts[(i * 3) % shirts.length], hair: hairs[(i * 7) % hairs.length], pants: pants[i % pants.length] },
  }));
}
