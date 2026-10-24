// Isometric projection. One tile is 64 x 32 world pixels.
export const TW = 64;
export const TH = 32;
export const HW = TW / 2;
export const HH = TH / 2;
/** Height of one building floor in world pixels. */
export const FLOOR_H = 26;

export interface SPt {
  sx: number;
  sy: number;
}

export function toScreen(x: number, y: number): SPt {
  return { sx: (x - y) * HW, sy: (x + y) * HH };
}

export function toWorld(sx: number, sy: number): { x: number; y: number } {
  return { x: (sx / HW + sy / HH) / 2, y: (sy / HH - sx / HW) / 2 };
}

/** A footprint box in tiles plus a height in pixels. */
export interface Box {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
}

export function boxCorners(b: Box) {
  const A = toScreen(b.x, b.y);
  const B = toScreen(b.x + b.w, b.y);
  const C = toScreen(b.x + b.w, b.y + b.d);
  const D = toScreen(b.x, b.y + b.d);
  return { A, B, C, D };
}

/** Screen-space bounding rectangle of a box (world pixels). */
export function boxBounds(b: Box, extraTop = 0) {
  const { A, B, C, D } = boxCorners(b);
  return { x0: D.sx, x1: B.sx, y0: A.sy - b.h - extraTop, y1: C.sy };
}

/** Silhouette polygon for hit testing. */
export function boxSilhouette(b: Box, extraTop = 0): SPt[] {
  const { A, B, C, D } = boxCorners(b);
  const h = b.h + extraTop;
  return [
    { sx: A.sx, sy: A.sy - h }, { sx: B.sx, sy: B.sy - h }, B, C, D, { sx: D.sx, sy: D.sy - h },
  ];
}

export function pointInPoly(px: number, py: number, poly: SPt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.sy > py !== b.sy > py && px < ((b.sx - a.sx) * (py - a.sy)) / (b.sy - a.sy) + a.sx) inside = !inside;
  }
  return inside;
}
