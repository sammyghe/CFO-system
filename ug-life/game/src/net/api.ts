// Talks to /api. Every call can fail (no signal, server over its free limit,
// preview builds with no server) and the game carries on offline when it does.

import type { PlayerState } from "../game/state";

const TOKEN_KEY = "uglife.token";
const VERSION_KEY = "uglife.serverVersion";
const PLAYER_KEY = "uglife.playerId";

export interface ServerConfig {
  maintenance: boolean;
  uploads: boolean;
  signups: boolean;
  announcement: string;
}

export interface Visitor {
  id: string;
  name: string;
  level: number;
  tag: { name: string; status: string; socials: { platform: string; handle: string }[] };
  look: PlayerState["look"];
  pos: { x: number; y: number };
  kiosk: { name: string; color: string } | null;
}

export interface SharedPlot {
  plotId: string;
  playerId: string;
  owner: string;
  kiosk: { name: string; color: string; product: string; upgrades: string[]; yard: (string | null)[] } | null;
  leasedUntil: number;
}

export interface TalkMsg {
  id: string;
  playerId: string;
  name: string;
  kind: "phrase" | "text" | "emote" | "voice";
  body: string;
  to: string | null;
  x: number;
  y: number;
  at: number;
}

export interface LiveVisitor extends Visitor {
  seen: number;
}

export interface Board {
  rich: { id: string; name: string; level: number; balance: number }[];
  levels: { id: string; name: string; level: number; balance: number }[];
  snappers: { name: string; n: number }[];
  talkers: { name: string; n: number }[];
  landlords: { id: string; name: string; plots: number; levels: number }[];
}

export interface LandMarket {
  day: string;
  hot: string;
  areas: { id: string; sold: number; price: number; owners: { slot: number; playerId: string; name: string; level: number }[] }[];
}

export interface CommunityPhoto {
  id: string;
  author: string;
  area: string;
  place: string;
  width: number;
  height: number;
  featured: number;
  created_at: number;
}

type Resp<T> = { ok: true; status: number; data: T } | { ok: false; status: number; data: { error?: string } & Partial<T> };

function store(key: string, value?: string | null): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
  return null;
}

export class Api {
  readonly available: boolean;
  config: ServerConfig | null = null;
  reachable = false;
  private token: string | null = store(TOKEN_KEY);
  /** This phone's player id on the server. */
  playerId: string | null = store(PLAYER_KEY);

  constructor() {
    // Preview links (claude.ai) and file:// have no server behind them.
    this.available = location.protocol.startsWith("http") && !/claude|anthropic/.test(location.hostname);
  }

  get signedIn() {
    return !!this.token;
  }

  get serverVersion(): number {
    return Number(store(VERSION_KEY) ?? 0) || 0;
  }

  set serverVersion(v: number) {
    store(VERSION_KEY, String(v));
  }

  recoveryCode(): string | null {
    return this.token;
  }

  private async call<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean; form?: FormData; timeout?: number; token?: string } = {}): Promise<Resp<T> | null> {
    if (!this.available) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout ?? 9000);
    try {
      const headers: Record<string, string> = {};
      const tok = opts.token ?? this.token;
      if ((opts.auth || opts.token) && tok) headers.authorization = `Bearer ${tok}`;
      if (body !== undefined) headers["content-type"] = "application/json";
      const res = await fetch(`/api/${path}`, { method, headers, body: opts.form ?? (body !== undefined ? JSON.stringify(body) : undefined), signal: ctrl.signal, keepalive: method === "PUT" && !opts.form });
      this.reachable = true;
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data } as Resp<T>;
    } catch {
      this.reachable = false;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async loadConfig(): Promise<ServerConfig | null> {
    const r = await this.call<ServerConfig>("GET", "config");
    if (r?.ok) this.config = r.data;
    return this.config;
  }

  async ensureSession(): Promise<boolean> {
    if (this.token) return true;
    let ref: string | null = null;
    try {
      ref = localStorage.getItem("uglife.ref");
    } catch {
      /* storage blocked */
    }
    const r = await this.call<{ playerId: string; token: string }>("POST", "session", ref ? { ref } : {});
    if (!r?.ok) return false;
    this.token = r.data.token;
    this.playerId = r.data.playerId;
    store(TOKEN_KEY, this.token);
    store(PLAYER_KEY, this.playerId);
    this.serverVersion = 0;
    return true;
  }

  /** Sends the save. Returns a replacement save when the server has a newer or the only valid one. */
  async sync(save: PlayerState): Promise<{ kind: "ok" } | { kind: "replace"; save: PlayerState; message: string } | { kind: "error"; message: string } | null> {
    if (!this.token) return null;
    const r = await this.call<{ version: number; save: PlayerState | null; error?: string }>("PUT", "save", { save, baseVersion: this.serverVersion }, { auth: true, timeout: 12000 });
    if (!r) return null;
    if (r.ok) {
      this.serverVersion = r.data.version;
      return { kind: "ok" };
    }
    if ((r.status === 409 || r.status === 422) && typeof r.data.version === "number") {
      this.serverVersion = r.data.version;
      if (r.data.save) return { kind: "replace", save: r.data.save, message: r.data.error ?? "Loaded your saved progress." };
      return { kind: "error", message: r.data.error ?? "Save refused." };
    }
    if (r.status === 401) {
      this.token = null;
      store(TOKEN_KEY, null);
    }
    return { kind: "error", message: r.data.error ?? "Couldn't save online." };
  }

  async restore(code: string): Promise<{ save: PlayerState | null; version: number } | { error: string }> {
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const r = await this.call<{ playerId: string; version: number; save: PlayerState | null }>("POST", "session/restore", {}, { token: clean });
    if (!r) return { error: "No connection. Try again when you have signal." };
    if (!r.ok) return { error: r.data.error ?? "That code didn't work." };
    this.token = clean;
    this.playerId = r.data.playerId;
    store(TOKEN_KEY, clean);
    store(PLAYER_KEY, this.playerId);
    this.serverVersion = r.data.version;
    return { save: r.data.save, version: r.data.version };
  }

  async plots(): Promise<SharedPlot[] | null> {
    const r = await this.call<{ plots: SharedPlot[] }>("GET", "plots");
    return r?.ok ? r.data.plots : null;
  }

  /** Asks the server for a kiosk plot. Only one player can hold a plot at a time. */
  async claimPlot(plotId: string): Promise<{ ok: true; day: string; renewed: boolean } | { ok: false; message: string }> {
    const r = await this.call<{ day: string; renewed: boolean }>("POST", `plots/${plotId}/claim`, {}, { auth: true });
    if (!r) return { ok: false, message: "Leasing needs a connection, so two players can't take the same plot. Try again when you have signal." };
    if (!r.ok) return { ok: false, message: r.data.error ?? "Couldn't lease that plot." };
    return { ok: true, day: r.data.day, renewed: r.data.renewed };
  }

  async rewards(): Promise<{ referrals: { id: string; name: string }[]; referred: boolean } | null> {
    const r = await this.call<{ referrals: { id: string; name: string }[]; referred: boolean }>("GET", "rewards", undefined, { auth: true });
    return r?.ok ? r.data : null;
  }

  /** Link that credits this player when a friend joins and works. */
  inviteUrl(base: string): string {
    return this.playerId ? `${base}${base.includes("?") ? "&" : "?"}ref=${this.playerId}` : base;
  }

  async street(): Promise<Visitor[]> {
    const r = await this.call<{ players: Visitor[] }>("GET", "street");
    return r?.ok ? r.data.players : [];
  }

  /** Marks you as on the street and fetches who's here and what they said since `since`. */
  async live(pos: { x: number; y: number } | null, since: number): Promise<{ now: number; players: LiveVisitor[]; talk: TalkMsg[] } | null> {
    const r = await this.call<{ now: number; players: LiveVisitor[]; talk: TalkMsg[] }>("POST", "live", { ...(pos ?? {}), since }, { auth: true, timeout: 7000 });
    return r?.ok ? r.data : null;
  }

  async talk(kind: "phrase" | "text" | "emote", body: string, pos: { x: number; y: number }, to?: string): Promise<{ id: string; at: number; body: string } | { error: string }> {
    const r = await this.call<{ id: string; at: number; body: string }>("POST", "talk", { kind, body, to, x: pos.x, y: pos.y }, { auth: true });
    if (!r) return { error: "No connection. Street talk needs signal." };
    return r.ok ? r.data : { error: r.data.error ?? "Couldn't send that." };
  }

  async voice(blob: Blob, ms: number, pos: { x: number; y: number }): Promise<{ id: string; at: number; body: string } | { error: string }> {
    const form = new FormData();
    form.set("audio", blob, "hello");
    form.set("ms", String(Math.round(ms)));
    form.set("x", String(pos.x));
    form.set("y", String(pos.y));
    const r = await this.call<{ id: string; at: number; body: string }>("POST", "talk/voice", undefined, { auth: true, form, timeout: 20000 });
    if (!r) return { error: "No connection. Try again when you have signal." };
    return r.ok ? r.data : { error: r.data.error ?? "Couldn't send your voice hello." };
  }

  voiceUrl(voiceId: string) {
    return `/api/voice/${voiceId}`;
  }

  async reportTalk(talkId: string): Promise<boolean> {
    const r = await this.call("POST", `talk/${talkId}/report`, {}, { auth: true });
    return !!r?.ok;
  }

  /** fresh = skip the short cache (right after buying). */
  async land(fresh = false): Promise<LandMarket | null> {
    const r = await this.call<LandMarket>("GET", fresh ? `land?t=${Date.now()}` : "land");
    return r?.ok ? r.data : null;
  }

  async claimLand(area: string): Promise<{ ok: true; slot: number; price: number } | { ok: false; message: string }> {
    const r = await this.call<{ slot: number; price: number }>("POST", `land/${area}/claim`, {}, { auth: true });
    if (!r) return { ok: false, message: "Buying land needs a connection, so two people can't buy the same plot." };
    if (!r.ok) return { ok: false, message: r.data.error ?? "Couldn't buy that plot." };
    return { ok: true, slot: r.data.slot, price: r.data.price };
  }

  async leaderboard(): Promise<Board | null> {
    const r = await this.call<Board>("GET", "leaderboard");
    return r?.ok ? r.data : null;
  }

  async photos(area?: string): Promise<{ photos: CommunityPhoto[]; areas: { area: string; n: number }[] } | null> {
    const r = await this.call<{ photos: CommunityPhoto[]; areas: { area: string; n: number }[] }>("GET", "photos" + (area ? `?area=${encodeURIComponent(area)}` : ""));
    return r?.ok ? r.data : null;
  }

  async myPhotos(): Promise<{ id: string; status: string; reason: string | null }[]> {
    const r = await this.call<{ photos: { id: string; status: string; reason: string | null }[] }>("GET", "photos/mine", undefined, { auth: true });
    return r?.ok ? r.data.photos : [];
  }

  photoUrl(id: string) {
    return `/api/photo/${id}`;
  }

  async uploadPhoto(blob: Blob, meta: { area: string; place: string; width: number; height: number }): Promise<{ id: string } | { error: string } | null> {
    const form = new FormData();
    form.set("image", blob, blob.type === "image/webp" ? "snap.webp" : "snap.jpg");
    form.set("area", meta.area);
    form.set("place", meta.place);
    form.set("width", String(meta.width));
    form.set("height", String(meta.height));
    form.set("consent", "yes");
    const r = await this.call<{ id: string }>("POST", "photos", undefined, { auth: true, form, timeout: 30000 });
    if (!r) return null;
    return r.ok ? { id: r.data.id } : { error: r.data.error ?? "Upload failed." };
  }

  async ticket(category: string, text: string): Promise<boolean> {
    const r = await this.call("POST", "tickets", { category, text }, { auth: true });
    return !!r?.ok;
  }

  async myTickets(): Promise<{ id: string; body: string; status: string; reply: string | null; created_at: number }[]> {
    const r = await this.call<{ tickets: { id: string; body: string; status: string; reply: string | null; created_at: number }[] }>("GET", "tickets/mine", undefined, { auth: true });
    return r?.ok ? r.data.tickets : [];
  }

  async report(target: string, reason: string): Promise<boolean> {
    const r = await this.call("POST", "reports", { target, reason }, { auth: true });
    return !!r?.ok;
  }

  async track(events: string[]): Promise<boolean> {
    if (!events.length) return true;
    const r = await this.call("POST", "track", { events });
    return !!r?.ok;
  }
}
