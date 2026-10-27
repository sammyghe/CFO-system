// The map engine for whichever Kampala area you're in (areas are authored in
// areas.ts). x runs along the main road, y runs across it; tile (0,0) is the
// back-left corner. BUILDINGS, PLOTS, PROPS and PLACES are live bindings: they
// change when you travel (setArea), and every importer sees the new area.

export const MAP_W = 40;
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
  kind: "tree" | "lamp" | "stall" | "shelter" | "bench" | "billboard" | "wall" | "bush" | "parked" | "board" | "cart" | "bodaPark" | "gate";
  /** For carts: which vendor in content/catalog.ts. */
  vendor?: string;
  /** For billboards: which slot in content/billboards.ts. */
  slot?: string;
  x: number;
  y: number;
  variant?: number;
  blocks?: boolean;
}


export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface AreaDef {
  id: string;
  name: string;
  blurb: string;
  road: string;
  /** A side road running up between the shops. */
  sideRoad: { x0: number; x1: number } | null;
  /** Drain slabs: the only places to step over the roadside drains. */
  slabs: number[];
  /** Where matatus drop you (arrival tile). */
  stage: { x: number; y: number };
  bodaStage: { x: number; y: number };
  /** Wandegeya's famous pothole (the civic loop) lives in one area. */
  pothole: { x: number; y: number } | null;
  /** The Street Snaps community board, if this area has it. */
  board: { x: number; y: number } | null;
  buildings: Building[];
  plots: Plot[];
  props: Prop[];
  /** Extra places for deliveries and rides, besides shop doors. */
  places: Place[];
  /** The open ground also covers row 15 (otherwise it's plain earth). */
  row15?: boolean;
  /** Ground on the open rows 12-15. */
  south(this: AreaDef, x: number, y: number): Ground;
}

import { AREAS } from "./areas";
export { AREAS };

export let AREA: AreaDef = AREAS[0];
export let BUILDINGS: Building[] = AREA.buildings;
export let PLOTS: Plot[] = AREA.plots;
export let PROPS: Prop[] = AREA.props;
export let PLACES: Place[] = placesOf(AREA);
/** Wandegeya's pothole position (other areas have none; check AREA.pothole). */
export const POTHOLE = AREAS[0].pothole!;
export let BODA_STAGE = AREA.bodaStage;
export let STAGE_DOOR = AREA.stage;

/** Every kiosk plot in every area (the server leases them all). */
export const ALL_PLOTS: Plot[] = AREAS.flatMap((a) => a.plots);

function placesOf(a: AreaDef): Place[] {
  return [...a.buildings.map((b) => ({ id: b.id, name: b.name, x: b.door.x, y: b.door.y })), ...a.places];
}

export function areaById(id: string | undefined | null): AreaDef | undefined {
  return AREAS.find((a) => a.id === id);
}

/** Switches the whole map to another area. Returns false for an unknown id. */
export function setArea(id: string): boolean {
  const a = areaById(id);
  if (!a) return false;
  AREA = a;
  BUILDINGS = a.buildings;
  PLOTS = a.plots;
  PROPS = a.props;
  PLACES = placesOf(a);
  BODA_STAGE = a.bodaStage;
  STAGE_DOOR = a.stage;
  walkCache = null;
  return true;
}

/** A place in any area, for things that span areas (events, shared links). */
export function findPlace(id: string): { area: AreaDef; place: Place } | undefined {
  for (const a of AREAS) {
    const place = placesOf(a).find((p) => p.id === id);
    if (place) return { area: a, place };
  }
  return undefined;
}

export function groundAt(x: number, y: number): Ground {
  const a = AREA;
  if (a.sideRoad && x >= a.sideRoad.x0 && x <= a.sideRoad.x1 && y <= 4) return "road";
  if (y <= 3) return "earth";
  if (y === 4 || y === 11) return "pave";
  if (y === 5 || y === 10) return a.slabs.includes(x) ? "slab" : "drain";
  if (y >= 6 && y <= 9) return "road";
  if (y >= 12 && y <= 14) return a.south(x, y);
  if (y === 15) return a.row15 ? a.south(x, y) : "earth";
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

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}
