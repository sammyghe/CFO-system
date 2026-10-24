import { MAP_H, MAP_W, isWalkable } from "./map";

export interface Pt {
  x: number;
  y: number;
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/** A* over the tile grid, 8 directions, no cutting corners past blocked tiles. */
export function findPath(from: Pt, to: Pt): Pt[] | null {
  const sx = Math.round(from.x), sy = Math.round(from.y);
  let tx = Math.round(to.x), ty = Math.round(to.y);
  if (!isWalkable(tx, ty)) {
    const near = nearestWalkable({ x: tx, y: ty });
    if (!near) return null;
    tx = near.x; ty = near.y;
  }
  if (!isWalkable(sx, sy)) return [{ x: tx, y: ty }];
  const idx = (x: number, y: number) => y * MAP_W + x;
  const g = new Float32Array(MAP_W * MAP_H).fill(Infinity);
  const came = new Int32Array(MAP_W * MAP_H).fill(-1);
  const closed = new Uint8Array(MAP_W * MAP_H);
  const open: number[] = [idx(sx, sy)];
  g[idx(sx, sy)] = 0;
  const h = (i: number) => {
    const dx = Math.abs((i % MAP_W) - tx), dy = Math.abs(Math.floor(i / MAP_W) - ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (g[open[i]] + h(open[i]) < g[open[best]] + h(open[best])) best = i;
    const cur = open.splice(best, 1)[0];
    const cx = cur % MAP_W, cy = Math.floor(cur / MAP_W);
    if (cx === tx && cy === ty) {
      const out: Pt[] = [];
      for (let c = cur; c !== idx(sx, sy); c = came[c]) out.push({ x: c % MAP_W, y: Math.floor(c / MAP_W) });
      return out.reverse();
    }
    closed[cur] = 1;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isWalkable(nx, ny)) continue;
      if (dx && dy && (!isWalkable(cx + dx, cy) || !isWalkable(cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        g[ni] = ng;
        came[ni] = cur;
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return null;
}

export function nearestWalkable(p: Pt): Pt | null {
  for (let r = 1; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isWalkable(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
      }
  return null;
}

export function tileDistance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
