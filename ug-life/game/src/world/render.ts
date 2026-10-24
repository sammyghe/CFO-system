import { BUILDINGS, MAP_H, MAP_W, OUTER, PLOTS, POTHOLE, PROPS, groundAt, outerGround, type Building } from "./map";
import { HH, HW, boxBounds, boxSilhouette, pointInPoly, toScreen, toWorld, type Box, type SPt } from "./iso";
import {
  BUILDING_EXTRA_TOP, buildingBox, drawBackdrop, drawBoda, drawBuilding, drawCar, drawMatatu, drawPerson, drawPlot,
  drawProp, drawTile, kioskBox, propBox, type KioskLook,
} from "./art";
import { LANE_Y, LANE_DIR, type Sim, type Walker } from "./sim";
import type { CivicIssue } from "../game/civic";
import type { Pt } from "./path";

export interface SceneState {
  night: boolean;
  dusk: number;
  rain: boolean;
  kiosks: Record<string, KioskLook | null>;
  civic: CivicIssue;
  marker: Pt | null;
  markerLabel: string;
  playerTag: TagInfo | null;
  playerCarrying: boolean;
  hiddenTags: string[];
  reducedMotion: boolean;
  billboard: string;
}

export interface TagInfo {
  name: string;
  level: number;
  status?: string;
  socials: string[];
  mine?: boolean;
}

export type Pick =
  | { type: "player" }
  | { type: "resident"; id: string }
  | { type: "building"; building: Building }
  | { type: "plot"; plotId: string }
  | { type: "pothole" }
  | { type: "ground"; x: number; y: number };

interface Sprite {
  canvas: HTMLCanvasElement;
  x0: number;
  y0: number;
  w: number;
  h: number;
  scale: number;
}

interface Drawable {
  box: Box;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

const SCALE_STEPS = [0.75, 1, 1.5, 2, 3];
const GROUND = {
  x0: (-OUTER - (MAP_H + OUTER)) * HW - 8,
  x1: (MAP_W + OUTER + OUTER) * HW + 8,
  y0: -2 * OUTER * HH - 8,
  y1: (MAP_W + MAP_H + 2 * OUTER) * HH + 8,
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  w = 0;
  h = 0;
  cam = { x: 0, y: 0, zoom: 1 };
  private groundCache: Sprite | null = null;
  private sprites = new Map<string, Sprite>();
  private rainDrops: { x: number; y: number; s: number }[] = [];
  private tagRects: { id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  private ripple: { x: number; y: number; t0: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D is not available on this device.");
    this.ctx = ctx;
    for (let i = 0; i < 140; i++) this.rainDrops.push({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 });
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  /** Drops cached sprites, e.g. when night falls or a kiosk changes. */
  invalidate(prefix?: string) {
    if (!prefix) {
      this.sprites.clear();
      return;
    }
    for (const k of [...this.sprites.keys()]) if (k.startsWith(prefix)) this.sprites.delete(k);
  }

  defaultZoom() {
    return Math.max(0.75, Math.min(1.3, this.w / 520));
  }

  clampCamera() {
    const z = this.cam.zoom;
    this.cam.zoom = Math.max(0.55, Math.min(2.4, z));
    const minX = toScreen(0, MAP_H).sx, maxX = toScreen(MAP_W, 0).sx;
    const minY = -40, maxY = toScreen(MAP_W, MAP_H).sy - 60;
    this.cam.x = Math.max(minX, Math.min(maxX, this.cam.x));
    this.cam.y = Math.max(minY, Math.min(maxY, this.cam.y));
  }

  screenToWorldPx(px: number, py: number): SPt {
    return { sx: (px - this.w / 2) / this.cam.zoom + this.cam.x, sy: (py - this.h / 2) / this.cam.zoom + this.cam.y };
  }

  worldPxToScreen(p: SPt): SPt {
    return { sx: (p.sx - this.cam.x) * this.cam.zoom + this.w / 2, sy: (p.sy - this.cam.y) * this.cam.zoom + this.h / 2 };
  }

  tap(x: number, y: number) {
    this.ripple = { x, y, t0: performance.now() };
  }

  private scaleStep(): number {
    const want = this.cam.zoom * this.dpr;
    return SCALE_STEPS.find((s) => s >= want) ?? SCALE_STEPS[SCALE_STEPS.length - 1];
  }

  private ensureGround(scale: number) {
    const maxDim = 4096;
    const s = Math.min(scale, maxDim / (GROUND.x1 - GROUND.x0), maxDim / (GROUND.y1 - GROUND.y0));
    if (this.groundCache && this.groundCache.scale >= s - 0.01) return;
    const w = GROUND.x1 - GROUND.x0, h = GROUND.y1 - GROUND.y0;
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * s);
    c.height = Math.ceil(h * s);
    const g = c.getContext("2d")!;
    g.setTransform(s, 0, 0, s, -GROUND.x0 * s, -GROUND.y0 * s);
    for (let y = -OUTER; y < MAP_H + OUTER; y++)
      for (let x = -OUTER; x < MAP_W + OUTER; x++) {
        const inside = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
        drawTile(g, x, y, inside ? groundAt(x, y) : outerGround(x, y));
      }
    this.groundCache = { canvas: c, x0: GROUND.x0, y0: GROUND.y0, w, h, scale: s };
  }

  private sprite(key: string, bounds: { x0: number; x1: number; y0: number; y1: number }, scale: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
    const k = `${key}@${scale}`;
    let s = this.sprites.get(k);
    if (!s) {
      const w = bounds.x1 - bounds.x0, h = bounds.y1 - bounds.y0;
      const c = document.createElement("canvas");
      c.width = Math.ceil(w * scale);
      c.height = Math.ceil(h * scale);
      const g = c.getContext("2d")!;
      g.setTransform(scale, 0, 0, scale, -bounds.x0 * scale, -bounds.y0 * scale);
      draw(g);
      s = { canvas: c, x0: bounds.x0, y0: bounds.y0, w, h, scale };
      this.sprites.set(k, s);
    }
    return s;
  }

  render(sim: Sim, scene: SceneState, now: number) {
    const ctx = this.ctx;
    const { zoom } = this.cam;
    const scale = this.scaleStep();
    this.ensureGround(scale);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackdrop(ctx, this.w, this.h, this.cam.x * 0.3, -this.cam.y * 0.15 * zoom, scene.night, scene.rain, scene.dusk);

    ctx.setTransform(this.dpr * zoom, 0, 0, this.dpr * zoom, this.dpr * (this.w / 2 - this.cam.x * zoom), this.dpr * (this.h / 2 - this.cam.y * zoom));
    const gc = this.groundCache!;
    ctx.drawImage(gc.canvas, gc.x0, gc.y0, gc.w, gc.h);

    this.drawGroundOverlays(ctx, scene, sim, now);

    const items: Drawable[] = [];
    const nightKey = scene.night ? "n" : "d";
    for (const b of BUILDINGS) {
      const box = buildingBox(b);
      const bb = boxBounds(box, (BUILDING_EXTRA_TOP[b.id] ?? 0) + 22);
      const bounds = { x0: bb.x0 - 4, x1: bb.x1 + 4, y0: bb.y0, y1: bb.y1 + 4 };
      items.push(this.spriteItem(`b:${b.id}:${nightKey}:${scene.billboard}`, box, bounds, scale, (g) => drawBuilding(g, b, scene.night, scene.billboard)));
    }
    for (const p of PROPS) {
      const box = propBox(p);
      const bb = boxBounds(box, 20);
      const bounds = { x0: bb.x0 - 40, x1: bb.x1 + 40, y0: bb.y0 - 10, y1: bb.y1 + 16 };
      items.push(this.spriteItem(`p:${p.kind}:${p.x}:${p.y}:${nightKey}`, box, bounds, scale, (g) => drawProp(g, p, scene.night, 0)));
    }
    for (const plot of PLOTS) {
      const k = scene.kiosks[plot.id] ?? null;
      const box = k ? kioskBox(plot.x, plot.y) : { x: plot.x + 0.4, y: plot.y + 1.1, w: 1.2, d: 0.2, h: 42 };
      const bb = boxBounds(kioskBox(plot.x, plot.y), 30);
      const bounds = { x0: bb.x0 - 30, x1: bb.x1 + 40, y0: bb.y0 - 16, y1: bb.y1 + 30 };
      const key = `k:${plot.id}:${nightKey}:${k ? `${k.name}|${k.color}|${k.upgrades.join(",")}|${k.mine}` : "free"}`;
      items.push(this.spriteItem(key, box, bounds, scale, (g) => drawPlot(g, plot.x, plot.y, k, scene.night, 0)));
    }
    for (const v of sim.vehicles) {
      const cy = LANE_Y[v.lane];
      const len = v.kind === "matatu" ? 2.2 : v.kind === "car" ? 1.6 : 0.9;
      const box: Box = { x: v.x - len / 2, y: cy - 0.45, w: len, d: 0.9, h: 30 };
      const bb = boxBounds(box, 30);
      const dir = LANE_DIR[v.lane];
      items.push({
        box, ...bb,
        draw: (g) => {
          if (v.kind === "matatu") drawMatatu(g, v.x, cy, dir, v.color, v.braking, scene.night);
          else if (v.kind === "car") drawCar(g, v.x, cy, dir, v.color, v.braking, scene.night);
          else drawBoda(g, v.x, cy, dir, v.passenger, now, scene.night);
        },
      });
    }
    const walkers: Walker[] = [...sim.residents, sim.player];
    for (const w of walkers) {
      const box: Box = { x: w.x - 0.2, y: w.y - 0.2, w: 0.4, d: 0.4, h: 46 };
      const p = toScreen(w.x, w.y);
      const carrying = w === sim.player ? scene.playerCarrying : w.carrying;
      items.push({
        box, x0: p.sx - 12, x1: p.sx + 12, y0: p.sy - 50, y1: p.sy + 4,
        draw: (g) => drawPerson(g, p.sx, p.sy, w.look, w.phase, w.moving, w.flip, 1, carrying),
      });
    }
    for (const d of depthSort(items)) d.draw(ctx);

    // potholes crew and cones draw over the road but under the night tint
    this.drawCivicCrew(ctx, scene.civic, now);

    // rain and night tint
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (scene.rain) {
      ctx.fillStyle = "rgba(40,55,70,0.22)";
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (scene.night || scene.dusk > 0) {
      ctx.fillStyle = scene.night ? "rgba(10,18,48,0.5)" : `rgba(80,40,60,${0.18 * scene.dusk})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    ctx.setTransform(this.dpr * zoom, 0, 0, this.dpr * zoom, this.dpr * (this.w / 2 - this.cam.x * zoom), this.dpr * (this.h / 2 - this.cam.y * zoom));
    if (scene.night) this.drawGlows(ctx, scene);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (scene.rain && !scene.reducedMotion) this.drawRain(ctx, now);

    this.drawTags(ctx, sim, scene);
    this.drawFloaters(ctx, sim, now);
    this.drawRipple(ctx, now);
    this.drawMarkerArrow(ctx, scene, now);
  }

  private spriteItem(key: string, box: Box, bounds: { x0: number; x1: number; y0: number; y1: number }, scale: number, draw: (g: CanvasRenderingContext2D) => void): Drawable {
    return {
      box, ...bounds,
      draw: (ctx) => {
        const s = this.sprite(key, bounds, scale, draw);
        ctx.drawImage(s.canvas, s.x0, s.y0, s.w, s.h);
      },
    };
  }

  private drawGroundOverlays(ctx: CanvasRenderingContext2D, scene: SceneState, sim: Sim, now: number) {
    // puddles
    if (scene.rain) {
      ctx.fillStyle = "rgba(150,180,200,0.35)";
      for (const [x, y, rx] of [[5.5, 9.6, 16], [21.2, 6.4, 12], [9.5, 4.6, 9], [26.4, 11.5, 11], [17.5, 8.7, 14]] as const) {
        const p = toScreen(x, y);
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy, rx, rx * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // pothole
    const ph = toScreen(POTHOLE.x + 0.5, POTHOLE.y + 0.5);
    const status = scene.civic.status;
    if (status === "resolved") {
      ctx.fillStyle = "#26282c";
      ctx.beginPath();
      ctx.moveTo(ph.sx - 22, ph.sy); ctx.lineTo(ph.sx, ph.sy - 11); ctx.lineTo(ph.sx + 22, ph.sy); ctx.lineTo(ph.sx, ph.sy + 11);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#24211f";
      ctx.beginPath(); ctx.ellipse(ph.sx, ph.sy, 17, 8, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = scene.rain ? "#6b5a45" : "#4a3b2e";
      ctx.beginPath(); ctx.ellipse(ph.sx + 1, ph.sy + 1, 13, 5.5, 0.1, 0, Math.PI * 2); ctx.fill();
      if (scene.rain && !scene.reducedMotion) {
        const r = (now / 600) % 1;
        ctx.strokeStyle = `rgba(220,230,240,${0.6 - r * 0.6})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(ph.sx, ph.sy + 1, 4 + r * 9, (4 + r * 9) * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,20,20,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ph.sx - 17, ph.sy); ctx.lineTo(ph.sx - 26, ph.sy - 4);
      ctx.moveTo(ph.sx + 15, ph.sy + 3); ctx.lineTo(ph.sx + 24, ph.sy + 8);
      ctx.stroke();
      if (status !== "open") {
        // a hand-painted ring residents use to mark reported potholes
        ctx.strokeStyle = "rgba(242,210,60,0.9)";
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(ph.sx, ph.sy, 24, 11, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // player path dots
    const pp = sim.player.path;
    if (pp.length) {
      ctx.fillStyle = "rgba(31,79,209,0.55)";
      for (let i = 0; i < pp.length; i++) {
        const p = toScreen(pp[i].x, pp[i].y);
        ctx.beginPath(); ctx.ellipse(p.sx, p.sy, i === pp.length - 1 ? 7 : 2.5, i === pp.length - 1 ? 3.5 : 1.3, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
    // job marker
    if (scene.marker) {
      const m = toScreen(scene.marker.x + 0.5, scene.marker.y + 0.5);
      const pulse = scene.reducedMotion ? 0.5 : (now / 900) % 1;
      ctx.strokeStyle = `rgba(31,79,209,${1 - pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(m.sx, m.sy, 12 + pulse * 18, (12 + pulse * 18) / 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(31,79,209,0.25)";
      ctx.beginPath(); ctx.ellipse(m.sx, m.sy, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawCivicCrew(ctx: CanvasRenderingContext2D, civic: CivicIssue, now: number) {
    if (civic.status !== "in_progress" && civic.status !== "assigned") return;
    const cones = civic.status === "in_progress" ? [[-0.5, -0.3], [0.6, -0.4], [0.7, 0.5], [-0.4, 0.6]] : [[0.7, 0.5]];
    for (const [dx, dy] of cones) {
      const c = toScreen(POTHOLE.x + 0.5 + dx, POTHOLE.y + 0.5 + dy);
      ctx.fillStyle = "#e86a1c";
      ctx.beginPath(); ctx.moveTo(c.sx, c.sy - 14); ctx.lineTo(c.sx - 5, c.sy); ctx.lineTo(c.sx + 5, c.sy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f4f4ef";
      ctx.fillRect(c.sx - 3, c.sy - 8, 6, 2.5);
    }
    if (civic.status === "in_progress") {
      const c = toScreen(POTHOLE.x + 0.9, POTHOLE.y + 0.1);
      drawPerson(ctx, c.sx, c.sy, { skin: "#5c3a24", shirt: "#f2a01c", hair: "cap", pants: "#2b2f38" }, now / 150, true, true, 1);
    }
  }

  private drawGlows(ctx: CanvasRenderingContext2D, scene: SceneState) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = (x: number, y: number, r: number, a: number, lift = 0) => {
      const p = toScreen(x, y);
      const g = ctx.createRadialGradient(p.sx, p.sy - lift, 1, p.sx, p.sy - lift, r);
      g.addColorStop(0, `rgba(255,214,140,${a})`);
      g.addColorStop(1, "rgba(255,214,140,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.sx, p.sy - lift, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const p of PROPS) if (p.kind === "lamp") glow(p.x + 0.5, p.y + 0.5, 70, 0.32, 40);
    for (const b of BUILDINGS) glow(b.door.x + 0.5, b.door.y - 0.1, 34, 0.22, 10);
    for (const plot of PLOTS) {
      const k = scene.kiosks[plot.id];
      if (k?.upgrades.includes("solar")) glow(plot.x + 1, plot.y + 1, 70, 0.4, 14);
    }
    ctx.restore();
  }

  private drawRain(ctx: CanvasRenderingContext2D, now: number) {
    ctx.strokeStyle = "rgba(210,225,240,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.rainDrops) {
      const y = ((d.y + (now / 1000) * d.s * 1.4) % 1) * (this.h + 40) - 20;
      const x = ((d.x - (now / 1000) * 0.08 * d.s) % 1 + 1) % 1 * this.w;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 12 * d.s);
    }
    ctx.stroke();
  }

  private drawTags(ctx: CanvasRenderingContext2D, sim: Sim, scene: SceneState) {
    this.tagRects = [];
    const list: { w: Walker; tag: TagInfo }[] = [];
    for (const r of sim.residents) {
      if (!r.resident || scene.hiddenTags.includes(r.resident.id)) continue;
      const d = Math.hypot(r.x - sim.player.x, r.y - sim.player.y);
      if (d > 7 && this.cam.zoom < 1.1) continue;
      if (d < 0.9 && scene.playerTag) continue; // don't stack on top of your own tag
      list.push({ w: r, tag: { name: r.resident.name, level: r.resident.level, socials: r.resident.socials.map((s) => s.platform) } });
    }
    if (scene.playerTag) list.push({ w: sim.player, tag: scene.playerTag });
    list.sort((a, b) => a.w.x + a.w.y - (b.w.x + b.w.y));
    for (const { w, tag } of list) {
      const s = this.worldPxToScreen(toScreen(w.x, w.y));
      const headY = s.sy - 52 * this.cam.zoom;
      const mine = !!tag.mine;
      ctx.font = `700 ${mine ? 12.5 : 11.5}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      const nameW = ctx.measureText(tag.name).width;
      const lvW = 20;
      const iconW = tag.socials.length * 13;
      const width = lvW + 6 + nameW + (iconW ? iconW + 4 : 0) + 12;
      const height = mine ? 22 : 20;
      const x0 = s.sx - width / 2, y0 = headY - height;
      ctx.fillStyle = mine ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.88)";
      rounded(ctx, x0, y0, width, height, height / 2);
      ctx.fill();
      if (mine) {
        ctx.strokeStyle = "#1f4fd1";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = "#1f4fd1";
      rounded(ctx, x0 + 3, y0 + 3, lvW, height - 6, (height - 6) / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 9.5px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(tag.level), x0 + 3 + lvW / 2, y0 + height / 2 + 0.5);
      ctx.fillStyle = "#13202b";
      ctx.font = `700 ${mine ? 12.5 : 11.5}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText(tag.name, x0 + lvW + 8, y0 + height / 2 + 0.5);
      let ix = x0 + lvW + 8 + nameW + 6;
      for (const p of tag.socials) {
        ctx.fillStyle = SOCIAL_COLORS[p] ?? "#555";
        ctx.beginPath(); ctx.arc(ix + 5, y0 + height / 2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "800 6.5px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(SOCIAL_LETTER[p] ?? "?", ix + 5, y0 + height / 2 + 0.5);
        ctx.textAlign = "left";
        ix += 13;
      }
      // pointer
      ctx.fillStyle = mine ? "#1f4fd1" : "rgba(255,255,255,0.88)";
      ctx.beginPath(); ctx.moveTo(s.sx - 4, y0 + height); ctx.lineTo(s.sx + 4, y0 + height); ctx.lineTo(s.sx, y0 + height + 4); ctx.closePath(); ctx.fill();
      if (tag.status && mine && this.cam.zoom >= 0.7) {
        ctx.font = "500 10.5px system-ui, sans-serif";
        const sw = Math.min(ctx.measureText(tag.status).width, 180) + 12;
        ctx.fillStyle = "rgba(19,32,43,0.78)";
        rounded(ctx, s.sx - sw / 2, y0 - 18, sw, 15, 7.5);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(truncate(ctx, tag.status, 180), s.sx, y0 - 10);
      }
      ctx.textAlign = "left";
      this.tagRects.push({ id: w.id, x0, y0, x1: x0 + width, y1: y0 + height });
    }
  }

  private drawFloaters(ctx: CanvasRenderingContext2D, sim: Sim, now: number) {
    for (const f of sim.floaters) {
      const t = (now - f.t0) / 1600;
      const s = this.worldPxToScreen(toScreen(f.x, f.y));
      ctx.globalAlpha = 1 - t;
      ctx.font = "800 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#fff";
      ctx.strokeText(f.text, s.sx, s.sy - 70 * this.cam.zoom - t * 34);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, s.sx, s.sy - 70 * this.cam.zoom - t * 34);
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
    }
  }

  private drawRipple(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.ripple) return;
    const t = (now - this.ripple.t0) / 450;
    if (t > 1) {
      this.ripple = null;
      return;
    }
    ctx.strokeStyle = `rgba(255,255,255,${1 - t})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(this.ripple.x, this.ripple.y, 6 + t * 18, (6 + t * 18) / 2, 0, 0, Math.PI * 2); ctx.stroke();
  }

  /** When the job target is off screen, an arrow at the edge points to it. */
  private drawMarkerArrow(ctx: CanvasRenderingContext2D, scene: SceneState, now: number) {
    if (!scene.marker) return;
    const m = this.worldPxToScreen(toScreen(scene.marker.x + 0.5, scene.marker.y + 0.5));
    const margin = 44;
    const top = 90, bottom = this.h - 120;
    const onScreen = m.sx > margin && m.sx < this.w - margin && m.sy > top && m.sy < bottom;
    const bob = scene.reducedMotion ? 0 : Math.sin(now / 250) * 4;
    if (onScreen) {
      ctx.fillStyle = "#1f4fd1";
      const y = m.sy - 70 * this.cam.zoom + bob;
      ctx.beginPath(); ctx.moveTo(m.sx, y + 10); ctx.lineTo(m.sx - 8, y); ctx.lineTo(m.sx + 8, y); ctx.closePath(); ctx.fill();
      label(ctx, scene.markerLabel, m.sx, y - 6);
      return;
    }
    const cx = this.w / 2, cy = (top + bottom) / 2;
    const ang = Math.atan2(m.sy - cy, m.sx - cx);
    const ex = Math.max(margin, Math.min(this.w - margin, cx + Math.cos(ang) * this.w));
    const ey = Math.max(top, Math.min(bottom, cy + Math.sin(ang) * this.h));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = "#1f4fd1";
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-6, -11); ctx.lineTo(-6, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    label(ctx, scene.markerLabel, ex, ey - 18);
  }

  pick(px: number, py: number, sim: Sim): Pick {
    for (let i = this.tagRects.length - 1; i >= 0; i--) {
      const r = this.tagRects[i];
      if (px >= r.x0 - 4 && px <= r.x1 + 4 && py >= r.y0 - 4 && py <= r.y1 + 6) return r.id === "player" ? { type: "player" } : { type: "resident", id: r.id };
    }
    const wp = this.screenToWorldPx(px, py);
    const people = [...sim.residents, sim.player].sort((a, b) => b.x + b.y - (a.x + a.y));
    for (const w of people) {
      const s = toScreen(w.x, w.y);
      if (Math.abs(wp.sx - s.sx) < 13 && wp.sy < s.sy + 5 && wp.sy > s.sy - 48) return w === sim.player ? { type: "player" } : { type: "resident", id: w.id };
    }
    const t = toWorld(wp.sx, wp.sy);
    const tx = Math.floor(t.x), ty = Math.floor(t.y);
    for (const plot of PLOTS) {
      const sil = boxSilhouette(kioskBox(plot.x, plot.y), 14);
      if (pointInPoly(wp.sx, wp.sy, sil) || (tx >= plot.x && tx <= plot.x + 1 && ty >= plot.y && ty <= plot.y + 1)) return { type: "plot", plotId: plot.id };
    }
    if (Math.abs(t.x - (POTHOLE.x + 0.5)) < 0.8 && Math.abs(t.y - (POTHOLE.y + 0.5)) < 0.8) return { type: "pothole" };
    // front-most building first
    const sorted = [...BUILDINGS].sort((a, b) => b.x + b.w + b.y + b.d - (a.x + a.w + a.y + a.d));
    for (const b of sorted) {
      if (pointInPoly(wp.sx, wp.sy, boxSilhouette(buildingBox(b), BUILDING_EXTRA_TOP[b.id] ?? 0))) return { type: "building", building: b };
    }
    return { type: "ground", x: tx, y: ty };
  }
}

const SOCIAL_COLORS: Record<string, string> = { tiktok: "#111111", instagram: "#c13584", x: "#000000", youtube: "#e62117", facebook: "#1877f2" };
const SOCIAL_LETTER: Record<string, string> = { tiktok: "Tk", instagram: "Ig", x: "X", youtube: "Yt", facebook: "f" };

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, s: string, max: number) {
  if (ctx.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  if (!text) return;
  ctx.font = "700 11.5px system-ui, sans-serif";
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = "#1f4fd1";
  rounded(ctx, x - w / 2, y - 20, w, 20, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 9.5);
  ctx.textAlign = "left";
}

/**
 * Isometric painter's order. An item is drawn after everything that sits
 * behind it (smaller x or y with overlapping screen area).
 */
function depthSort(items: Drawable[]): Drawable[] {
  const n = items.length;
  const behind: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = items[i];
    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      if (a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0) continue;
      const aBehindB = a.box.x + a.box.w <= b.box.x + 0.001 || a.box.y + a.box.d <= b.box.y + 0.001;
      const bBehindA = b.box.x + b.box.w <= a.box.x + 0.001 || b.box.y + b.box.d <= a.box.y + 0.001;
      if (aBehindB && !bBehindA) behind[j].push(i);
      else if (bBehindA && !aBehindB) behind[i].push(j);
      else if (a.box.x + a.box.y + (a.box.w + a.box.d) / 2 < b.box.x + b.box.y + (b.box.w + b.box.d) / 2) behind[j].push(i);
      else behind[i].push(j);
    }
  }
  const out: Drawable[] = [];
  const state = new Uint8Array(n);
  const visit = (i: number) => {
    if (state[i] === 2) return;
    if (state[i] === 1) return; // cycle: draw as is
    state[i] = 1;
    for (const j of behind[i]) visit(j);
    state[i] = 2;
    out.push(items[i]);
  };
  const order = [...items.keys()].sort((a, b) => items[a].box.x + items[a].box.y - (items[b].box.x + items[b].box.y));
  for (const i of order) visit(i);
  return out;
}
