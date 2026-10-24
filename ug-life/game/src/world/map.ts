// The authored street: a Wandegeya/Kikoni-style block near campus.
// x runs along the main road, y runs across it. Tile (0,0) is the back-left corner.

export const MAP_W = 30;
export const MAP_H = 17;

export type Ground = "earth" | "pave" | "road" | "drain" | "slab" | "stage" | "market" | "grass" | "lot";

export interface Building {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  d: number;
  floors: number;
  wall: string;
  trim: string;
  roof: "flat" | "iron" | "tank";
  sign: string;
  signBg: string;
  signFg: string;
  /** Door tile on the pavement in front of the building. */
  door: { x: number; y: number };
  /** Which visible face carries the shop front. */
  face: "front" | "side";
  kind: string;
}

export interface Plot {
  id: string;
  x: number;
  y: number;
  /** null = available to lease. */
  npcOwner: null | { name: string; sign: string; color: string; product: string };
}

export interface Prop {
  kind: "tree" | "lamp" | "stall" | "shelter" | "bench" | "billboard" | "wall" | "bush" | "parked" | "board";
  x: number;
  y: number;
  variant?: number;
  blocks?: boolean;
}

export const BUILDINGS: Building[] = [
  { id: "hardware", name: "Kikoni Hardware", x: 0, y: 0, w: 4, d: 4, floors: 2, wall: "#d9c9a8", trim: "#8a6f45", roof: "iron", sign: "KIKONI HARDWARE", signBg: "#d9a400", signFg: "#13202b", door: { x: 2, y: 4 }, face: "front", kind: "Hardware shop" },
  { id: "chapati", name: "Mama Rose Chapati", x: 4, y: 1, w: 3, d: 3, floors: 1, wall: "#e9e2cf", trim: "#2f7a4b", roof: "iron", sign: "MAMA ROSE CHAPATI", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 5, y: 4 }, face: "front", kind: "Food stall" },
  { id: "money", name: "Mobile Money Agent", x: 7, y: 0, w: 3, d: 4, floors: 3, wall: "#f2d23c", trim: "#13202b", roof: "flat", sign: "MOBILE MONEY", signBg: "#13202b", signFg: "#f2d23c", door: { x: 8, y: 4 }, face: "front", kind: "Mobile money agent" },
  { id: "pharmacy", name: "Wandegeya Pharmacy", x: 10, y: 0, w: 4, d: 4, floors: 4, wall: "#e8eef0", trim: "#2f7a4b", roof: "tank", sign: "WANDEGEYA PHARMACY", signBg: "#2f7a4b", signFg: "#ffffff", door: { x: 12, y: 4 }, face: "front", kind: "Pharmacy" },
  { id: "studio", name: "Studio 256", x: 16, y: 0, w: 3, d: 4, floors: 2, wall: "#3b3f4a", trim: "#e0457b", roof: "flat", sign: "STUDIO 256", signBg: "#e0457b", signFg: "#ffffff", door: { x: 17, y: 4 }, face: "front", kind: "Music studio" },
  { id: "salon", name: "Salon Nakato", x: 19, y: 1, w: 3, d: 3, floors: 1, wall: "#f0c6d4", trim: "#7a2fa8", roof: "iron", sign: "SALON NAKATO", signBg: "#7a2fa8", signFg: "#ffffff", door: { x: 20, y: 4 }, face: "front", kind: "Salon" },
  { id: "hostel", name: "Campus View Hostel", x: 22, y: 0, w: 4, d: 4, floors: 5, wall: "#c96f4a", trim: "#f4efe4", roof: "tank", sign: "CAMPUS VIEW HOSTEL", signBg: "#f4efe4", signFg: "#b4442a", door: { x: 24, y: 4 }, face: "front", kind: "Student hostel" },
  { id: "juice", name: "Fresh Juice Bar", x: 26, y: 1, w: 4, d: 3, floors: 2, wall: "#ffb347", trim: "#2f7a4b", roof: "flat", sign: "FRESH JUICE", signBg: "#2f7a4b", signFg: "#ffe9a8", door: { x: 28, y: 4 }, face: "front", kind: "Juice bar" },
];

export const PLOTS: Plot[] = [
  { id: "plot-a", x: 16, y: 12, npcOwner: null },
  { id: "plot-b", x: 19, y: 12, npcOwner: { name: "Ssali", sign: "SSALI PHONE FIX", color: "#1f4fd1", product: "Phone repair" } },
  { id: "plot-c", x: 22, y: 12, npcOwner: null },
];

export const POTHOLE = { x: 12, y: 7 };

export const STAGE_DOOR = { x: 3, y: 11 };

/** The Street Snaps community board by the benches. */
export const SNAP_BOARD = { x: 25, y: 12 };

export const PROPS: Prop[] = [
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
];

/** Drain slabs: the only places to step over the roadside drains. */
const SLABS_X = [3, 8, 12, 14, 15, 17, 24, 28];

export function groundAt(x: number, y: number): Ground {
  if (x >= 14 && x <= 15 && y <= 4) return "road"; // side road up the hill
  if (y <= 3) return "earth";
  if (y === 4 || y === 11) return "pave";
  if (y === 5 || y === 10) return SLABS_X.includes(x) ? "slab" : "drain";
  if (y >= 6 && y <= 9) return "road";
  if (y >= 12 && y <= 14) {
    if (x <= 6) return "stage";
    if (x >= 8 && x <= 13) return "market";
    if (x >= 16 && x <= 24 && PLOTS.some((p) => x >= p.x && x <= p.x + 1 && y >= p.y && y <= p.y + 1)) return "lot";
    if (x >= 26) return "grass";
    return "earth";
  }
  return y === 16 ? "grass" : "earth";
}

/** Ground beyond the playable block, so the street runs off into the city instead of ending. */
export const OUTER = 6;

export function outerGround(x: number, y: number): Ground {
  if (y >= 6 && y <= 9) return "road";
  if (y === 5 || y === 10) return "drain";
  if (y === 4 || y === 11) return "pave";
  // soft patches of bare red earth in the grass, like a Kampala verge
  const n = Math.sin(x * 0.55) + Math.cos(y * 0.8 + x * 0.2) + Math.sin((x - y) * 0.31);
  if (y < 4) return n > -0.4 ? "earth" : "grass";
  return n > 0.9 ? "earth" : "grass";
}

export function buildingAt(x: number, y: number): Building | undefined {
  return BUILDINGS.find((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.d);
}

export function plotAt(x: number, y: number): Plot | undefined {
  return PLOTS.find((p) => x >= p.x && x <= p.x + 1 && y >= p.y && y <= p.y + 1);
}

let walkCache: boolean[] | null = null;

export function isWalkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  if (!walkCache) {
    walkCache = [];
    for (let yy = 0; yy < MAP_H; yy++)
      for (let xx = 0; xx < MAP_W; xx++) {
        const g = groundAt(xx, yy);
        let ok = g !== "drain";
        if (buildingAt(xx, yy)) ok = false;
        if (plotAt(xx, yy)) ok = false;
        if (yy === 16) ok = false;
        if (PROPS.some((p) => p.blocks && occupies(p, xx, yy))) ok = false;
        walkCache.push(ok);
      }
  }
  return walkCache[y * MAP_W + x];
}

export function propFootprint(p: Prop): { w: number; d: number } {
  switch (p.kind) {
    case "stall": return { w: 2, d: 2 };
    case "shelter": return { w: 3, d: 1 };
    case "parked": return { w: 2, d: 1 };
    case "billboard": return { w: 2, d: 1 };
    case "wall": return { w: MAP_W, d: 1 };
    default: return { w: 1, d: 1 };
  }
}

function occupies(p: Prop, x: number, y: number): boolean {
  const f = propFootprint(p);
  return x >= p.x && x < p.x + f.w && y >= p.y && y < p.y + f.d;
}

/** Places a job can start or end: shop doors, the taxi stage and the kiosk lots. */
export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
}

export const PLACES: Place[] = [
  ...BUILDINGS.map((b) => ({ id: b.id, name: b.name, x: b.door.x, y: b.door.y })),
  { id: "stage", name: "Wandegeya taxi stage", x: STAGE_DOOR.x, y: STAGE_DOOR.y },
  { id: "market", name: "Market stalls", x: 10, y: 11 },
  { id: "plot-b", name: "Ssali Phone Fix", x: 19, y: 11 },
  { id: "benches", name: "The benches", x: 27, y: 13 },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}
