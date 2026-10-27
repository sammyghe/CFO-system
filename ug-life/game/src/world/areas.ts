// The Kampala areas you can walk around. Every area uses the same street layout
// (shops on rows 0-3, pavement, drain, road, drain, pavement, then open ground on
// rows 12-15), so the engine, traffic and paths work the same everywhere.
// Add an area by adding an entry here; see CONTENT.md.

import type { AreaDef, Ground } from "./map";

const plotLot = (plots: { x: number; y: number }[], x: number, y: number) => plots.some((p) => x >= p.x && x <= p.x + 1 && y >= p.y && y <= p.y + 1);

const WANDEGEYA: AreaDef = {
  id: "wandegeya",
  name: "Wandegeya",
  blurb: "Our street by Makerere: shops, kiosks, the taxi stage and Studio 256.",
  road: "Bombo Road",
  sideRoad: { x0: 14, x1: 15 },
  slabs: [3, 8, 12, 14, 15, 17, 24, 28, 31, 34, 38],
  stage: { x: 3, y: 11 },
  bodaStage: { x: 3, y: 13 },
  pothole: { x: 12, y: 7 },
  board: { x: 25, y: 11 },
  buildings: [
    { id: "hardware", name: "Kikoni Hardware", x: 0, y: 0, w: 4, d: 4, floors: 2, wall: "#d9c9a8", trim: "#8a6f45", roof: "iron", sign: "KIKONI HARDWARE", signBg: "#d9a400", signFg: "#13202b", door: { x: 2, y: 4 }, face: "front", kind: "Hardware shop" },
    { id: "chapati", name: "Mama Rose Chapati", x: 4, y: 1, w: 3, d: 3, floors: 1, wall: "#e9e2cf", trim: "#2f7a4b", roof: "iron", sign: "MAMA ROSE CHAPATI", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 5, y: 4 }, face: "front", kind: "Food stall" },
    { id: "money", name: "Mobile Money Agent", x: 7, y: 0, w: 3, d: 4, floors: 3, wall: "#f2d23c", trim: "#13202b", roof: "flat", sign: "MOBILE MONEY", signBg: "#13202b", signFg: "#f2d23c", door: { x: 8, y: 4 }, face: "front", kind: "Mobile money agent" },
    { id: "pharmacy", name: "Wandegeya Pharmacy", x: 10, y: 0, w: 4, d: 4, floors: 4, wall: "#e8eef0", trim: "#2f7a4b", roof: "tank", sign: "WANDEGEYA PHARMACY", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 12, y: 4 }, face: "front", kind: "Pharmacy" },
    { id: "studio", name: "Studio 256", x: 16, y: 0, w: 3, d: 4, floors: 2, wall: "#3b3f4a", trim: "#e0457b", roof: "flat", sign: "STUDIO 256", signBg: "#e0457b", signFg: "#ffffff", door: { x: 17, y: 4 }, face: "front", kind: "Music studio" },
    { id: "salon", name: "Salon Nakato", x: 19, y: 1, w: 3, d: 3, floors: 1, wall: "#f0c6d4", trim: "#7a2fa8", roof: "iron", sign: "SALON NAKATO", signBg: "#7a2fa8", signFg: "#ffffff", door: { x: 20, y: 4 }, face: "front", kind: "Salon" },
    { id: "hostel", name: "Campus View Hostel", x: 22, y: 0, w: 4, d: 4, floors: 5, wall: "#c96f4a", trim: "#f4efe4", roof: "tank", sign: "CAMPUS VIEW HOSTEL", signBg: "#f4efe4", signFg: "#b4442a", door: { x: 24, y: 4 }, face: "front", kind: "Student hostel" },
    { id: "juice", name: "Fresh Juice Bar", x: 26, y: 1, w: 4, d: 3, floors: 2, wall: "#ffb347", trim: "#2f7a4b", roof: "flat", sign: "FRESH JUICE", signBg: "#2f7a4b", signFg: "#ffe9a8", door: { x: 28, y: 4 }, face: "front", kind: "Juice bar" },
    { id: "sacco", name: "Kikoni Boda Sacco", x: 30, y: 1, w: 3, d: 3, floors: 1, wall: "#2f7a4b", trim: "#f2d23c", roof: "iron", sign: "KIKONI BODA SACCO", signBg: "#f2d23c", signFg: "#13202b", door: { x: 31, y: 4 }, face: "front", kind: "Boda riders' savings group" },
    { id: "bakery", name: "Sunrise Bakery", x: 33, y: 0, w: 3, d: 4, floors: 2, wall: "#f4e3c1", trim: "#b4442a", roof: "flat", sign: "SUNRISE BAKERY", signBg: "#b4442a", signFg: "#ffffff", door: { x: 34, y: 4 }, face: "front", kind: "Bakery" },
    { id: "guesthouse", name: "Makerere Guest House", x: 36, y: 0, w: 4, d: 4, floors: 3, wall: "#9fc4d8", trim: "#13202b", roof: "tank", sign: "MAKERERE GUEST HOUSE", signBg: "#13202b", signFg: "#ffffff", door: { x: 38, y: 4 }, face: "front", kind: "Guest house" },
  ],
  plots: [
    { id: "plot-a", x: 16, y: 12, npcOwner: null },
    { id: "plot-b", x: 19, y: 12, npcOwner: { name: "Ssali", sign: "SSALI PHONE FIX", color: "#1f4fd1", product: "Phone repair" } },
    { id: "plot-c", x: 22, y: 12, npcOwner: null },
    { id: "plot-d", x: 30, y: 12, npcOwner: null },
    { id: "plot-e", x: 33, y: 12, npcOwner: null },
    { id: "plot-f", x: 36, y: 12, npcOwner: null },
  ],
  props: [
    { kind: "shelter", x: 1, y: 12, blocks: true },
    { kind: "parked", x: 4, y: 13, blocks: true },
    { kind: "stall", x: 8, y: 12, variant: 0, blocks: true },
    { kind: "stall", x: 10, y: 12, variant: 1, blocks: true },
    { kind: "stall", x: 12, y: 12, variant: 2, blocks: true },
    { kind: "tree", x: 14, y: 13, variant: 0, blocks: true },
    { kind: "tree", x: 26, y: 13, variant: 1, blocks: true },
    { kind: "bench", x: 27, y: 12, blocks: true },
    { kind: "bench", x: 28, y: 14, blocks: true },
    { kind: "tree", x: 29, y: 12, variant: 2, blocks: true },
    { kind: "bush", x: 25, y: 15 },
    { kind: "bush", x: 7, y: 15 },
    { kind: "lamp", x: 6, y: 11, blocks: true },
    { kind: "lamp", x: 15, y: 11, blocks: true },
    { kind: "lamp", x: 25, y: 11, blocks: true },
    { kind: "lamp", x: 9, y: 4, blocks: true },
    { kind: "lamp", x: 21, y: 4, blocks: true },
    { kind: "wall", x: 0, y: 16 },
    { kind: "board", x: 25, y: 12, blocks: true },
    { kind: "billboard", x: 2, y: 15, slot: "stage", blocks: true },
    { kind: "billboard", x: 31, y: 15, slot: "market", blocks: true },
    { kind: "cart", x: 7, y: 12, vendor: "rolex", blocks: true },
    { kind: "cart", x: 15, y: 12, vendor: "maize", blocks: true },
    { kind: "cart", x: 13, y: 14, vendor: "fruit", blocks: true },
    { kind: "bodaPark", x: 1, y: 14, variant: 0 },
    { kind: "bodaPark", x: 2, y: 14, variant: 1 },
    { kind: "bodaPark", x: 4, y: 14, variant: 2 },
    { kind: "bodaPark", x: 5, y: 14, variant: 3 },
    { kind: "bodaPark", x: 6, y: 13, variant: 4 },
    { kind: "lamp", x: 32, y: 4, blocks: true },
    { kind: "lamp", x: 39, y: 11, blocks: true },
    { kind: "tree", x: 39, y: 13, variant: 0, blocks: true },
    { kind: "bush", x: 34, y: 15 },
    { kind: "gate", x: 14, y: 0 },
  ],
  places: [
    { id: "stage", name: "Wandegeya taxi stage", x: 3, y: 11 },
    { id: "market", name: "Market stalls", x: 10, y: 11 },
    { id: "plot-b", name: "Ssali Phone Fix", x: 19, y: 11 },
    { id: "benches", name: "The benches", x: 27, y: 13 },
    { id: "bodastage", name: "Boda stage", x: 3, y: 13 },
  ],
  south(x, y) {
    if (x <= 6) return "stage";
    if (x >= 8 && x <= 13) return "market";
    if (x >= 16 && plotLot(this.plots, x, y)) return "lot";
    if (x >= 26 && x <= 29) return "grass";
    return "earth";
  },
};

const MAKERERE: AreaDef = {
  row15: true,
  id: "makerere",
  name: "Makerere University",
  blurb: "The hill of learning: the Main Building, the library, the halls and Freedom Square.",
  road: "University Road",
  sideRoad: null,
  slabs: [3, 4, 10, 16, 21, 27, 33, 38],
  stage: { x: 3, y: 11 },
  bodaStage: { x: 3, y: 13 },
  pothole: null,
  board: null,
  buildings: [
    { id: "mk-main", name: "Makerere Main Building", x: 0, y: 0, w: 7, d: 4, floors: 3, wall: "#f4f1ea", trim: "#7a5c3a", roof: "flat", sign: "MAKERERE UNIVERSITY", signBg: "#7a2b2b", signFg: "#ffffff", door: { x: 4, y: 4 }, face: "front", kind: "University Main Building" },
    { id: "mk-library", name: "Main Library", x: 8, y: 0, w: 5, d: 4, floors: 3, wall: "#d8cdb8", trim: "#3b5d8a", roof: "flat", sign: "MAIN LIBRARY", signBg: "#3b5d8a", signFg: "#ffffff", door: { x: 10, y: 4 }, face: "front", kind: "Library" },
    { id: "mk-senate", name: "Senate Building", x: 14, y: 0, w: 4, d: 4, floors: 4, wall: "#e2e6ea", trim: "#2f4f7a", roof: "flat", sign: "SENATE", signBg: "#2f4f7a", signFg: "#ffffff", door: { x: 16, y: 4 }, face: "front", kind: "University offices" },
    { id: "mk-lumumba", name: "Lumumba Hall", x: 19, y: 0, w: 5, d: 4, floors: 5, wall: "#b9d3a8", trim: "#2f5a2f", roof: "tank", sign: "LUMUMBA HALL", signBg: "#2f5a2f", signFg: "#ffffff", door: { x: 21, y: 4 }, face: "front", kind: "Hall of residence" },
    { id: "mk-mary", name: "Mary Stuart Hall", x: 25, y: 0, w: 5, d: 4, floors: 4, wall: "#e9c9d8", trim: "#7a2f5a", roof: "tank", sign: "MARY STUART HALL", signBg: "#7a2f5a", signFg: "#ffffff", door: { x: 27, y: 4 }, face: "front", kind: "Hall of residence" },
    { id: "mk-food", name: "Campus Food Court", x: 31, y: 1, w: 4, d: 3, floors: 1, wall: "#ffcf7a", trim: "#b4442a", roof: "iron", sign: "FOOD COURT", signBg: "#b4442a", signFg: "#ffffff", door: { x: 33, y: 4 }, face: "front", kind: "Food court" },
    { id: "mk-guild", name: "Guild Canteen", x: 36, y: 0, w: 4, d: 4, floors: 2, wall: "#cfe3f2", trim: "#1f4fd1", roof: "flat", sign: "GUILD CANTEEN", signBg: "#1f4fd1", signFg: "#ffffff", door: { x: 38, y: 4 }, face: "front", kind: "Student canteen" },
  ],
  plots: [
    { id: "mk-a", x: 24, y: 12, npcOwner: null },
    { id: "mk-b", x: 27, y: 12, npcOwner: { name: "Tendo", sign: "PRINT & PHOTOCOPY", color: "#3b5d8a", product: "Printing" } },
    { id: "mk-c", x: 33, y: 12, npcOwner: null },
  ],
  props: [
    { kind: "shelter", x: 1, y: 12, blocks: true },
    { kind: "bodaPark", x: 1, y: 14, variant: 1 },
    { kind: "bodaPark", x: 3, y: 14, variant: 2 },
    { kind: "bodaPark", x: 5, y: 13, variant: 0 },
    { kind: "tree", x: 9, y: 13, variant: 0, blocks: true },
    { kind: "tree", x: 13, y: 15, variant: 1, blocks: true },
    { kind: "tree", x: 18, y: 13, variant: 2, blocks: true },
    { kind: "tree", x: 22, y: 15, variant: 0, blocks: true },
    { kind: "bench", x: 11, y: 12, blocks: true },
    { kind: "bench", x: 15, y: 12, blocks: true },
    { kind: "bench", x: 16, y: 14, blocks: true },
    { kind: "bench", x: 20, y: 12, blocks: true },
    { kind: "bush", x: 8, y: 15 },
    { kind: "bush", x: 19, y: 15 },
    { kind: "lamp", x: 7, y: 11, blocks: true },
    { kind: "lamp", x: 17, y: 11, blocks: true },
    { kind: "lamp", x: 30, y: 11, blocks: true },
    { kind: "lamp", x: 7, y: 4, blocks: true },
    { kind: "lamp", x: 24, y: 4, blocks: true },
    { kind: "lamp", x: 35, y: 4, blocks: true },
    { kind: "cart", x: 37, y: 12, vendor: "mk-chips", blocks: true },
    { kind: "billboard", x: 30, y: 15, slot: "mk-square", blocks: true },
    { kind: "wall", x: 0, y: 16 },
  ],
  places: [
    { id: "mk-stage", name: "Makerere taxi stage", x: 3, y: 11 },
    { id: "mk-square", name: "Freedom Square", x: 14, y: 13 },
    { id: "mk-b", name: "Tendo's print shop", x: 28, y: 11 },
    { id: "mk-bodastage", name: "Campus boda stage", x: 3, y: 13 },
  ],
  south(x, y) {
    if (x <= 6) return "stage";
    if (x >= 8 && x <= 22) return "grass";
    if (plotLot(this.plots, x, y)) return "lot";
    return "earth";
  },
};

const OWINO: AreaDef = {
  row15: true,
  id: "owino",
  name: "Owino Market",
  blurb: "St. Balikuddembe market and Kikuubo next door: everything for sale, everyone shouting prices.",
  road: "Market Street",
  sideRoad: null,
  slabs: [3, 6, 9, 13, 18, 22, 27, 32, 37],
  stage: { x: 3, y: 11 },
  bodaStage: { x: 4, y: 13 },
  pothole: null,
  board: null,
  buildings: [
    { id: "ow-whole", name: "Kikuubo Wholesalers", x: 0, y: 0, w: 5, d: 4, floors: 3, wall: "#e8d5a8", trim: "#7a4a1f", roof: "flat", sign: "KIKUUBO WHOLESALE", signBg: "#b4442a", signFg: "#ffffff", door: { x: 3, y: 4 }, face: "front", kind: "Wholesale shop" },
    { id: "ow-mivumba", name: "Mivumba Clothes", x: 6, y: 1, w: 4, d: 3, floors: 2, wall: "#d4e6f0", trim: "#7a2fa8", roof: "iron", sign: "MIVUMBA CLOTHES", signBg: "#7a2fa8", signFg: "#ffffff", door: { x: 8, y: 4 }, face: "front", kind: "Second-hand clothes" },
    { id: "ow-fabric", name: "Kitenge Fabrics", x: 11, y: 0, w: 4, d: 4, floors: 2, wall: "#f2c94c", trim: "#2f7a4b", roof: "flat", sign: "KITENGE FABRICS", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 13, y: 4 }, face: "front", kind: "Fabric shop" },
    { id: "ow-electric", name: "Electricals & Phones", x: 16, y: 0, w: 4, d: 4, floors: 3, wall: "#cfd8dc", trim: "#13202b", roof: "flat", sign: "PHONES & ELECTRICALS", signBg: "#13202b", signFg: "#f2d23c", door: { x: 18, y: 4 }, face: "front", kind: "Phone and electrical shop" },
    { id: "ow-money", name: "Market Mobile Money", x: 21, y: 1, w: 3, d: 3, floors: 1, wall: "#f2d23c", trim: "#13202b", roof: "iron", sign: "MOBILE MONEY", signBg: "#13202b", signFg: "#f2d23c", door: { x: 22, y: 4 }, face: "front", kind: "Mobile money agent" },
    { id: "ow-hotel", name: "Market View Hotel", x: 25, y: 0, w: 5, d: 4, floors: 4, wall: "#e0b38a", trim: "#7a2b2b", roof: "tank", sign: "MARKET VIEW HOTEL", signBg: "#7a2b2b", signFg: "#ffffff", door: { x: 27, y: 4 }, face: "front", kind: "Hotel and restaurant" },
    { id: "ow-bus", name: "Bus Booking Office", x: 31, y: 1, w: 4, d: 3, floors: 2, wall: "#ffffff", trim: "#1f4fd1", roof: "flat", sign: "BUS BOOKINGS", signBg: "#1f4fd1", signFg: "#ffffff", door: { x: 33, y: 4 }, face: "front", kind: "Bus booking office" },
    { id: "ow-wash", name: "Public Washroom", x: 36, y: 1, w: 4, d: 3, floors: 1, wall: "#dfe8e4", trim: "#2f7a4b", roof: "iron", sign: "WASHROOMS 200/=", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 37, y: 4 }, face: "front", kind: "Public washroom" },
  ],
  plots: [
    { id: "ow-a", x: 31, y: 12, npcOwner: null },
    { id: "ow-b", x: 34, y: 12, npcOwner: null },
    { id: "ow-c", x: 37, y: 12, npcOwner: { name: "Maama Sylvia", sign: "SYLVIA SHOES", color: "#b4442a", product: "Shoes" } },
  ],
  props: [
    { kind: "shelter", x: 1, y: 12, blocks: true },
    { kind: "parked", x: 3, y: 14, blocks: true },
    { kind: "stall", x: 7, y: 12, variant: 0, blocks: true },
    { kind: "stall", x: 9, y: 12, variant: 1, blocks: true },
    { kind: "stall", x: 11, y: 12, variant: 2, blocks: true },
    { kind: "stall", x: 13, y: 12, variant: 0, blocks: true },
    { kind: "stall", x: 7, y: 14, variant: 2, blocks: true },
    { kind: "stall", x: 10, y: 14, variant: 1, blocks: true },
    { kind: "stall", x: 13, y: 14, variant: 0, blocks: true },
    { kind: "stall", x: 16, y: 12, variant: 1, blocks: true },
    { kind: "stall", x: 18, y: 12, variant: 2, blocks: true },
    { kind: "stall", x: 16, y: 14, variant: 0, blocks: true },
    { kind: "stall", x: 19, y: 14, variant: 1, blocks: true },
    { kind: "stall", x: 22, y: 12, variant: 2, blocks: true },
    { kind: "stall", x: 22, y: 14, variant: 0, blocks: true },
    { kind: "cart", x: 25, y: 12, vendor: "ow-muwogo", blocks: true },
    { kind: "cart", x: 28, y: 13, vendor: "ow-chips", blocks: true },
    { kind: "lamp", x: 6, y: 11, blocks: true },
    { kind: "lamp", x: 21, y: 11, blocks: true },
    { kind: "lamp", x: 30, y: 4, blocks: true },
    { kind: "billboard", x: 25, y: 15, slot: "ow-market", blocks: true },
    { kind: "wall", x: 0, y: 16 },
  ],
  places: [
    { id: "ow-stage", name: "Old Taxi Park stage", x: 3, y: 11 },
    { id: "ow-stalls", name: "The market stalls", x: 15, y: 11 },
    { id: "ow-c", name: "Sylvia Shoes", x: 38, y: 11 },
    { id: "ow-bodastage", name: "Market boda stage", x: 4, y: 13 },
  ],
  south(x, y) {
    if (x <= 5) return "stage";
    if (x >= 6 && x <= 29) return "market";
    if (plotLot(this.plots, x, y)) return "lot";
    return "earth";
  },
};

const KABALAGALA: AreaDef = {
  row15: true,
  id: "kabalagala",
  name: "Kabalagala",
  blurb: "Kampala's late-night strip: pork joints, Club 256, music until morning.",
  road: "Ggaba Road",
  sideRoad: { x0: 20, x1: 21 },
  slabs: [3, 7, 11, 16, 20, 21, 25, 30, 35],
  stage: { x: 3, y: 11 },
  bodaStage: { x: 3, y: 13 },
  pothole: null,
  board: null,
  buildings: [
    { id: "kb-pork", name: "Kabz Pork Joint", x: 0, y: 1, w: 4, d: 3, floors: 1, wall: "#c96f4a", trim: "#13202b", roof: "iron", sign: "PORK JOINT", signBg: "#13202b", signFg: "#ffb347", door: { x: 2, y: 4 }, face: "front", kind: "Pork joint" },
    { id: "kb-club", name: "Club 256", x: 5, y: 0, w: 5, d: 4, floors: 2, wall: "#2b2140", trim: "#e0457b", roof: "flat", sign: "CLUB 256", signBg: "#e0457b", signFg: "#ffffff", door: { x: 7, y: 4 }, face: "front", kind: "Nightclub" },
    { id: "kb-lounge", name: "Skyline Lounge", x: 11, y: 0, w: 4, d: 4, floors: 4, wall: "#3b3f4a", trim: "#f2d23c", roof: "flat", sign: "SKYLINE LOUNGE", signBg: "#f2d23c", signFg: "#13202b", door: { x: 13, y: 4 }, face: "front", kind: "Rooftop lounge" },
    { id: "kb-salon", name: "Glam Salon & Barber", x: 16, y: 1, w: 3, d: 3, floors: 1, wall: "#f0c6d4", trim: "#13202b", roof: "iron", sign: "GLAM SALON", signBg: "#13202b", signFg: "#f0c6d4", door: { x: 17, y: 4 }, face: "front", kind: "Salon and barber" },
    { id: "kb-apart", name: "Kabalagala Apartments", x: 22, y: 0, w: 5, d: 4, floors: 5, wall: "#d8e2dc", trim: "#2f5a7a", roof: "tank", sign: "APARTMENTS TO LET", signBg: "#2f5a7a", signFg: "#ffffff", door: { x: 24, y: 4 }, face: "front", kind: "Apartments" },
    { id: "kb-mart", name: "24/7 Supermarket", x: 28, y: 0, w: 4, d: 4, floors: 2, wall: "#ffffff", trim: "#b4442a", roof: "flat", sign: "24/7 SUPERMARKET", signBg: "#b4442a", signFg: "#ffffff", door: { x: 30, y: 4 }, face: "front", kind: "Supermarket" },
    { id: "kb-chicken", name: "Chicken & Chips", x: 33, y: 1, w: 3, d: 3, floors: 1, wall: "#ffcf7a", trim: "#b4442a", roof: "iron", sign: "CHICKEN & CHIPS", signBg: "#b4442a", signFg: "#ffffff", door: { x: 34, y: 4 }, face: "front", kind: "Takeaway" },
    { id: "kb-gym", name: "Tank Hill Gym", x: 36, y: 0, w: 4, d: 4, floors: 2, wall: "#9fc4d8", trim: "#13202b", roof: "flat", sign: "TANK HILL GYM", signBg: "#13202b", signFg: "#ffffff", door: { x: 38, y: 4 }, face: "front", kind: "Gym" },
  ],
  plots: [
    { id: "kb-a", x: 24, y: 12, npcOwner: null },
    { id: "kb-b", x: 27, y: 12, npcOwner: null },
    { id: "kb-c", x: 33, y: 12, npcOwner: { name: "Bena", sign: "BENA'S SHISHA-FREE BAR", color: "#7a2fa8", product: "Juice and sodas" } },
  ],
  props: [
    { kind: "shelter", x: 1, y: 12, blocks: true },
    { kind: "bodaPark", x: 1, y: 14, variant: 3 },
    { kind: "bodaPark", x: 3, y: 14, variant: 4 },
    { kind: "bodaPark", x: 5, y: 14, variant: 1 },
    { kind: "cart", x: 9, y: 12, vendor: "kb-muchomo", blocks: true },
    { kind: "cart", x: 13, y: 12, vendor: "kb-rolex", blocks: true },
    { kind: "tree", x: 17, y: 14, variant: 1, blocks: true },
    { kind: "bench", x: 15, y: 13, blocks: true },
    { kind: "bench", x: 19, y: 13, blocks: true },
    { kind: "lamp", x: 4, y: 11, blocks: true },
    { kind: "lamp", x: 8, y: 11, blocks: true },
    { kind: "lamp", x: 12, y: 11, blocks: true },
    { kind: "lamp", x: 16, y: 11, blocks: true },
    { kind: "lamp", x: 22, y: 11, blocks: true },
    { kind: "lamp", x: 30, y: 11, blocks: true },
    { kind: "lamp", x: 10, y: 4, blocks: true },
    { kind: "lamp", x: 27, y: 4, blocks: true },
    { kind: "lamp", x: 35, y: 4, blocks: true },
    { kind: "bush", x: 21, y: 15 },
    { kind: "billboard", x: 30, y: 15, slot: "kb-strip", blocks: true },
    { kind: "billboard", x: 10, y: 15, slot: "kb-club", blocks: true },
    { kind: "wall", x: 0, y: 16 },
  ],
  places: [
    { id: "kb-stage", name: "Kabalagala stage", x: 3, y: 11 },
    { id: "kb-benches", name: "The strip benches", x: 17, y: 12 },
    { id: "kb-c", name: "Bena's bar", x: 34, y: 11 },
    { id: "kb-bodastage", name: "Kabalagala boda stage", x: 3, y: 13 },
  ],
  south(x, y) {
    if (x <= 6) return "stage";
    if (x >= 14 && x <= 22) return "grass";
    if (plotLot(this.plots, x, y)) return "lot";
    return "earth";
  },
};

export const AREAS: AreaDef[] = [WANDEGEYA, MAKERERE, OWINO, KABALAGALA];

/** Ground types are shared by all areas; this keeps the import used for checks. */
export type { Ground };
