// Everything on the street is drawn in code: no image downloads, so the game
// stays small on mobile data. Coordinates are world pixels (see iso.ts).

import { FLOOR_H, HW, toScreen, type Box, type SPt, boxCorners } from "./iso";
import type { Building, Ground, Prop } from "./map";
import type { Look } from "../game/state";

type Ctx = CanvasRenderingContext2D;

// ---------- colour helpers ----------

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function rng(seed: number) {
  let s = ((Math.floor(seed) % 233280) + 233280) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function poly(ctx: Ctx, pts: SPt[], fill: string | CanvasGradient, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0].sx, pts[0].sy);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const up = (p: SPt, v: number): SPt => ({ sx: p.sx, sy: p.sy - v });

/** Point on the +y face (the face toward the main road). u in tiles along x, v pixels up. */
function fy(b: Box, u: number, v: number): SPt {
  return up(toScreen(b.x + u, b.y + b.d), v);
}
/** Point on the +x face. u in tiles from the front corner back along y. */
function fx(b: Box, u: number, v: number): SPt {
  return up(toScreen(b.x + b.w, b.y + b.d - u), v);
}

function quadY(ctx: Ctx, b: Box, u0: number, u1: number, v0: number, v1: number, fill: string | CanvasGradient, stroke?: string) {
  poly(ctx, [fy(b, u0, v0), fy(b, u1, v0), fy(b, u1, v1), fy(b, u0, v1)], fill, stroke);
}
function quadX(ctx: Ctx, b: Box, u0: number, u1: number, v0: number, v1: number, fill: string | CanvasGradient, stroke?: string) {
  poly(ctx, [fx(b, u0, v0), fx(b, u1, v0), fx(b, u1, v1), fx(b, u0, v1)], fill, stroke);
}

export function isoBox(ctx: Ctx, b: Box, top: string, left: string, right: string, outline = "rgba(0,0,0,0.18)") {
  const { A, B, C, D } = boxCorners(b);
  poly(ctx, [D, C, up(C, b.h), up(D, b.h)], left, outline);
  poly(ctx, [C, B, up(B, b.h), up(C, b.h)], right, outline);
  poly(ctx, [up(A, b.h), up(B, b.h), up(C, b.h), up(D, b.h)], top, outline);
}

/** Text painted flat on the +y face. */
function signTextY(ctx: Ctx, b: Box, u0: number, u1: number, v0: number, v1: number, text: string, color: string, weight = 800) {
  const o = fy(b, u0, v0);
  const widthPx = (u1 - u0) * HW;
  const heightPx = v1 - v0;
  ctx.save();
  ctx.transform(1, 0.5, 0, 1, o.sx, o.sy);
  let size = Math.min(heightPx * 0.72, 13);
  ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(text).width > widthPx * 0.92 && size > 4) {
    size -= 0.5;
    ctx.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, widthPx / 2, -heightPx / 2);
  ctx.restore();
}

function signTextX(ctx: Ctx, b: Box, u0: number, u1: number, v0: number, v1: number, text: string, color: string) {
  const o = fx(b, u0, v0);
  const widthPx = (u1 - u0) * HW;
  const heightPx = v1 - v0;
  ctx.save();
  ctx.transform(1, -0.5, 0, 1, o.sx, o.sy);
  let size = Math.min(heightPx * 0.7, 12);
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  while (ctx.measureText(text).width > widthPx * 0.9 && size > 4) {
    size -= 0.5;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, widthPx / 2, -heightPx / 2);
  ctx.restore();
}

// ---------- ground ----------

const EARTH = ["#a5532d", "#9e4f2b", "#ad5c34", "#a85a31"];
const GRASS = ["#5f8f3e", "#669842", "#58873a"];

export function drawTile(ctx: Ctx, x: number, y: number, g: Ground) {
  const r = rng((x + 50) * 131 + (y + 50) * 17 + 7);
  const A = toScreen(x, y), B = toScreen(x + 1, y), C = toScreen(x + 1, y + 1), D = toScreen(x, y + 1);
  const P = (u: number, v: number) => toScreen(x + u, y + v);
  const dots = (n: number, color: string, size = 1.4) => {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const p = P(0.1 + r() * 0.8, 0.1 + r() * 0.8);
      ctx.fillRect(p.sx, p.sy, size, size * 0.6);
    }
  };
  const line = (a: SPt, b: SPt, color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  };
  switch (g) {
    case "road": {
      const base = r() < 0.15 ? "#44474d" : r() < 0.5 ? "#3b3e44" : "#393c41";
      poly(ctx, [A, B, C, D], base);
      dots(10, "rgba(255,255,255,0.06)");
      dots(6, "rgba(0,0,0,0.18)");
      if (r() < 0.12) poly(ctx, [P(0.2, 0.3), P(0.7, 0.25), P(0.75, 0.7), P(0.25, 0.75)], "#2f3236"); // old patch
      const side = x >= 14 && x <= 15 && y <= 4;
      if (!side) {
        if (y === 7 && x % 2 === 0) line(P(0.15, 1), P(0.85, 1), "rgba(245,245,235,0.85)", 1.6);
        if (y === 6) line(P(0, 0.06), P(1, 0.06), "rgba(245,245,235,0.6)", 1.2);
        if (y === 9) line(P(0, 0.94), P(1, 0.94), "rgba(245,245,235,0.6)", 1.2);
        if (x >= 14 && x <= 15) for (let k = 0; k < 4; k++) poly(ctx, [P(0.1, k * 0.25 + 0.05), P(0.9, k * 0.25 + 0.05), P(0.9, k * 0.25 + 0.16), P(0.1, k * 0.25 + 0.16)], "rgba(240,240,232,0.8)");
      }
      break;
    }
    case "pave": {
      poly(ctx, [A, B, C, D], r() < 0.5 ? "#bcb4a5" : "#b5ad9e");
      line(P(0.5, 0), P(0.5, 1), "rgba(80,70,60,0.25)", 0.8);
      line(P(0, 0.5), P(1, 0.5), "rgba(80,70,60,0.25)", 0.8);
      dots(4, "rgba(60,50,40,0.2)");
      if (y === 4) line(D, C, "#d8d2c4", 2);
      if (y === 11) line(A, B, "#d8d2c4", 2);
      break;
    }
    case "drain": {
      poly(ctx, [A, B, C, D], "#8c867c");
      poly(ctx, [P(0, 0.2), P(1, 0.2), P(1, 0.8), P(0, 0.8)], "#4b4842");
      poly(ctx, [P(0, 0.35), P(1, 0.35), P(1, 0.7), P(0, 0.7)], "#3a4a4c");
      dots(3, "rgba(120,160,90,0.5)", 2);
      break;
    }
    case "slab": {
      poly(ctx, [A, B, C, D], "#aaa397");
      line(P(0, 0.33), P(1, 0.33), "rgba(60,50,40,0.3)", 0.8);
      line(P(0, 0.66), P(1, 0.66), "rgba(60,50,40,0.3)", 0.8);
      break;
    }
    case "earth": {
      poly(ctx, [A, B, C, D], EARTH[Math.floor(r() * EARTH.length)]);
      dots(8, "rgba(60,20,5,0.25)", 1.8);
      dots(4, "rgba(255,210,170,0.18)");
      if (r() < 0.4) dots(5, "#6a8f3a", 2.2);
      break;
    }
    case "grass": {
      poly(ctx, [A, B, C, D], GRASS[Math.floor(r() * GRASS.length)]);
      dots(14, "rgba(30,60,20,0.35)", 1.6);
      dots(6, "rgba(200,230,140,0.3)", 1.4);
      break;
    }
    case "stage": {
      poly(ctx, [A, B, C, D], r() < 0.5 ? "#9e998f" : "#97928a");
      dots(8, "rgba(0,0,0,0.12)");
      if (x % 2 === 0) line(P(0.05, 0.1), P(0.05, 0.9), "rgba(230,190,40,0.8)", 1.4);
      break;
    }
    case "market": {
      poly(ctx, [A, B, C, D], r() < 0.5 ? "#8d6a48" : "#86643f");
      dots(10, "rgba(230,200,120,0.35)", 2);
      break;
    }
    case "lot": {
      poly(ctx, [A, B, C, D], "#aba59a");
      if (r() < 0.5) line(P(0.2, 0.3), P(0.6, 0.7), "rgba(60,50,40,0.3)", 0.8);
      break;
    }
  }
}

// ---------- buildings ----------

export const BUILDING_EXTRA_TOP: Record<string, number> = { pharmacy: 70, hostel: 24 };

export function buildingBox(b: Building): Box {
  return { x: b.x, y: b.y, w: b.w, d: b.d, h: b.floors * FLOOR_H + 6 };
}

export function drawBuilding(ctx: Ctx, b: Building, night: boolean, billboard: string) {
  const box = buildingBox(b);
  const r = rng(b.x * 97 + b.floors);
  const wall = b.wall;
  const wallL = shade(wall, -0.02), wallR = shade(wall, -0.2);
  isoBox(ctx, box, shade(wall, -0.1), wallL, wallR);

  // weathering streaks under windows
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < b.w * 3; i++) {
    const u = 0.2 + r() * (b.w - 0.4);
    quadY(ctx, box, u, u + 0.04, 6, box.h - 4 - r() * 20, "#000");
  }
  ctx.globalAlpha = 1;

  // plinth
  quadY(ctx, box, 0, b.w, 0, 6, shade(b.trim, -0.25));
  quadX(ctx, box, 0, b.d, 0, 6, shade(b.trim, -0.4));

  // ground floor shop front
  const gf0 = 6, gf1 = 6 + FLOOR_H - 9;
  quadY(ctx, box, 0.25, b.w - 0.25, gf0, gf1, "#2a2420");
  for (let i = 0; i < b.w * 4; i++) {
    const u = 0.35 + (i / (b.w * 4)) * (b.w - 0.7);
    const colors = ["#e0457b", "#f2d23c", "#2f7a4b", "#1f4fd1", "#f4efe4", "#b4442a"];
    quadY(ctx, box, u, u + 0.12, gf0 + 3 + (i % 2) * 6, gf0 + 7 + (i % 2) * 6, colors[Math.floor(r() * colors.length)]);
  }
  quadY(ctx, box, 0.25, b.w - 0.25, gf1 - 4, gf1, "#8d9297"); // rolled-up shutter
  const doorU = b.door.x - b.x + 0.5;
  quadY(ctx, box, doorU - 0.22, doorU + 0.22, gf0, gf1 - 4, night ? "#f5c96a" : "#120f0d");
  // sign board
  quadY(ctx, box, 0.12, b.w - 0.12, gf1, gf1 + 12, b.signBg, "rgba(0,0,0,0.35)");
  signTextY(ctx, box, 0.12, b.w - 0.12, gf1, gf1 + 12, b.sign, b.signFg);

  // upper floors
  for (let f = 1; f < b.floors; f++) {
    const v0 = 6 + f * FLOOR_H + 6;
    const v1 = v0 + 13;
    const n = Math.max(2, Math.round(b.w * 1.5));
    for (let i = 0; i < n; i++) {
      const u = 0.3 + (i * (b.w - 0.6)) / n;
      const lit = night && r() < 0.55;
      quadY(ctx, box, u, u + 0.34, v0, v1, lit ? "#ffd27a" : r() < 0.3 ? "#3d5266" : "#2c3e50");
      if (!lit) quadY(ctx, box, u, u + 0.1, v0 + 2, v1 - 2, "rgba(255,255,255,0.12)");
      for (let k = 1; k < 4; k++) quadY(ctx, box, u + (k * 0.34) / 4 - 0.008, u + (k * 0.34) / 4 + 0.008, v0, v1, "rgba(30,30,30,0.6)"); // burglar bars
    }
    quadY(ctx, box, 0, b.w, v0 - 3, v0 - 1, shade(b.trim, 0.1)); // floor band
    const m = Math.max(1, Math.round(b.d * 1.1));
    for (let i = 0; i < m; i++) {
      const u = 0.35 + (i * (b.d - 0.7)) / m;
      const lit = night && r() < 0.45;
      quadX(ctx, box, u, u + 0.32, v0, v1, lit ? "#e8bf68" : "#26364a");
    }
    if (b.id === "hostel") quadY(ctx, box, 0.1, b.w - 0.1, v0 - 1, v0 + 4, "rgba(240,240,235,0.55)"); // balcony rails
  }
  // painted side ad on the +x face
  if (b.floors >= 2) {
    quadX(ctx, box, 0.3, b.d - 0.3, gf0 + 3, gf1 + 4, shade(b.trim, 0.05));
    signTextX(ctx, box, 0.3, b.d - 0.3, gf0 + 3, gf1 + 4, b.kind.toUpperCase(), "#ffffff");
  }

  // roof
  const { A, B, C, D } = boxCorners(box);
  const h = box.h;
  if (b.roof === "iron") {
    const ridgeL = up(toScreen(b.x, b.y + b.d / 2), h + 16);
    const ridgeR = up(toScreen(b.x + b.w, b.y + b.d / 2), h + 16);
    const tin = "#98a0a5", rust = "#8b4a2b";
    poly(ctx, [up(A, h), up(B, h), ridgeR, ridgeL], shade(tin, -0.25), "rgba(0,0,0,0.2)");
    poly(ctx, [up(D, h), up(C, h), ridgeR, ridgeL], tin, "rgba(0,0,0,0.25)");
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 0.7;
    for (let i = 1; i < b.w * 6; i++) {
      const t = i / (b.w * 6);
      const a = up(toScreen(b.x + t * b.w, b.y + b.d), h);
      const c = up(toScreen(b.x + t * b.w, b.y + b.d / 2), h + 16);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(c.sx, c.sy); ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const t = 0.1 + r() * 0.7;
      const a = up(toScreen(b.x + t * b.w, b.y + b.d * 0.9), h + 3);
      ctx.fillStyle = rust;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(a.sx, a.sy, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    poly(ctx, [up(C, h), up(B, h), ridgeR], wallR, "rgba(0,0,0,0.2)"); // gable
  } else {
    poly(ctx, [up(A, h), up(B, h), up(C, h), up(D, h)], "#8f8b84", "rgba(0,0,0,0.25)");
    // parapet
    const ph = 5;
    poly(ctx, [up(D, h), up(C, h), up(C, h + ph), up(D, h + ph)], shade(wall, 0.05));
    poly(ctx, [up(C, h), up(B, h), up(B, h + ph), up(C, h + ph)], shade(wall, -0.22));
    if (b.roof === "tank") {
      const t = up(toScreen(b.x + 0.9, b.y + 0.9), h);
      ctx.fillStyle = "#1d1f22";
      ctx.fillRect(t.sx - 9, t.sy - 22, 18, 22);
      ctx.beginPath(); ctx.ellipse(t.sx, t.sy - 22, 9, 4, 0, 0, Math.PI * 2); ctx.fillStyle = "#33373c"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(t.sx, t.sy, 9, 4, 0, 0, Math.PI); ctx.fillStyle = "#1d1f22"; ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(t.sx - 9, t.sy - k * 5.5); ctx.lineTo(t.sx + 9, t.sy - k * 5.5); ctx.stroke(); }
      const dish = up(toScreen(b.x + b.w - 0.6, b.y + 0.7), h);
      ctx.fillStyle = "#d9dde0";
      ctx.beginPath(); ctx.ellipse(dish.sx, dish.sy - 8, 6, 7, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#555"; ctx.fillRect(dish.sx - 1, dish.sy - 6, 2, 6);
    }
  }

  if (b.id === "pharmacy") drawRoofBillboard(ctx, box, billboard, night);
}

function drawRoofBillboard(ctx: Ctx, box: Box, text: string, night: boolean) {
  const bb: Box = { x: box.x + 0.4, y: box.y + 1.6, w: box.w - 0.8, d: 0.05, h: 0 };
  const base = box.h + 8;
  // posts
  for (const u of [0.4, bb.w - 0.4]) quadY(ctx, bb, u - 0.03, u + 0.03, base - 8, base + 14, "#2b2b2b");
  const v0 = base + 12, v1 = base + 60;
  quadY(ctx, bb, -0.05, bb.w + 0.05, v0 - 2, v1 + 2, "#1d1f22");
  const g = ctx.createLinearGradient(fy(bb, 0, v1).sx, fy(bb, 0, v1).sy, fy(bb, bb.w, v0).sx, fy(bb, bb.w, v0).sy);
  g.addColorStop(0, "#1f4fd1");
  g.addColorStop(1, "#163a9e");
  quadY(ctx, bb, 0, bb.w, v0, v1, g);
  // matatu checker strip
  const cells = 18;
  for (let i = 0; i < cells; i++) {
    const u0 = (i / cells) * bb.w, u1 = ((i + 1) / cells) * bb.w;
    quadY(ctx, bb, u0, u1, v0 + (i % 2 ? 0 : 4), v0 + (i % 2 ? 4 : 8), "#ffffff");
  }
  signTextY(ctx, bb, 0.05, bb.w - 0.05, v0 + 14, v1 - 4, text, "#ffffff", 900);
  if (night) {
    ctx.fillStyle = "rgba(255,240,200,0.12)";
    const p = fy(bb, bb.w / 2, (v0 + v1) / 2);
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, 70, 40, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- props ----------

export function propBox(p: Prop): Box {
  switch (p.kind) {
    case "tree": return { x: p.x + 0.2, y: p.y + 0.2, w: 0.6, d: 0.6, h: 70 };
    case "lamp": return { x: p.x + 0.4, y: p.y + 0.4, w: 0.2, d: 0.2, h: 56 };
    case "stall": return { x: p.x + 0.1, y: p.y + 0.1, w: 1.8, d: 1.8, h: 40 };
    case "shelter": return { x: p.x, y: p.y + 0.1, w: 3, d: 0.8, h: 40 };
    case "bench": return { x: p.x + 0.15, y: p.y + 0.3, w: 0.7, d: 0.4, h: 8 };
    case "parked": return { x: p.x, y: p.y + 0.05, w: 2.2, d: 0.9, h: 28 };
    case "bush": return { x: p.x + 0.2, y: p.y + 0.2, w: 0.6, d: 0.6, h: 16 };
    case "wall": return { x: p.x, y: p.y + 0.3, w: 30, d: 0.4, h: 12 };
    default: return { x: p.x, y: p.y, w: 1, d: 1, h: 20 };
  }
}

export function drawProp(ctx: Ctx, p: Prop, night: boolean, t: number) {
  const box = propBox(p);
  const base = toScreen(box.x + box.w / 2, box.y + box.d / 2);
  switch (p.kind) {
    case "tree": {
      shadow(ctx, base, 26, 11);
      ctx.fillStyle = "#5a3b24";
      ctx.fillRect(base.sx - 3, base.sy - 30, 6, 30);
      const palettes = [["#2f6b2f", "#3d7f35", "#4f9440"], ["#6f4fa8", "#8466c0", "#9b7fd6"], ["#2d6a3a", "#357a3f", "#468b4c"]];
      const pal = palettes[(p.variant ?? 0) % palettes.length];
      const sway = Math.sin(t / 1400 + p.x) * 1.5;
      const blobs: [number, number, number, number][] = [[-14, -44, 15, 0], [12, -46, 14, 1], [0, -60, 17, 2], [-4, -40, 13, 1], [8, -34, 11, 0]];
      for (const [dx, dy, rr, ci] of blobs) {
        ctx.fillStyle = pal[ci];
        ctx.beginPath(); ctx.arc(base.sx + dx + sway, base.sy + dy, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.arc(base.sx - 6 + sway, base.sy - 64, 8, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "lamp": {
      ctx.fillStyle = "#3a3f44";
      ctx.fillRect(base.sx - 1.5, base.sy - 54, 3, 54);
      ctx.fillRect(base.sx - 1.5, base.sy - 54, 12, 2.5);
      ctx.fillStyle = night ? "#ffe3a0" : "#cfd3d6";
      ctx.fillRect(base.sx + 6, base.sy - 52, 7, 3);
      break;
    }
    case "stall": {
      shadow(ctx, base, 40, 18);
      const table: Box = { x: box.x + 0.15, y: box.y + 0.2, w: 1.5, d: 1.3, h: 14 };
      isoBox(ctx, table, "#9c6b3c", "#7d5530", "#6a4628");
      const goods = [["#c8332b", "#e04a3a"], ["#6a8f2a", "#7fa63a"], ["#a7c957", "#8ab13f"]][(p.variant ?? 0) % 3];
      for (let i = 0; i < 6; i++) {
        const q = toScreen(table.x + 0.3 + (i % 3) * 0.45, table.y + 0.35 + Math.floor(i / 3) * 0.55);
        ctx.fillStyle = goods[i % 2];
        ctx.beginPath(); ctx.ellipse(q.sx, q.sy - 16, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(q.sx, q.sy - 20, 3.5, 0, Math.PI * 2); ctx.fill();
      }
      // tarp on poles
      for (const [u, v] of [[0.1, 0.1], [1.7, 0.1], [1.7, 1.7], [0.1, 1.7]]) {
        const q = toScreen(box.x + u, box.y + v);
        ctx.fillStyle = "#4a3726";
        ctx.fillRect(q.sx - 1, q.sy - 40, 2, 40);
      }
      const tarp = ["#2457c5", "#e07a1f", "#2f7a4b"][(p.variant ?? 0) % 3];
      const c = boxCorners(box);
      poly(ctx, [up(c.A, 44), up(c.B, 40), up(c.C, 36), up(c.D, 40)], tarp, "rgba(0,0,0,0.25)");
      poly(ctx, [up(c.D, 40), up(c.C, 36), up(c.C, 31), up(c.D, 35)], shade(tarp, -0.2));
      break;
    }
    case "shelter": {
      shadow(ctx, base, 60, 18);
      const posts = [0.1, 1.5, 2.9];
      for (const u of posts) {
        const q = toScreen(box.x + u, box.y + box.d - 0.05);
        ctx.fillStyle = "#2f3337";
        ctx.fillRect(q.sx - 1.5, q.sy - 38, 3, 38);
      }
      const bench: Box = { x: box.x + 0.3, y: box.y + 0.25, w: 2.4, d: 0.3, h: 7 };
      isoBox(ctx, bench, "#8a5a33", "#6d4627", "#5a3a20");
      const c = boxCorners(box);
      poly(ctx, [up(c.A, 42), up(c.B, 42), up(c.C, 38), up(c.D, 38)], "#a3abb0", "rgba(0,0,0,0.3)");
      quadY(ctx, box, 0.6, 2.4, 38, 30, "#1f4fd1");
      signTextY(ctx, box, 0.6, 2.4, 30, 38, "WANDEGEYA STAGE", "#ffffff");
      break;
    }
    case "bench": {
      shadow(ctx, base, 16, 6);
      isoBox(ctx, box, "#9c6b3c", "#7d5530", "#6a4628");
      break;
    }
    case "parked": {
      drawMatatu(ctx, box.x + box.w / 2, box.y + box.d / 2, 1, "#f4f4ef", false, night);
      break;
    }
    case "bush": {
      ctx.fillStyle = "#3f7f37";
      ctx.beginPath(); ctx.ellipse(base.sx, base.sy - 7, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e0457b";
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(base.sx - 8 + i * 5, base.sy - 10 - (i % 2) * 3, 1.8, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "wall": {
      isoBox(ctx, box, "#d9d2c3", "#e6dfd0", "#bdb5a6");
      for (let i = 0; i < 30; i += 2) quadY(ctx, box, i, i + 1, 0, 3, "#1f4fd1");
      break;
    }
    default:
      break;
  }
}

function shadow(ctx: Ctx, p: SPt, rx: number, ry: number) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

// ---------- kiosks ----------

export interface KioskLook {
  name: string;
  color: string;
  upgrades: string[];
  mine: boolean;
}

export function kioskBox(x: number, y: number): Box {
  return { x: x + 0.25, y: y + 0.25, w: 1.5, d: 1.3, h: 34 };
}

export function drawPlot(ctx: Ctx, x: number, y: number, k: KioskLook | null, night: boolean, t: number) {
  if (!k) {
    // To-let board
    const p = toScreen(x + 1, y + 1.2);
    ctx.fillStyle = "#3b3f44";
    ctx.fillRect(p.sx - 1.5, p.sy - 34, 3, 34);
    const board: Box = { x: x + 0.45, y: y + 1.2, w: 1.1, d: 0.02, h: 0 };
    quadY(ctx, board, 0, 1.1, 22, 42, "#f4efe4", "#b4442a");
    signTextY(ctx, board, 0, 1.1, 31, 41, "TO LET", "#b4442a", 900);
    signTextY(ctx, board, 0, 1.1, 23, 31, "UGX 25,000 / WEEK", "#13202b", 700);
    return;
  }
  const b = kioskBox(x, y);
  const base = toScreen(b.x + b.w / 2, b.y + b.d / 2);
  shadow(ctx, base, 34, 14);
  if (k.upgrades.includes("shade")) drawUmbrella(ctx, toScreen(x + 1.85, y + 1.7), k.color);
  isoBox(ctx, b, shade(k.color, -0.1), k.color, shade(k.color, -0.25));
  // serving hatch
  quadY(ctx, b, 0.2, b.w - 0.2, 10, 24, "#231d18");
  quadY(ctx, b, 0.15, b.w - 0.15, 9, 11, "#c79a5b");
  for (let i = 0; i < 5; i++) quadY(ctx, b, 0.3 + i * 0.22, 0.42 + i * 0.22, 12, 16 + (i % 2) * 3, ["#f2d23c", "#e0457b", "#7fa63a", "#f4efe4"][i % 4]);
  // roof slab
  const roof: Box = { x: b.x - 0.1, y: b.y - 0.1, w: b.w + 0.2, d: b.d + 0.25, h: 0 };
  const c = boxCorners(roof);
  poly(ctx, [up(c.A, 38), up(c.B, 38), up(c.C, 38), up(c.D, 38)], "#d7d2c8", "rgba(0,0,0,0.25)");
  poly(ctx, [up(c.D, 34), up(c.C, 34), up(c.C, 38), up(c.D, 38)], "#bfb9ae");
  if (k.upgrades.includes("solar")) {
    // panel lying on the roof, tilted toward the sun
    const s0 = up(toScreen(b.x + 0.25, b.y + 0.15), 40), s1 = up(toScreen(b.x + 1.05, b.y + 0.15), 44);
    const s2 = up(toScreen(b.x + 1.05, b.y + 0.7), 41), s3 = up(toScreen(b.x + 0.25, b.y + 0.7), 37);
    poly(ctx, [s0, s1, s2, s3], "#1a2a55", "#c9d2e8");
    ctx.strokeStyle = "rgba(200,215,240,0.5)";
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo((s0.sx + s1.sx) / 2, (s0.sy + s1.sy) / 2); ctx.lineTo((s3.sx + s2.sx) / 2, (s3.sy + s2.sy) / 2); ctx.stroke();
  }
  // raised sign board on top, the way kiosks on the street do it
  const sign: Box = { x: b.x - 0.05, y: b.y + b.d, w: b.w + 0.1, d: 0.02, h: 0 };
  for (const u of [0.15, sign.w - 0.15]) quadY(ctx, sign, u - 0.02, u + 0.02, 36, 42, "#3a3a3a");
  quadY(ctx, sign, 0, sign.w, 41, 57, "#f4efe4", k.color);
  quadY(ctx, sign, 0, sign.w, 41, 44, k.color);
  signTextY(ctx, sign, 0.04, sign.w - 0.04, 44, 57, k.name, k.color, 900);
  if (k.upgrades.includes("solar") && night) {
    const g = ctx.createRadialGradient(base.sx, base.sy - 14, 2, base.sx, base.sy - 14, 60);
    g.addColorStop(0, "rgba(255,230,160,0.55)");
    g.addColorStop(1, "rgba(255,230,160,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(base.sx, base.sy - 14, 60, 0, Math.PI * 2); ctx.fill();
  }
  if (k.upgrades.includes("speaker")) {
    const q = toScreen(b.x + b.w + 0.05, b.y + b.d - 0.2);
    ctx.fillStyle = "#151515";
    ctx.fillRect(q.sx - 4, q.sy - 12, 8, 12);
    ctx.fillStyle = "#444";
    ctx.beginPath(); ctx.arc(q.sx, q.sy - 6, 2.5, 0, Math.PI * 2); ctx.fill();
    const bob = Math.sin(t / 200) * 2;
    ctx.fillStyle = "#13202b";
    ctx.font = "700 10px system-ui";
    ctx.fillText("♪", q.sx + 4, q.sy - 18 + bob);
  }
  if (k.mine) {
    ctx.fillStyle = "#1f4fd1";
    const q = up(toScreen(b.x + b.w / 2, b.y + b.d), 66);
    ctx.beginPath(); ctx.moveTo(q.sx, q.sy); ctx.lineTo(q.sx - 5, q.sy - 8); ctx.lineTo(q.sx + 5, q.sy - 8); ctx.closePath(); ctx.fill();
  }
}

function drawUmbrella(ctx: Ctx, p: SPt, color: string) {
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(p.sx - 1, p.sy - 46, 2, 46);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? color : "#f4efe4";
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy - 54);
    ctx.lineTo(p.sx + Math.cos(a0) * 30, p.sy - 44 + Math.sin(a0) * 13);
    ctx.lineTo(p.sx + Math.cos(a1) * 30, p.sy - 44 + Math.sin(a1) * 13);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- people ----------

export function drawPerson(ctx: Ctx, sx: number, sy: number, look: Look, phase: number, moving: boolean, flip: boolean, scale = 1, carrying = false) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(flip ? -scale : scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.8, 0, 0, Math.PI * 2); ctx.fill();
  const swing = moving ? Math.sin(phase) * 3 : 0;
  const bob = moving ? Math.abs(Math.sin(phase)) * 1.2 : 0;
  ctx.translate(0, -bob);
  // legs
  ctx.fillStyle = look.pants;
  ctx.fillRect(-4.5 + swing * 0.5, -14, 4, 13);
  ctx.fillRect(0.5 - swing * 0.5, -14, 4, 13);
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(-5 + swing * 0.5, -2, 5, 2.2);
  ctx.fillRect(0.3 - swing * 0.5, -2, 5, 2.2);
  // arm behind
  ctx.fillStyle = shade(look.skin, -0.15);
  ctx.fillRect(5, -27 - (carrying ? 4 : 0) + swing * (carrying ? 0 : 0.6), 3.4, carrying ? 9 : 12);
  // torso
  ctx.fillStyle = look.shirt;
  roundRect(ctx, -7, -29, 14, 16, 3.5);
  ctx.fill();
  ctx.fillStyle = shade(look.shirt, -0.2);
  ctx.fillRect(3, -29, 4, 16);
  // arm front
  ctx.fillStyle = look.skin;
  ctx.fillRect(-8.4, -27 - (carrying ? 4 : 0) - swing * (carrying ? 0 : 0.6), 3.4, carrying ? 9 : 12);
  if (carrying) {
    ctx.fillStyle = "#c08a4a";
    ctx.fillRect(-7, -31, 14, 9);
    ctx.fillStyle = "#9a6b34";
    ctx.fillRect(-7, -27, 14, 1.4);
  }
  // neck + head
  ctx.fillStyle = look.skin;
  ctx.fillRect(-2, -32, 4, 4);
  ctx.beginPath(); ctx.arc(0, -36.5, 5.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1a1210";
  ctx.fillRect(-2.6, -37, 1.4, 1.6);
  ctx.fillRect(1.4, -37, 1.4, 1.6);
  // hair
  ctx.fillStyle = "#16100d";
  switch (look.hair) {
    case "short":
      ctx.beginPath(); ctx.arc(0, -37.5, 6, Math.PI, 0); ctx.fill();
      break;
    case "bun":
      ctx.beginPath(); ctx.arc(0, -37.5, 6.2, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -45, 3.6, 0, Math.PI * 2); ctx.fill();
      break;
    case "braids":
      ctx.beginPath(); ctx.arc(0, -37.5, 6.3, Math.PI, 0); ctx.fill();
      for (const dx of [-6, -4.4, 4.4, 6]) ctx.fillRect(dx - 0.8, -38, 1.6, 12);
      break;
    case "cap":
      ctx.fillStyle = look.shirt === "#b4442a" ? "#13202b" : "#b4442a";
      ctx.beginPath(); ctx.arc(0, -38, 6.2, Math.PI, 0); ctx.fill();
      ctx.fillRect(-1, -39, 9, 2.4);
      break;
  }
  ctx.restore();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- vehicles ----------

/** Matatu centred on (cx, cy) in tiles. dir 1 = heading +x. */
export function drawMatatu(ctx: Ctx, cx: number, cy: number, dir: number, body: string, braking: boolean, night: boolean) {
  const b: Box = { x: cx - 1.1, y: cy - 0.45, w: 2.2, d: 0.9, h: 26 };
  shadow(ctx, toScreen(cx, cy), 42, 14);
  isoBox(ctx, b, shade(body, -0.06), body, shade(body, -0.18));
  // windows band
  quadY(ctx, b, 0.25, 2.05, 13, 22, "#26323d");
  for (let i = 1; i < 5; i++) quadY(ctx, b, 0.25 + i * 0.36 - 0.02, 0.25 + i * 0.36 + 0.02, 13, 22, body);
  // checker stripe, the matatu signature
  const cells = 22;
  for (let i = 0; i < cells; i++) {
    const u0 = (i / cells) * 2.2, u1 = ((i + 1) / cells) * 2.2;
    quadY(ctx, b, u0, u1, i % 2 ? 7 : 9.5, i % 2 ? 9.5 : 12, "#1f4fd1");
  }
  // front or back on the +x face
  if (dir > 0) {
    quadX(ctx, b, 0.08, 0.82, 12, 23, "#2c3b48");
    quadX(ctx, b, 0.08, 0.2, 5, 8, night ? "#fff6c8" : "#e6e6da");
    quadX(ctx, b, 0.7, 0.82, 5, 8, night ? "#fff6c8" : "#e6e6da");
  } else {
    quadX(ctx, b, 0.15, 0.75, 14, 22, "#2c3b48");
    const tail = braking ? "#ff3b2f" : "#a3241b";
    quadX(ctx, b, 0.06, 0.18, 6, 10, tail);
    quadX(ctx, b, 0.72, 0.84, 6, 10, tail);
  }
  // roof rack
  const rack: Box = { x: b.x + 0.4, y: b.y + 0.15, w: 1.4, d: 0.6, h: 29 };
  const rc = boxCorners(rack);
  poly(ctx, [up(rc.A, 29), up(rc.B, 29), up(rc.C, 29), up(rc.D, 29)], "rgba(40,40,40,0.5)");
  wheels(ctx, b, [0.4, 1.8]);
}

export function drawCar(ctx: Ctx, cx: number, cy: number, dir: number, body: string, braking: boolean, night: boolean) {
  const b: Box = { x: cx - 0.8, y: cy - 0.38, w: 1.6, d: 0.76, h: 12 };
  shadow(ctx, toScreen(cx, cy), 30, 11);
  isoBox(ctx, b, shade(body, -0.05), body, shade(body, -0.2));
  const cab: Box = { x: cx - 0.4, y: cy - 0.32, w: 0.85, d: 0.64, h: 21 };
  const cc = boxCorners(cab);
  poly(ctx, [up(cc.D, 12), up(cc.C, 12), up(cc.C, 21), up(cc.D, 21)], "#2a3540");
  poly(ctx, [up(cc.C, 12), up(cc.B, 12), up(cc.B, 21), up(cc.C, 21)], "#222c35");
  poly(ctx, [up(cc.A, 21), up(cc.B, 21), up(cc.C, 21), up(cc.D, 21)], shade(body, -0.1));
  if (dir > 0) {
    quadX(ctx, b, 0.06, 0.18, 5, 8, night ? "#fff6c8" : "#e6e6da");
    quadX(ctx, b, 0.58, 0.7, 5, 8, night ? "#fff6c8" : "#e6e6da");
  } else {
    quadX(ctx, b, 0.06, 0.18, 6, 9, braking ? "#ff3b2f" : "#a3241b");
    quadX(ctx, b, 0.58, 0.7, 6, 9, braking ? "#ff3b2f" : "#a3241b");
  }
  wheels(ctx, b, [0.35, 1.25]);
}

const RIDER: Look = { skin: "#6b4228", shirt: "#e07a1f", hair: "cap", pants: "#2b2f38" };
const PASSENGER: Look = { skin: "#8d5a3b", shirt: "#7a2fa8", hair: "braids", pants: "#3a3f4a" };

export function drawBoda(ctx: Ctx, cx: number, cy: number, dir: number, passenger: boolean, t: number, night: boolean) {
  const p = toScreen(cx, cy);
  shadow(ctx, p, 16, 6);
  const flip = dir < 0;
  ctx.save();
  ctx.translate(p.sx, p.sy);
  if (flip) ctx.scale(-1, 1);
  // bike body runs along +x on screen: (+32,+16) per tile
  ctx.strokeStyle = "#151515";
  ctx.lineWidth = 2.4;
  ctx.fillStyle = "#151515";
  ctx.beginPath(); ctx.ellipse(-11, -6, 5, 5.5, 0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(11, 4, 5, 5.5, 0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#b4442a";
  ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(8, -2); ctx.lineTo(10, -6); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#222";
  ctx.fillRect(-8, -16, 12, 3);
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(12, -16); ctx.stroke();
  if (night) {
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath(); ctx.arc(14, -8, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  const vib = Math.sin(t / 40) * 0.4;
  if (passenger) drawPerson(ctx, p.sx - (flip ? -7 : 7), p.sy - 6 + vib, PASSENGER, 0, false, flip, 0.9);
  drawPerson(ctx, p.sx + (flip ? -2 : 2), p.sy - 4 + vib, RIDER, 0, false, flip, 0.95);
}

function wheels(ctx: Ctx, b: Box, us: number[]) {
  ctx.fillStyle = "#151515";
  for (const u of us) {
    const q = fy(b, u, 1);
    ctx.beginPath(); ctx.ellipse(q.sx, q.sy, 5.5, 4.5, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6d6d6d";
    ctx.beginPath(); ctx.ellipse(q.sx, q.sy, 2, 1.6, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#151515";
  }
}

// ---------- backdrop ----------

/** Kampala hills behind the street, drawn in screen space with parallax. */
export function drawBackdrop(ctx: Ctx, w: number, h: number, offsetX: number, offsetY: number, night: boolean, rain: boolean, dusk: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (night) {
    sky.addColorStop(0, "#0b1530");
    sky.addColorStop(1, "#24304f");
  } else if (dusk > 0) {
    sky.addColorStop(0, "#3b4f86");
    sky.addColorStop(0.6, "#e28a5b");
    sky.addColorStop(1, "#f2c48a");
  } else if (rain) {
    sky.addColorStop(0, "#7b8794");
    sky.addColorStop(1, "#aeb7bf");
  } else {
    sky.addColorStop(0, "#5fa3e0");
    sky.addColorStop(1, "#cfe6f5");
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const hills: [string, number, number, number][] = night
    ? [["#1a2440", 0.25, 0.42, 0.11], ["#141c33", 0.4, 0.5, 0.09]]
    : rain
      ? [["#7d8a83", 0.25, 0.42, 0.11], ["#6d7a6f", 0.4, 0.5, 0.09]]
      : [["#8fae8a", 0.25, 0.42, 0.11], ["#6f9369", 0.4, 0.5, 0.09]];
  for (const [color, par, baseY, amp] of hills) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const ox = offsetX * par, oy = offsetY * par;
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 20; x += 20) {
      const wx = x + ox;
      const y = h * baseY + oy - (Math.sin(wx / 210) * 0.6 + Math.sin(wx / 97 + 1) * 0.3 + 1) * h * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    // tiny rooftops on the hills
    const r = rng(Math.floor(par * 100));
    for (let x = 0; x < w; x += 9) {
      const wx = x + ox;
      if (r() < 0.45) continue;
      const y = h * baseY + oy - (Math.sin(wx / 210) * 0.6 + Math.sin(wx / 97 + 1) * 0.3 + 1) * h * amp + 4 + r() * 18;
      ctx.fillStyle = night ? (r() < 0.35 ? "#f6cf72" : "#2a3352") : r() < 0.5 ? "#c96f4a" : r() < 0.5 ? "#e8e1d4" : "#9aa1a6";
      ctx.fillRect(x, y, night ? 2 : 4, night ? 2 : 3);
    }
  }
}

