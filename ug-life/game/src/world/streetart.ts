// Street food carts, things players build in their yard, the Makerere gate and
// the landmarks on the hills. Coordinates are world pixels (see iso.ts), except the
// skyline, which is drawn in screen space behind the street.

import { toScreen, type Box, type SPt } from "./iso";
import { drawPerson, isoBox, poly, quadY, shade, shadow, signTextY } from "./art";
import type { Vendor } from "../content/catalog";
import type { Landmark } from "../content/landmarks";
import type { Look } from "../game/state";

type Ctx = CanvasRenderingContext2D;

const up = (p: SPt, v: number): SPt => ({ sx: p.sx, sy: p.sy - v });

const SELLERS: Record<Vendor["cart"], Look> = {
  rolex: { skin: "#5c3a24", shirt: "#f4efe4", hair: "cap", pants: "#2b2f38" },
  maize: { skin: "#8d5a3b", shirt: "#e0457b", hair: "braids", pants: "#5a3b24" },
  fruit: { skin: "#6b4228", shirt: "#2f7a4b", hair: "short", pants: "#13202b" },
};

// ---------- food carts ----------

export function drawCart(ctx: Ctx, x: number, y: number, vendor: Vendor) {
  const base = toScreen(x + 0.5, y + 0.5);
  shadow(ctx, base, 26, 11);
  // the seller stands behind the cart, toward the pavement
  const sp = toScreen(x + 0.5, y + 0.15);
  if (vendor.cart === "rolex") {
    const cart: Box = { x: x + 0.15, y: y + 0.3, w: 0.75, d: 0.5, h: 16 };
    drawPerson(ctx, sp.sx, sp.sy, SELLERS.rolex, 0, false, false, 1);
    isoBox(ctx, cart, "#9aa1a6", "#b9c0c5", "#7d8489");
    // hot plate with a chapati on it
    const pan = up(toScreen(x + 0.5, y + 0.55), 17);
    ctx.fillStyle = "#1d1f22";
    ctx.beginPath(); ctx.ellipse(pan.sx, pan.sy, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e3b465";
    ctx.beginPath(); ctx.ellipse(pan.sx - 2, pan.sy, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f6e27a";
    ctx.beginPath(); ctx.ellipse(pan.sx + 4, pan.sy + 0.5, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    // tomatoes, cabbage and eggs on the side
    const side = up(toScreen(x + 0.85, y + 0.6), 16);
    ctx.fillStyle = "#c8332b"; ctx.beginPath(); ctx.arc(side.sx, side.sy, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a7c957"; ctx.beginPath(); ctx.arc(side.sx + 5, side.sy + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4efe4"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(side.sx - 6 + i * 2.6, side.sy + 2, 1.3, 1.7, 0, 0, Math.PI * 2); ctx.fill(); }
    // steam
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(pan.sx - 4 + i * 4, pan.sy - 3); ctx.quadraticCurveTo(pan.sx - 7 + i * 4, pan.sy - 9, pan.sx - 4 + i * 4, pan.sy - 14); ctx.stroke(); }
    umbrella(ctx, toScreen(x + 0.9, y + 0.85), "#b4442a");
    sign(ctx, cart, "ROLEX", "#b4442a");
  } else if (vendor.cart === "maize") {
    drawPerson(ctx, sp.sx, sp.sy, SELLERS.maize, 0, false, true, 1);
    const grill: Box = { x: x + 0.2, y: y + 0.35, w: 0.6, d: 0.4, h: 12 };
    isoBox(ctx, grill, "#2b2b2b", "#3a3a3a", "#202020");
    const top = up(toScreen(x + 0.5, y + 0.55), 13);
    ctx.fillStyle = "#e05a1c";
    ctx.beginPath(); ctx.ellipse(top.sx, top.sy, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#e8b730" : "#d9a400";
      ctx.save(); ctx.translate(top.sx - 6 + i * 4, top.sy - 1); ctx.rotate(0.5); ctx.fillRect(-1.6, -5, 3.2, 10); ctx.restore();
    }
    ctx.fillStyle = "rgba(220,220,220,0.55)";
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(top.sx - 2 + i * 2, top.sy - 8 - i * 6, 3 + i, 0, Math.PI * 2); ctx.fill(); }
  } else {
    drawPerson(ctx, sp.sx, sp.sy, SELLERS.fruit, 0, false, false, 1);
    const barrow: Box = { x: x + 0.15, y: y + 0.3, w: 0.7, d: 0.45, h: 10 };
    isoBox(ctx, barrow, "#5a7f9a", "#6e93ae", "#4a6b84");
    const top = up(toScreen(x + 0.5, y + 0.52), 11);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = "#2f7a4b"; ctx.beginPath(); ctx.ellipse(top.sx - 6 + i * 6, top.sy, 3.5, 2.6, 0, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = "#e8b730"; ctx.beginPath(); ctx.ellipse(top.sx - 3 + i * 6, top.sy - 4, 2.4, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#3f7f37"; ctx.beginPath(); ctx.moveTo(top.sx - 3 + i * 6, top.sy - 6); ctx.lineTo(top.sx - 5 + i * 6, top.sy - 10); ctx.lineTo(top.sx - 1 + i * 6, top.sy - 10); ctx.fill();
    }
  }
}

function umbrella(ctx: Ctx, p: SPt, color: string) {
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(p.sx - 1, p.sy - 40, 2, 40);
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? color : "#f4efe4";
    ctx.beginPath();
    ctx.moveTo(p.sx, p.sy - 47);
    ctx.lineTo(p.sx + Math.cos(a0) * 24, p.sy - 39 + Math.sin(a0) * 10);
    ctx.lineTo(p.sx + Math.cos(a1) * 24, p.sy - 39 + Math.sin(a1) * 10);
    ctx.closePath();
    ctx.fill();
  }
}

function sign(ctx: Ctx, b: Box, text: string, color: string) {
  quadY(ctx, b, 0.04, b.w - 0.04, 5, 13, color);
  signTextY(ctx, b, 0.04, b.w - 0.04, 5, 13, text, "#ffffff", 900);
}

// ---------- yard items ----------

export function drawYardItem(ctx: Ctx, x: number, y: number, id: string, night: boolean) {
  const c = toScreen(x + 0.5, y + 0.5);
  switch (id) {
    case "chairs":
      for (const [dx, col] of [[-8, "#c8332b"], [8, "#1f4fd1"]] as const) {
        const b: Box = { x: x + 0.5 + dx / 64 - 0.12, y: y + 0.4, w: 0.24, d: 0.24, h: 8 };
        shadow(ctx, toScreen(b.x + 0.12, b.y + 0.12), 7, 3);
        isoBox(ctx, b, col, shade(col, 0.1), shade(col, -0.2));
        const back: Box = { x: b.x, y: b.y, w: 0.24, d: 0.04, h: 16 };
        isoBox(ctx, back, col, shade(col, 0.05), shade(col, -0.25));
      }
      break;
    case "plant":
      shadow(ctx, c, 8, 3);
      isoBox(ctx, { x: x + 0.38, y: y + 0.38, w: 0.24, d: 0.24, h: 9 }, "#8b4a2b", "#b55d36", "#8b4a2b");
      ctx.fillStyle = "#3f7f37";
      for (const [dx, dy, r] of [[-4, -14, 6], [4, -15, 6], [0, -20, 6]]) { ctx.beginPath(); ctx.arc(c.sx + dx, c.sy + dy, r, 0, Math.PI * 2); ctx.fill(); }
      break;
    case "banana":
      shadow(ctx, c, 14, 5);
      ctx.fillStyle = "#6a8f2a";
      ctx.fillRect(c.sx - 2, c.sy - 26, 4, 26);
      ctx.fillStyle = "#4f8a2e";
      for (let i = 0; i < 5; i++) {
        ctx.save(); ctx.translate(c.sx, c.sy - 26); ctx.rotate(-1.4 + i * 0.7);
        ctx.beginPath(); ctx.ellipse(13, 0, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      break;
    case "crates":
      for (let i = 0; i < 3; i++) {
        const col = i % 2 ? "#d9a400" : "#c8332b";
        isoBox(ctx, { x: x + 0.3, y: y + 0.3, w: 0.4, d: 0.4, h: 0 }, col, col, col);
        const b: Box = { x: x + 0.3, y: y + 0.3, w: 0.4, d: 0.4, h: 8 };
        ctx.save(); ctx.translate(0, -i * 8);
        isoBox(ctx, b, shade(col, 0.1), col, shade(col, -0.2));
        ctx.restore();
      }
      break;
    case "board": {
      shadow(ctx, c, 9, 3);
      const b: Box = { x: x + 0.25, y: y + 0.5, w: 0.5, d: 0.02, h: 0 };
      quadY(ctx, b, 0, 0.5, 2, 24, "#7d5530");
      quadY(ctx, b, 0.03, 0.47, 4, 22, "#22302a");
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const a = toScreen(x + 0.3, y + 0.5), z = toScreen(x + 0.65, y + 0.5);
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy - 18 + i * 4); ctx.lineTo(z.sx, z.sy - 18 + i * 4); ctx.stroke();
      }
      break;
    }
    case "lights": {
      const a = toScreen(x + 0.1, y + 0.5), b = toScreen(x + 0.9, y + 0.5);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(a.sx - 1, a.sy - 30, 2, 30);
      ctx.fillRect(b.sx - 1, b.sy - 30, 2, 30);
      ctx.strokeStyle = "#333"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy - 28); ctx.quadraticCurveTo((a.sx + b.sx) / 2, (a.sy + b.sy) / 2 - 18, b.sx, b.sy - 28); ctx.stroke();
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const px = a.sx + (b.sx - a.sx) * t, py = a.sy - 28 + (b.sy - a.sy) * t + 10 * 4 * t * (1 - t) * -0.25 + 4 * t * (1 - t) * 10;
        ctx.fillStyle = night ? ["#ffd27a", "#ff8a7a", "#9ad1ff"][i % 3] : "#e8e1d4";
        ctx.beginPath(); ctx.arc(px, py, night ? 2.2 : 1.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "flag": {
      ctx.fillStyle = "#cfcfcf";
      ctx.fillRect(c.sx - 1, c.sy - 44, 2, 44);
      const stripes = ["#111111", "#f2d23c", "#d21f26", "#111111", "#f2d23c", "#d21f26"];
      stripes.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(c.sx + 1, c.sy - 44 + i * 3, 22, 3); });
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(c.sx + 12, c.sy - 35, 3.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "jerrycan":
      for (let i = 0; i < 3; i++) {
        const b: Box = { x: x + 0.2 + i * 0.2, y: y + 0.4, w: 0.16, d: 0.22, h: 12 };
        isoBox(ctx, b, "#f2d23c", "#e8c42a", "#c9a81e");
        const top = up(toScreen(b.x + 0.08, b.y + 0.05), 13);
        ctx.fillStyle = "#c9a81e"; ctx.fillRect(top.sx - 1.5, top.sy - 2, 3, 2);
      }
      break;
    case "bicycle": {
      ctx.strokeStyle = "#13202b"; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(c.sx - 9, c.sy - 6, 6, 6, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(c.sx + 9, c.sy + 1, 6, 6, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#1f4fd1"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.sx - 9, c.sy - 6); ctx.lineTo(c.sx - 1, c.sy - 12); ctx.lineTo(c.sx + 9, c.sy + 1); ctx.lineTo(c.sx - 1, c.sy - 3); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = "#c08a4a"; ctx.fillRect(c.sx + 3, c.sy - 12, 10, 5);
      break;
    }
  }
}

// ---------- Makerere gate at the top of the side road ----------

export function drawGate(ctx: Ctx, x: number, y: number, night: boolean) {
  const b: Box = { x, y: y + 0.45, w: 2, d: 0.1, h: 0 };
  for (const u of [0, 1.82]) {
    const pillar: Box = { x: x + u, y: y + 0.35, w: 0.18, d: 0.3, h: 46 };
    isoBox(ctx, pillar, "#d8d2c4", "#ece6d8", "#c4bdaf");
  }
  quadY(ctx, b, -0.05, 2.05, 46, 60, "#7a1f2b");
  signTextY(ctx, b, 0.05, 1.95, 47, 59, "MAKERERE UNIVERSITY", "#f4efe4", 900);
  if (night) {
    ctx.fillStyle = "rgba(255,230,160,0.25)";
    const p = up(toScreen(x + 1, y + 0.5), 53);
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, 60, 24, 0, 0, Math.PI * 2); ctx.fill();
  }
  poly(ctx, [up(toScreen(x, y + 0.5), 60), up(toScreen(x + 2, y + 0.5), 60), up(toScreen(x + 2, y + 0.5), 62), up(toScreen(x, y + 0.5), 62)], "#d8d2c4");
}

// ---------- landmarks on the hills ----------

export interface SkylineHit {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Draws one landmark with its base at (x, y) in screen pixels. s = scale. Returns its tap area. */
export function drawSkylineLandmark(ctx: Ctx, lm: Landmark, x: number, y: number, s: number, night: boolean, haze: string): SkylineHit {
  const col = (day: string, nightCol: string) => (night ? nightCol : day);
  const win = night ? "#f6cf72" : "rgba(40,60,80,0.5)";
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = haze === "far" ? 0.82 : 0.95;
  let w = 40, h = 40;
  switch (lm.draw) {
    case "makerere": {
      w = 56; h = 62;
      ctx.fillStyle = col("#f4f1ea", "#3a4466"); ctx.fillRect(-28, -22, 56, 22);
      ctx.fillStyle = col("#b4442a", "#2a2f45"); ctx.fillRect(-30, -25, 60, 4);
      ctx.fillStyle = col("#f4f1ea", "#3a4466"); ctx.fillRect(-6, -52, 12, 30);
      ctx.fillStyle = col("#b4442a", "#2a2f45"); ctx.beginPath(); ctx.moveTo(-8, -52); ctx.lineTo(0, -62); ctx.lineTo(8, -52); ctx.fill();
      ctx.fillStyle = col("#13202b", "#f6cf72"); ctx.beginPath(); ctx.arc(0, -44, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = win; for (let i = 0; i < 6; i++) ctx.fillRect(-24 + i * 8 + (i > 2 ? 4 : 0), -16, 3, 8);
      break;
    }
    case "mosque": {
      w = 60; h = 80;
      ctx.fillStyle = col("#efe6d2", "#3a4466"); ctx.fillRect(-26, -20, 46, 20);
      ctx.beginPath(); ctx.arc(-3, -20, 14, Math.PI, 0); ctx.fill();
      ctx.fillStyle = col("#c9a24a", "#4a4a6a"); ctx.fillRect(-4, -38, 2, 5);
      ctx.fillStyle = col("#efe6d2", "#3a4466"); ctx.fillRect(22, -78, 6, 78);
      ctx.fillStyle = col("#c9a24a", "#4a4a6a"); ctx.beginPath(); ctx.moveTo(20, -78); ctx.lineTo(25, -86); ctx.lineTo(30, -78); ctx.fill();
      ctx.fillStyle = win; ctx.fillRect(23, -60, 4, 3); ctx.fillRect(23, -45, 4, 3);
      h = 86;
      break;
    }
    case "namirembe": {
      w = 54; h = 50;
      ctx.fillStyle = col("#a5532d", "#3a3352"); ctx.fillRect(-26, -22, 52, 22);
      ctx.beginPath(); ctx.arc(0, -22, 13, Math.PI, 0); ctx.fill();
      ctx.fillStyle = col("#7a3a20", "#2a2540"); ctx.fillRect(-24, -34, 7, 12); ctx.fillRect(17, -34, 7, 12);
      ctx.fillStyle = col("#e8e1d4", "#f6cf72"); ctx.fillRect(-1, -42, 2, 8); ctx.fillRect(-3, -39, 6, 2);
      ctx.fillStyle = win; for (let i = 0; i < 5; i++) ctx.fillRect(-20 + i * 9, -14, 3, 7);
      break;
    }
    case "rubaga": {
      w = 52; h = 58;
      ctx.fillStyle = col("#efe3c8", "#3a4466"); ctx.fillRect(-22, -24, 44, 24);
      ctx.fillRect(-22, -50, 11, 26); ctx.fillRect(11, -50, 11, 26);
      ctx.fillStyle = col("#7d6a4a", "#2a2f45"); ctx.beginPath(); ctx.moveTo(-23, -50); ctx.lineTo(-16.5, -58); ctx.lineTo(-10, -50); ctx.fill();
      ctx.beginPath(); ctx.moveTo(10, -50); ctx.lineTo(16.5, -58); ctx.lineTo(23, -50); ctx.fill();
      ctx.fillStyle = win; ctx.beginPath(); ctx.arc(0, -14, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "bahai": {
      w = 48; h = 46;
      ctx.fillStyle = col("#e8e1d4", "#3a4466"); ctx.fillRect(-20, -14, 40, 14);
      ctx.fillStyle = col("#3f8a5a", "#2a5040"); ctx.beginPath(); ctx.arc(0, -14, 17, Math.PI, 0); ctx.fill();
      ctx.fillStyle = col("#e8e1d4", "#f6cf72"); ctx.fillRect(-1, -38, 2, 8);
      ctx.fillStyle = col("#2f6b45", "#22402f"); ctx.fillRect(-18, -16, 36, 2);
      h = 40;
      break;
    }
    case "towers": {
      w = 80; h = 70;
      const t: [number, number, number, string][] = [[-38, 14, 44, "#9fb3c2"], [-22, 12, 62, "#c9d3da"], [-8, 16, 52, "#7d93a6"], [10, 12, 70, "#e1e6ea"], [24, 14, 40, "#a9b9c6"]];
      for (const [tx, tw, th, c] of t) {
        ctx.fillStyle = col(c, "#2a3352"); ctx.fillRect(tx, -th, tw, th);
        ctx.fillStyle = win;
        for (let yy = -th + 5; yy < -3; yy += 6) for (let xx = tx + 2; xx < tx + tw - 2; xx += 4) if ((xx * 7 + yy * 3) % 5 !== 0) ctx.fillRect(xx, yy, 2, 3);
      }
      break;
    }
    case "hospital": {
      w = 70; h = 34;
      ctx.fillStyle = col("#e8eef0", "#3a4466"); ctx.fillRect(-35, -30, 70, 30);
      ctx.fillStyle = win; for (let r = 0; r < 4; r++) for (let i = 0; i < 12; i++) ctx.fillRect(-32 + i * 5.6, -27 + r * 7, 3, 4);
      ctx.fillStyle = col("#2f7a4b", "#2a5040"); ctx.fillRect(-2, -36, 4, 6); ctx.fillRect(-5, -34, 10, 2);
      h = 36;
      break;
    }
    default:
      break;
  }
  ctx.restore();
  return { id: lm.id, x0: x - (w / 2) * s - 6, y0: y - h * s - 6, x1: x + (w / 2) * s + 6, y1: y + 6 };
}
