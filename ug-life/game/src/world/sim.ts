import { AREA, MAP_H, MAP_W, isWalkable } from "./map";
import { findPath, nearestWalkable, type Pt } from "./path";
import type { Look } from "../game/state";
import { RESIDENTS, type Resident } from "../content/residents";
import type { Visitor } from "../net/api";
import { PASSER_LINES, RESIDENT_LINES, phraseById } from "../content/talk";

export interface Walker {
  id: string;
  x: number;
  y: number;
  path: Pt[];
  speed: number;
  phase: number;
  flip: boolean;
  moving: boolean;
  idleUntil: number;
  look: Look;
  carrying: boolean;
  resident?: Resident;
  /** A real player, shown where they last were. */
  visitor?: Visitor;
  home?: Pt;
  onArrive?: () => void;
  /** On a boda: ridden by riderLook (when a passenger) and/or carrying pillion. */
  vehicle?: "boda";
  riderLook?: Look;
  pillion?: Look;
  /** Off the street for now (e.g. riding pillion on your boda). */
  hidden?: boolean;
  /** Waiting for a boda: stays put and waves. */
  waving?: boolean;
  /** Speech bubble over their head. */
  say?: Speech;
  /** Short animation: wave, dance, laugh... */
  emote?: { id: string; icon: string; until: number };
}

export interface Speech {
  text: string;
  until: number;
  t0: number;
  /** Voice hello: tap the bubble to hear it. */
  voiceId?: string;
  /** A talk message id, so the bubble can be reported. */
  talkId?: string;
}

export interface Vehicle {
  kind: "matatu" | "car" | "boda";
  x: number;
  lane: 0 | 1;
  speed: number;
  maxSpeed: number;
  color: string;
  passenger: boolean;
  waitUntil: number;
  braking: boolean;
  stoppedAtStage: boolean;
}

export interface Floater {
  text: string;
  x: number;
  y: number;
  t0: number;
  color: string;
}

export const LANE_Y = [7.0, 9.0] as const;
export const LANE_DIR = [-1, 1] as const;

const VEHICLE_LEN: Record<Vehicle["kind"], number> = { matatu: 2.2, car: 1.6, boda: 0.9 };

/** Tiles where residents like to hang out, in the current area. */
function hangouts(): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (isWalkable(x, y) && (y === 4 || y === 11 || y >= 12)) out.push({ x, y });
  return out;
}

function residentsHere(): Walker[] {
  return RESIDENTS.filter((r) => (r.area ?? "wandegeya") === AREA.id).map((r) => {
    const start = isWalkable(r.start.x, r.start.y) ? r.start : nearestWalkable(r.start) ?? { x: 3, y: 11 };
    const w = makeWalker(r.id, start.x + 0.5, start.y + 0.5, r.look, 1.3 + Math.random() * 0.5);
    w.resident = r;
    w.idleUntil = performance.now() + Math.random() * 4000;
    return w;
  });
}

export class Sim {
  player: Walker;
  residents: Walker[];
  vehicles: Vehicle[];
  visitors: Walker[] = [];
  floaters: Floater[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private rand = Math.random;
  private nextChatter = performance.now() + 6000;
  private hangouts = hangouts();
  /** Called when a resident says something on their own (for the talk log and voices). */
  onChatter?: (w: Walker, text: string) => void;
  /** How many residents and passers-by walk around (fewer on slow phones). */
  crowd = Infinity;

  constructor(playerLook: Look, start: { x: number; y: number }) {
    this.player = makeWalker("player", start.x, start.y, playerLook, 3.2);
    this.residents = residentsHere();
    this.vehicles = [
      vehicle("matatu", 2, 1, "#f4f4ef"),
      vehicle("boda", 7, 1, ""),
      vehicle("boda", 12, 1, ""),
      vehicle("car", 17, 1, "#c8332b"),
      vehicle("boda", 22, 1, ""),
      vehicle("matatu", 27, 1, "#f4f4ef"),
      vehicle("boda", 33, 1, ""),
      vehicle("boda", 38, 1, ""),
      vehicle("matatu", 40, 0, "#f4f4ef"),
      vehicle("boda", 35, 0, ""),
      vehicle("car", 30, 0, "#2c5f8a"),
      vehicle("boda", 25, 0, ""),
      vehicle("boda", 19, 0, ""),
      vehicle("car", 13, 0, "#e8e8e2"),
      vehicle("boda", 8, 0, ""),
      vehicle("boda", 1, 0, ""),
    ];
  }

  /** After travelling: the people of the new area, and you at the arrival spot. */
  enterArea(at: Pt) {
    this.residents = residentsHere();
    this.hangouts = hangouts();
    this.visitors = [];
    this.timers = [];
    const p = this.player;
    p.x = at.x + 0.5;
    p.y = at.y + 0.5;
    p.path = [];
    p.onArrive = undefined;
    p.pillion = undefined;
    p.emote = undefined;
    p.say = undefined;
  }

  schedule(delayMs: number, fn: () => void) {
    this.timers.push({ at: performance.now() + delayMs, fn });
  }

  walkPlayerTo(tile: Pt, onArrive?: () => void): boolean {
    const p = this.player;
    const path = findPath({ x: Math.floor(p.x), y: Math.floor(p.y) }, tile);
    if (!path) return false;
    p.path = path.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }));
    p.onArrive = onArrive;
    if (!p.path.length) {
      p.onArrive = undefined;
      onArrive?.();
    }
    return true;
  }

  resident(id: string): Walker | undefined {
    return this.residents.find((r) => r.id === id);
  }

  /** A named resident walks to a tile and waits there, waving for a boda. */
  callResidentTo(id: string, tile: Pt) {
    const w = this.resident(id);
    if (!w) return;
    w.hidden = false;
    const target = isWalkable(tile.x, tile.y) ? tile : nearestWalkable(tile);
    if (!target) return;
    const near = nearestWalkable({ x: target.x + 1, y: target.y }) ?? target;
    w.x = near.x + 0.5;
    w.y = near.y + 0.5;
    w.path = [];
    w.waving = true;
    w.onArrive = () => {};
    w.idleUntil = Infinity;
  }

  /** The resident hops on (disappears from the street) or gets off at a tile. */
  setPillion(id: string, on: boolean, at?: Pt) {
    const w = this.resident(id);
    if (!w) return;
    w.waving = false;
    w.hidden = on;
    this.player.pillion = on ? w.look : undefined;
    if (!on) {
      if (at) {
        w.x = at.x + 0.5;
        w.y = at.y + 0.5;
      }
      w.onArrive = undefined;
      w.idleUntil = performance.now() + 4000;
    }
  }

  /** Release any resident left waiting (ride cancelled). */
  releaseWaiting() {
    for (const r of this.residents) if (r.waving) {
      r.waving = false;
      r.onArrive = undefined;
      r.idleUntil = performance.now() + 1000;
    }
  }

  /** Puts the player on a boda (as rider or passenger) or back on foot. */
  setPlayerBoda(mode: "rider" | "passenger" | null, speeds: { boda: number; walk: number }, riderLook?: Look) {
    const p = this.player;
    p.vehicle = mode ? "boda" : undefined;
    p.riderLook = mode === "passenger" ? riderLook : undefined;
    if (!mode) p.pillion = undefined;
    p.speed = mode ? speeds.boda : speeds.walk;
  }

  /** Send a resident who is standing around to a tile, then call back. */
  sendResident(tile: Pt, onArrive: () => void): boolean {
    const idle = this.residents.filter((r) => !r.path.length && !r.hidden && !r.waving && r.resident?.id !== "r-ssali");
    if (!idle.length) return false;
    const w = idle[Math.floor(this.rand() * idle.length)];
    const path = findPath({ x: Math.floor(w.x), y: Math.floor(w.y) }, tile);
    if (!path) return false;
    w.path = path.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }));
    w.onArrive = onArrive;
    return true;
  }

  /** Shows real players from the server; they stroll near the spot they last saved. */
  setVisitors(list: Visitor[], hidden: string[]) {
    const keep: Walker[] = [];
    for (const v of list) {
      if (hidden.includes(v.id)) continue;
      const home = { x: Math.floor(v.pos.x), y: Math.floor(v.pos.y) };
      if (!isWalkable(home.x, home.y)) continue;
      const existing = this.visitors.find((w) => w.id === v.id);
      if (existing) {
        existing.visitor = v;
        existing.look = v.look;
        // they moved: walk over to where they are now
        if (existing.home && Math.hypot(existing.home.x - home.x, existing.home.y - home.y) > 1.5) {
          const path = findPath({ x: Math.floor(existing.x), y: Math.floor(existing.y) }, home);
          if (path && path.length < 40) existing.path = path.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }));
          else {
            existing.x = home.x + 0.5;
            existing.y = home.y + 0.5;
            existing.path = [];
          }
          existing.speed = 2.6;
        }
        existing.home = home;
        keep.push(existing);
      } else {
        const w = makeWalker(v.id, home.x + 0.5, home.y + 0.5, v.look, 1.4);
        w.visitor = v;
        w.home = home;
        keep.push(w);
      }
    }
    this.visitors = keep;
  }

  /** Anyone on the street by id: you ("player"), a resident or a real player. */
  walker(id: string): Walker | undefined {
    if (id === "player") return this.player;
    return this.residents.find((r) => r.id === id) ?? this.visitors.find((v) => v.id === id);
  }

  say(w: Walker, text: string, ms = 4500, extra: Partial<Speech> = {}) {
    const now = performance.now();
    w.say = { text, t0: now, until: now + ms, ...extra };
  }

  emote(w: Walker, id: string, icon: string, ms = 3200) {
    w.emote = { id, icon, until: performance.now() + ms };
  }

  /** The nearest resident within reach answers a phrase. Returns who answered. */
  replyTo(phraseId: string, from: { x: number; y: number }, onReply?: (w: Walker, text: string) => void): Walker | null {
    const p = phraseById(phraseId);
    const lines = p?.replies;
    if (!lines?.length) return null;
    const near = this.residents
      .filter((r) => !r.hidden && r.resident && Math.hypot(r.x - from.x, r.y - from.y) < 6 && !(r.say && r.say.until > performance.now()))
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
    if (!near) return null;
    const text = lines[Math.floor(this.rand() * lines.length)];
    this.schedule(900 + this.rand() * 900, () => {
      near.path = [];
      near.flip = this.player.x - this.player.y < near.x - near.y;
      this.say(near, text);
      if (phraseId === "otya" || phraseId === "welcome") this.emote(near, "wave", "👋", 2200);
      onReply?.(near, text);
    });
    return near;
  }

  /** A specific resident answers you (tapped "Say hi" on their card). */
  greetResident(id: string, onReply?: (w: Walker, text: string) => void) {
    const w = this.resident(id);
    if (!w || w.hidden) return;
    const own = RESIDENT_LINES[id] ?? PASSER_LINES;
    const text = ["Oli otya! ", "Gyebale ko! ", "Eh, hello! "][Math.floor(this.rand() * 3)] + own[Math.floor(this.rand() * own.length)];
    this.schedule(700, () => {
      w.path = [];
      this.say(w, text, 5000);
      this.emote(w, "wave", "👋", 2200);
      onReply?.(w, text);
    });
  }

  private chatter(now: number) {
    if (now < this.nextChatter) return;
    this.nextChatter = now + 7000 + this.rand() * 9000;
    const p = this.player;
    const near = this.residents.filter((r) => !r.hidden && !r.waving && !(r.say && r.say.until > now) && Math.hypot(r.x - p.x, r.y - p.y) < 9);
    if (!near.length) return;
    const w = near[Math.floor(this.rand() * near.length)];
    const own = RESIDENT_LINES[w.id] ?? PASSER_LINES;
    const text = own[Math.floor(this.rand() * own.length)];
    this.say(w, text, 4000);
    this.onChatter?.(w, text);
  }

  float(text: string, x: number, y: number, color = "#2f7a4b") {
    this.floaters.push({ text, x, y, t0: performance.now(), color });
  }

  update(dt: number, now: number) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (now >= this.timers[i].at) {
        const t = this.timers.splice(i, 1)[0];
        t.fn();
      }
    }
    stepWalker(this.player, dt);
    this.chatter(now);
    for (let i = 0; i < this.residents.length; i++) {
      const r = this.residents[i];
      // on slow phones only part of the crowd walks about; the rest stand still
      if (r.hidden || r.waving || i >= this.crowd) continue;
      if (!r.path.length && now > r.idleUntil && !r.onArrive) {
        const target = this.hangouts[Math.floor(this.rand() * this.hangouts.length)];
        const path = findPath({ x: Math.floor(r.x), y: Math.floor(r.y) }, target);
        if (path && path.length < 18) r.path = path.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }));
        r.idleUntil = now + 3000 + this.rand() * 7000;
      }
      stepWalker(r, dt);
    }
    for (const v of this.visitors) {
      if (!v.path.length && now > v.idleUntil && v.home) {
        const tx = v.home.x + Math.round((this.rand() - 0.5) * 6), ty = v.home.y + Math.round((this.rand() - 0.5) * 4);
        if (isWalkable(tx, ty)) {
          const path = findPath({ x: Math.floor(v.x), y: Math.floor(v.y) }, { x: tx, y: ty });
          if (path && path.length < 10) v.path = path.map((q) => ({ x: q.x + 0.5, y: q.y + 0.5 }));
        }
        v.idleUntil = now + 4000 + this.rand() * 8000;
      }
      stepWalker(v, dt);
    }
    this.updateTraffic(dt, now);
    this.floaters = this.floaters.filter((f) => now - f.t0 < 1600);
  }

  private updateTraffic(dt: number, now: number) {
    const p = this.player;
    for (const v of this.vehicles) {
      const dir = LANE_DIR[v.lane];
      const half = VEHICLE_LEN[v.kind] / 2;
      let target = v.maxSpeed;
      // keep distance from the vehicle ahead
      for (const o of this.vehicles) {
        if (o === v || o.lane !== v.lane) continue;
        const gap = (o.x - v.x) * dir - half - VEHICLE_LEN[o.kind] / 2;
        if (gap > -0.2 && gap < 1.2) target = Math.min(target, Math.max(0, o.speed * 0.8 - (1.2 - gap)));
      }
      // stop for the player crossing
      if (Math.abs(p.y - LANE_Y[v.lane]) < 0.9) {
        const ahead = (p.x - v.x) * dir - half;
        if (ahead > -0.3 && ahead < 2.2) target = 0;
      }
      // eastbound matatus stop at the taxi stage
      if (v.kind === "matatu" && v.lane === 1 && !v.stoppedAtStage && v.x > 3 && v.x < 3.4) {
        v.waitUntil = now + 3500;
        v.stoppedAtStage = true;
      }
      if (now < v.waitUntil) target = 0;
      v.braking = target < v.speed - 0.1;
      v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), dt * (v.braking ? 5 : 1.6));
      v.x += dir * v.speed * dt;
      if (dir > 0 && v.x > MAP_W + 4) wrap(v, -4);
      if (dir < 0 && v.x < -4) wrap(v, MAP_W + 4);
    }
  }
}

function wrap(v: Vehicle, x: number) {
  v.x = x;
  v.stoppedAtStage = false;
  if (v.kind === "boda") v.passenger = Math.random() < 0.5;
}

function makeWalker(id: string, x: number, y: number, look: Look, speed: number): Walker {
  return { id, x, y, path: [], speed, phase: 0, flip: false, moving: false, idleUntil: 0, look, carrying: false };
}

function vehicle(kind: Vehicle["kind"], x: number, lane: 0 | 1, color: string): Vehicle {
  const maxSpeed = kind === "boda" ? 3.4 : kind === "car" ? 2.6 : 2.1;
  return { kind, x, lane, speed: maxSpeed, maxSpeed, color, passenger: Math.random() < 0.5, waitUntil: 0, braking: false, stoppedAtStage: false };
}

function stepWalker(w: Walker, dt: number) {
  if (!w.path.length) {
    w.moving = false;
    return;
  }
  const next = w.path[0];
  const dx = next.x - w.x, dy = next.y - w.y;
  const dist = Math.hypot(dx, dy);
  const step = w.speed * dt;
  w.moving = true;
  w.phase += dt * w.speed * 5;
  const sdx = dx - dy; // screen-space x direction
  if (Math.abs(sdx) > 0.01) w.flip = sdx < 0;
  if (dist <= step) {
    w.x = next.x;
    w.y = next.y;
    w.path.shift();
    if (!w.path.length) {
      w.moving = false;
      const cb = w.onArrive;
      w.onArrive = undefined;
      cb?.();
    }
  } else {
    w.x += (dx / dist) * step;
    w.y += (dy / dist) * step;
  }
}
