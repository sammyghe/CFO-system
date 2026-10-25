import { Renderer, type SceneState } from "./world/render";
import { Sim } from "./world/sim";
import { toScreen } from "./world/iso";
import { PLACES, PLOTS, POTHOLE, isWalkable } from "./world/map";
import { nearestWalkable } from "./world/path";
import type { KioskLook } from "./world/art";
import { LocalBackend, newPlayerId, type Backend } from "./backend/backend";
import { newPlayer, type PlayerState } from "./game/state";
import * as A from "./game/actions";
import { advance } from "./game/civic";
import { balanceOf } from "./game/ledger";
import { eventForTime } from "./game/daily";
import { formatUGX, levelForXp, xpForLevel } from "./game/economy";
import { kampalaDateKey, kampalaHour } from "./game/time";
import { hotArea } from "./content/land";
import { h, ICONS } from "./ui/dom";
import * as S from "./ui/sheets";
import { drainEventNames, track } from "./track";
import { Api, type LiveVisitor } from "./net/api";
import { listSnaps, saveSnap, type SnapRecord } from "./snaps/store";
import { albumSheet } from "./snaps/ui";
import * as St from "./game/street";
import { bodaSheet, landmarkSheet, vendorSheet } from "./ui/streetsheets";
import { BODA, VENDORS } from "./content/catalog";
import { RIDER } from "./world/art";
import type { SharedPlot } from "./net/api";
import { BUILDINGS, placeById } from "./world/map";
import { toWorld } from "./world/iso";
import { tileDistance } from "./world/path";
import { sound } from "./audio/sound";
import { STREET_SHOUTS, emoteById, phraseById } from "./content/talk";
import { checkFreeText } from "./game/moderation";
import { talkSheet, type TalkEntry } from "./ui/talksheet";
import { goSheet, type Destination } from "./ui/gosheet";
import { moreSheet } from "./ui/moresheet";
import * as Land from "./game/land";
import * as Money from "./game/money";
import * as Shifts from "./game/shifts";
import { energyNow, maxEnergy } from "./game/energy";
import { SHIFTS } from "./content/catalog";
import type { BillboardAd } from "./content/billboards";
import type { LiveEvent, Proposal } from "./content/community";
import { workSheet } from "./ui/worksheet";
import { billboardSheet } from "./ui/billboardsheet";
import { communitySheet } from "./ui/communitysheet";
import { topUpSheet } from "./ui/topupsheet";
import { destinations } from "./ui/gosheet";
import { bodaFare } from "./content/catalog";
import type { TalkMsg } from "./net/api";

const BILLBOARD = "UG LIFE · YOUR STREET, YOUR STORY";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

function localStore(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked */
  }
  return null;
}

export class Game implements S.GameApi {
  state: PlayerState;
  private backend: Backend = new LocalBackend();
  private sim: Sim;
  private renderer: Renderer;
  private dirty = true;
  private lastSave = 0;
  private lastHud = 0;
  private lastTick = 0;
  private nextCustomerAt = 0;
  private follow = true;
  private sheet: { spec: S.SheetSpec; el: HTMLElement; lastLive: number } | null = null;
  private hud!: Record<string, HTMLElement>;
  private landing: HTMLElement | null = null;
  private installEvt: BeforeInstallPromptEvent | null = null;
  private walkedTiles = 0;
  private running = false;
  readonly api = new Api();
  private unsynced = false;
  private syncing = false;
  private net = { sync: 0, street: 0, plots: 0, track: 0, uploads: 0 };
  private visitors: LiveVisitor[] = [];
  private billboard: { img: CanvasImageSource | null; key: string } = { img: null, key: "" };
  private isOnline = false;
  private plots: SharedPlot[] = [];
  private ridingOn = false;
  private talk: TalkEntry[] = [];
  private talkListeners = new Set<() => void>();
  private talkSeen = new Set<string>();
  private talkSince = 0;
  private lastTalkAt = 0;
  private othersActive = false;
  private polling = false;
  private unread = false;
  private lastBalance = 0;
  private nextAmb = 0;
  private nextShout = performance.now() + 20_000;
  private lastFrame = 0;
  private lite = false;
  private slowFrames = { n: 0, slow: 0 };
  private ads: BillboardAd[] = [];
  private news = { latest: 0, seen: Number(localStore("uglife.newsSeen") ?? 0) };
  private proposalTitles = new Map<string, string>();
  private liveEvents: LiveEvent[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const now = Date.now();
    this.state = this.backend.load() ?? newPlayer(now, newPlayerId());
    this.renderer = new Renderer(canvas);
    this.sim = new Sim(this.state.look, this.state.pos);
    this.sim.player.look = this.state.look;
    const p = toScreen(this.sim.player.x, this.sim.player.y);
    this.renderer.cam = { x: p.sx, y: p.sy - 40, zoom: this.renderer.defaultZoom() };
    if (this.state.settings.lite === undefined) this.state.settings.lite = Game.slowPhone();
    this.lastBalance = balanceOf(this.state.ledger);
    this.sim.onChatter = (w, text) => {
      this.addTalk({ key: `npc:${w.id}:${performance.now()}`, whoId: w.id, who: w.resident?.name ?? "Neighbour", kind: "resident", text, at: Date.now(), mine: false });
      if (Math.hypot(w.x - this.sim.player.x, w.y - this.sim.player.y) < 6 && Math.random() < 0.6) sound.speak(text, w.id, 0.8);
    };
    this.buildHud();
    this.bindInput();
    this.applySettings();
    // browsers only allow sound after the first tap
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("resize", () => this.renderer.resize());
    document.addEventListener("visibilitychange", () => {
      sound.suspend(document.hidden);
      if (document.hidden) {
        this.persist(true);
        void this.syncNow();
      } else this.lastTick = performance.now();
    });
    window.addEventListener("pagehide", () => this.persist(true));
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.installEvt = e as BeforeInstallPromptEvent;
    });
  }

  start() {
    this.running = true;
    this.lastTick = performance.now();
    requestAnimationFrame(this.frame);
    if (!this.state.onboarded || !this.state.ageConfirmed) this.showLanding();
    else this.enter();
  }

  // ---------- GameApi ----------

  now() {
    return Date.now();
  }

  changed() {
    const bal = balanceOf(this.state.ledger);
    if (bal > this.lastBalance) sound.sfx("coin");
    this.lastBalance = bal;
    this.dirty = true;
    this.unsynced = true;
    this.sim.player.look = this.state.look;
    this.updateHud();
  }

  toast(msg: string, kind: "ok" | "bad" | "info" = "info") {
    const root = document.getElementById("toast-root")!;
    const t = h("div", { class: `toast ${kind === "info" ? "" : kind}`, role: "status" }, msg);
    root.append(t);
    while (root.children.length > 2) root.firstChild?.remove();
    setTimeout(() => t.remove(), 3200);
  }

  result(r: A.Result) {
    if (!r.ok) sound.sfx("bad");
    this.toast(r.message, r.ok ? "ok" : "bad");
    return r.ok;
  }

  openSheet(spec: S.SheetSpec) {
    const root = document.getElementById("sheet-root")!;
    root.replaceChildren();
    const closable = spec.closable !== false;
    const scrim = h("div", { class: "scrim" });
    if (closable) scrim.addEventListener("click", () => this.closeSheet());
    const head = h("div", { class: "sheet-head" },
      h("h2", { id: "sheet-title" }, spec.eyebrow ? h("span", { class: "eyebrow" }, spec.eyebrow) : null, spec.title));
    if (closable) {
      const x = h("button", { class: "close", type: "button", "aria-label": "Close", html: ICONS.close });
      x.addEventListener("click", () => this.closeSheet());
      head.append(x);
    }
    const el = h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "sheet-title" }, head, spec.body());
    root.append(scrim, el);
    this.sheet = { spec, el, lastLive: performance.now() };
    // move focus into the dialog for keyboard and screen-reader users without scrolling it
    el.tabIndex = -1;
    el.focus({ preventScroll: true });
  }

  closeSheet() {
    const s = this.sheet;
    document.getElementById("sheet-root")!.replaceChildren();
    this.sheet = null;
    s?.spec.onClose?.();
  }

  walkTo(tile: { x: number; y: number }, onArrive?: () => void) {
    const target = isWalkable(tile.x, tile.y) ? tile : nearestWalkable(tile);
    if (!target) return;
    const before = this.sim.player.path.length;
    const ok = this.sim.walkPlayerTo(target, () => {
      this.onPlayerArrive();
      onArrive?.();
    });
    if (ok) {
      this.follow = true;
      this.walkedTiles += Math.max(0, this.sim.player.path.length - before);
    }
  }

  joinUrl() {
    const env = import.meta.env.VITE_PUBLIC_URL as string | undefined;
    const base = env || (location.protocol.startsWith("http") && !location.hostname.includes("claude") ? location.origin + location.pathname.replace(/index\.html$/, "") : "https://ug-life.netlify.app/");
    return this.api.inviteUrl(base);
  }

  // ---------- street life ----------

  sharedPlot(plotId: string) {
    return this.plots.find((p) => p.plotId === plotId && p.leasedUntil > Date.now()) ?? null;
  }

  async leasePlot(plotId: string, renew = false): Promise<boolean> {
    const s = this.state;
    if (!this.api.available) {
      // preview build without a server: the street is just yours
      const ok = this.result(renew ? A.renewKiosk(s, Date.now()) : A.leaseKiosk(s, plotId, Date.now()));
      if (ok) this.changed();
      return ok;
    }
    if (!this.isOnline) {
      this.toast("Leasing needs a connection, so two players can't take the same plot.", "bad");
      return false;
    }
    if (balanceOf(s.ledger) < 25_000) {
      this.toast("You need UGX 25,000 to lease a kiosk.", "bad");
      return false;
    }
    this.unsynced = true;
    await this.syncNow(); // the server checks your saved balance
    const r = await this.api.claimPlot(plotId);
    if (!r.ok) {
      this.toast(r.message, "bad");
      await this.refreshPlots();
      return false;
    }
    const ok = this.result(r.renewed || renew ? A.renewKiosk(s, Date.now(), r.day) : A.leaseKiosk(s, plotId, Date.now(), r.day));
    if (ok) {
      track("kiosk_leased");
      this.changed();
      this.unsynced = true;
      await this.syncNow();
      await this.refreshPlots();
    }
    return ok;
  }

  takeBoda(placeId: string) {
    const place = placeById(placeId);
    if (place) this.rideTo(place, place.name);
  }

  /** Pays a boda fare and rides to any tile. Returns false if it couldn't. */
  private rideTo(tile: { x: number; y: number }, name: string, onArrive?: () => void): boolean {
    const s = this.state;
    if (s.ride) {
      this.toast("You're carrying a passenger. Drop them off first.", "bad");
      return false;
    }
    if (!this.result(St.payFareTo(s, { x: tile.x, y: tile.y, name }, { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) }, Date.now()))) return false;
    track("boda_taken");
    this.closeSheet();
    this.ridingOn = false;
    sound.sfx("kick");
    this.sim.say(this.sim.player, "Boda! Tugende!", 2200);
    this.sim.setPlayerBoda("passenger", { boda: BODA.speed, walk: BODA.walkSpeed }, { ...RIDER, shirt: "#e07a1f" });
    this.walkTo(tile, () => {
      this.sim.setPlayerBoda(null, { boda: BODA.speed, walk: BODA.walkSpeed });
      sound.sfx("horn");
      this.toast(`You're at ${name}.`, "info");
      onArrive?.();
    });
    this.changed();
    return true;
  }

  async buyLand(areaId: string): Promise<boolean> {
    if (!this.isOnline) {
      this.toast("Buying land needs a connection.", "bad");
      return false;
    }
    this.unsynced = true;
    await this.syncNow(); // the server checks your saved balance
    const r = await this.api.claimLand(areaId);
    if (!r.ok) {
      this.toast(r.message, "bad");
      return false;
    }
    const ok = this.result(Land.buyLand(this.state, areaId, r.slot, r.price, Date.now()));
    if (ok) {
      sound.sfx("ok");
      this.changed();
      this.unsynced = true;
      await this.syncNow();
    }
    return ok;
  }

  goTo(d: Destination, boda: boolean) {
    const open = () => this.openDestination(d);
    if (boda) this.rideTo(d.tile, d.name, open);
    else {
      this.closeSheet();
      this.walkTo(d.tile, open);
    }
  }

  private openDestination(d: Destination) {
    switch (d.open) {
      case "vendor": return this.openSheet(vendorSheet(this, d.id));
      case "building": {
        const b = BUILDINGS.find((x) => x.id === d.id);
        if (b && !(this.state.job && A.jobTarget(this.state.job)?.id === b.id)) this.openSheet(S.buildingSheet(this, b));
        return;
      }
      case "kiosk": return this.openSheet(S.kioskSheet(this, d.id));
      case "board": return this.openSheet(albumSheet(this));
      case "pothole": return this.openSheet(S.civicSheet(this));
      case "boda": return this.openSheet(bodaSheet(this, St.hasBoda(this.state, Date.now()) ? "work" : "ride"));
      case "gate": return this.showLandmark("makerere-gate");
    }
  }

  // ---------- work, billboards, community, money ----------

  openSnaps() {
    this.openSheet(albumSheet(this));
  }

  topUpEnabled() {
    return this.isOnline && !!this.api.config?.topups;
  }

  openTopUp() {
    this.openSheet(topUpSheet(this));
  }

  async startTopUp(pack: string) {
    const r = await this.api.topUp(pack);
    if (!r.ok) {
      this.toast(r.message, "bad");
      return;
    }
    track("topup_started");
    localStore("uglife.topup", r.ref);
    this.persist(true);
    location.href = r.link;
  }

  /** Back from the payment page (or reopened later): ask the server, then credit once. */
  private async checkTopUp(ref: string) {
    for (let i = 0; i < 8; i++) {
      const r = await this.api.verifyTopUp(ref);
      if (r && "credit" in r) {
        const got = Money.claimTopUp(this.state, ref, r.credit, Date.now());
        if (got) {
          this.result(got);
          this.changed();
          this.unsynced = true;
          void this.syncNow();
        }
        localStore("uglife.topup", "");
        return;
      }
      if (i === 0) this.toast("Checking your mobile money payment…", "info");
      await new Promise((res) => setTimeout(res, 5000));
    }
    this.toast("Your payment isn't confirmed yet. If you paid, it will arrive by itself within a few minutes.", "info");
  }

  billboards() {
    return this.ads;
  }

  private async refreshBillboards(fresh = false) {
    if (!this.isOnline) return;
    const ads = await this.api.billboards(fresh);
    if (!ads) return;
    this.ads = ads;
    this.renderer.invalidate("b:pharmacy");
  }

  async rentBillboard(slot: string, o: { text: string; sub: string; color: string; days: number }): Promise<boolean> {
    if (!this.isOnline) {
      this.toast("Renting a billboard needs a connection.", "bad");
      return false;
    }
    this.unsynced = true;
    await this.syncNow(); // the server checks your saved balance
    const r = await this.api.rentBillboard(slot, o);
    if (!r.ok) {
      this.toast(r.message, "bad");
      return false;
    }
    const ok = this.result(Money.payBillboard(this.state, slot, r.day, r.price, Date.now()));
    if (ok) {
      sound.sfx("ok");
      track("billboard_rented");
      this.changed();
      this.unsynced = true;
      await this.syncNow();
      await this.refreshBillboards(true);
    }
    return ok;
  }

  private async refreshCommunity() {
    if (!this.isOnline) return;
    const c = await this.api.community();
    if (!c) return;
    for (const p of c.proposals) this.proposalTitles.set(p.id, p.title);
    this.liveEvents = c.events;
    this.news.latest = c.news[0]?.at ?? 0;
    this.updateMoreDot();
    const live = c.events.find((e) => c.now >= e.startsAt && c.now <= e.endsAt && !e.attended);
    if (live && !this.toldEvent.has(live.id)) {
      this.toldEvent.add(live.id);
      const place = placeById(live.place);
      this.actionToast(`🔴 Live now: ${live.title}${live.reward ? ` (UGX ${live.reward.toLocaleString()} for coming)` : ""}`, "Go", () => {
        if (place) this.walkTo(place, () => this.openSheet(communitySheet(this, "events")));
      });
    }
  }
  private toldEvent = new Set<string>();

  markNewsRead(at: number) {
    if (at > this.news.seen) {
      this.news.seen = at;
      localStore("uglife.newsSeen", String(at));
      track("news_read");
      this.updateMoreDot();
    }
  }

  private updateMoreDot() {
    const btn = this.hud?.moreBtn;
    if (!btn) return;
    const want = this.news.latest > this.news.seen;
    const dot = btn.querySelector(".dot");
    if (want && !dot) btn.append(h("span", { class: "dot" }));
    if (!want && dot) dot.remove();
  }

  async attendEvent(e: LiveEvent): Promise<boolean> {
    // tell the server where you are first, so it can see you're at the event
    await this.refreshVisitors();
    const r = await this.api.attendEvent(e.id);
    if (!r.ok) {
      this.toast(r.message, "bad");
      return false;
    }
    track("event_attended");
    const got = Money.claimEvent(this.state, e.id, r.reward, e.title, Date.now());
    if (got) this.result(got);
    else this.toast(`You're at ${e.title}!`, "ok");
    sound.sfx("ok");
    this.sim.emote(this.sim.player, "dance", "💃", 5000);
    this.changed();
    return true;
  }

  shareLink(title: string, params: Record<string, string>) {
    const base = this.joinUrl();
    const url = base + Object.entries(params).map(([k, v]) => `${base.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`).join("").replace(/\?(.*)\?/, "?$1&");
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      nav.share({ title, text: title, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => this.toast("Link copied. Paste it in WhatsApp!", "ok"), () => this.toast(url, "info"));
    }
    track("card_shared");
  }

  rally(p: Proposal) {
    this.closeSheet();
    const board = { x: 25, y: 11 };
    this.toast(`Heading to the community board to rally for “${p.title}”.`, "info");
    this.walkTo(board, () => {
      const short = p.title.length > 22 ? p.title.slice(0, 21) + "…" : p.title;
      this.sim.emote(this.sim.player, "placard", short, 10 * 60_000);
      this.sim.say(this.sim.player, "✊ Tugende! Vote for this!", 4000);
      sound.sfx("send");
      track("rally_joined");
      if (this.isOnline) void this.api.talk("rally", p.id, { x: this.sim.player.x, y: this.sim.player.y });
      this.sim.replyTo("tugende", this.sim.player, (w, t) => this.residentSaid(w.id, w.resident?.name ?? "Neighbour", t));
    });
  }

  startShift(shiftId: string) {
    if (!this.result(Shifts.startShift(this.state, shiftId, Date.now()))) return;
    this.closeSheet();
    this.sim.emote(this.sim.player, "work", "🛠️", 120_000);
    sound.sfx("tap");
    this.changed();
  }

  /** Every frame while on a shift: pay it when the time is up, cancel it if you walked off. */
  private tickShift(now: number) {
    const cur = this.state.shift;
    if (!cur) return;
    const sh = SHIFTS.find((x) => x.id === cur.id);
    const b = sh && BUILDINGS.find((x) => x.id === sh.building);
    const p = this.sim.player;
    if (!b || tileDistance({ x: Math.floor(p.x), y: Math.floor(p.y) }, b.door) > 2) {
      this.result(Shifts.cancelShift(this.state));
      p.emote = undefined;
      this.changed();
      return;
    }
    const r = Shifts.finishShift(this.state, now);
    if (r) {
      this.result(r);
      p.emote = undefined;
      if (r.ok) {
        this.sim.float(r.message.replace("Shift done. ", ""), p.x, p.y);
        track("shift_done");
      }
      this.changed();
    }
  }

  // ---------- street talk ----------

  online() {
    return this.isOnline;
  }

  sfx(name: Parameters<typeof sound.sfx>[0]) {
    sound.sfx(name);
  }

  talkLog() {
    return this.talk;
  }

  onTalk(fn: () => void) {
    this.talkListeners.add(fn);
    this.unread = false;
    this.updateTalkDot();
    return () => this.talkListeners.delete(fn);
  }

  private addTalk(e: TalkEntry) {
    this.talk.push(e);
    if (this.talk.length > 80) this.talk.splice(0, this.talk.length - 80);
    if (this.talkListeners.size) this.talkListeners.forEach((f) => f());
    else if (!e.mine && e.kind !== "resident") {
      this.unread = true;
      this.updateTalkDot();
    }
  }

  private updateTalkDot() {
    const btn = this.hud?.talkBtn;
    if (!btn) return;
    const dot = btn.querySelector(".dot");
    if (this.unread && !dot) btn.append(h("span", { class: "dot" }));
    if (!this.unread && dot) dot.remove();
  }

  say(kind: "phrase" | "text" | "emote", body: string, to?: string) {
    const s = this.state;
    const p = this.sim.player;
    const now = Date.now();
    let text = body;
    if (kind === "emote") {
      const e = emoteById(body);
      if (!e) return;
      this.sim.emote(p, e.id, e.icon, e.id === "dance" ? 6000 : 3200);
      if (e.id === "dance" && A.complete(s, "dance")) this.toast("Goal done: dance on the street. Claim it in Goals.", "ok");
      if (e.id === "dance") this.sim.replyTo("haha", p);
      track("emote_sent");
    } else {
      if (kind === "phrase") {
        const ph = phraseById(body);
        if (!ph) return;
        text = ph.text;
        if (body === "otya" && A.complete(s, "hello")) this.toast("Goal done: say hi on the street. Claim it in Goals.", "ok");
      } else {
        const r = checkFreeText(body, 80);
        if (!r.ok || !r.value) {
          this.toast(r.ok ? "Say something first." : r.reason, "bad");
          return;
        }
        text = body = r.value;
      }
      this.sim.say(p, text, 5000);
      sound.sfx("send");
      sound.speak(text, "you");
      this.addTalk({ key: `me:${now}`, whoId: "player", who: s.tag.name || "You", kind, text, at: now, mine: true });
      if (kind === "phrase") this.sim.replyTo(body, p, (w, t) => this.residentSaid(w.id, w.resident?.name ?? "Neighbour", t));
      track("talk_sent");
    }
    this.lastTalkAt = performance.now();
    this.changed();
    if (this.isOnline && s.tag.name) {
      void this.api.talk(kind, body, { x: p.x, y: p.y }, to).then((r) => {
        // a quick emote right after a message can hit the rate limit; that's fine to drop
        if ("error" in r) { if (kind !== "emote") this.toast(r.error, "bad"); }
        else this.talkSeen.add(r.id);
      });
    }
  }

  private residentSaid(id: string, name: string, text: string) {
    this.addTalk({ key: `npc:${id}:${performance.now()}`, whoId: id, who: name, kind: "resident", text, at: Date.now(), mine: false });
    sound.speak(text, id);
  }

  greetResident(id: string) {
    const r = this.sim.resident(id);
    if (!r?.resident) return;
    const p = this.sim.player;
    this.sim.say(p, `Oli otya, ${r.resident.name}!`, 3500);
    this.sim.emote(p, "wave", "👋", 2200);
    sound.speak(`Oli otya, ${r.resident.name}!`, "you");
    this.addTalk({ key: `me:${Date.now()}`, whoId: "player", who: this.state.tag.name || "You", kind: "phrase", text: `Oli otya, ${r.resident.name}!`, at: Date.now(), mine: true });
    if (A.complete(this.state, "hello")) this.toast("Goal done: say hi on the street. Claim it in Goals.", "ok");
    this.sim.greetResident(id, (w, t) => this.residentSaid(w.id, r.resident!.name, t));
    track("resident_greeted");
    this.changed();
  }

  async sendVoice(blob: Blob, ms: number) {
    if (!this.isOnline) {
      this.toast("Voice hellos need a connection.", "bad");
      return;
    }
    const p = this.sim.player;
    const r = await this.api.voice(blob, ms, { x: p.x, y: p.y });
    if ("error" in r) {
      this.toast(r.error, "bad");
      return;
    }
    this.talkSeen.add(r.id);
    this.sim.say(p, "Voice hello", 8000, { voiceId: r.body });
    sound.sfx("send");
    this.addTalk({ key: `me:${Date.now()}`, talkId: r.id, whoId: "player", who: this.state.tag.name || "You", kind: "voice", text: "Voice hello", voiceId: r.body, at: Date.now(), mine: true });
    if (A.complete(this.state, "hello")) this.toast("Goal done: say hi on the street. Claim it in Goals.", "ok");
    this.changed();
    track("voice_sent");
  }

  playVoice(voiceId: string) {
    void sound.playUrl(this.api.voiceUrl(voiceId)).then((ok) => { if (!ok) this.toast("Couldn't play that voice hello. It may have expired.", "info"); });
  }

  reportTalk(e: TalkEntry) {
    if (!e.talkId) return;
    const id = e.talkId;
    this.talk = this.talk.filter((x) => x.talkId !== id);
    for (const w of this.sim.visitors) if (w.say?.talkId === id) w.say = undefined;
    this.talkListeners.forEach((f) => f());
    void this.api.reportTalk(id).then((ok) => this.toast(ok ? `Reported. Thanks. ${e.who}'s message is hidden for you, and our team will look at it.` : "Couldn't send the report. Try again with signal.", ok ? "ok" : "bad"));
  }

  openProfile(id: string) {
    if (id === "player") return this.openSheet(S.tagSheet(this, false));
    const v = this.visitors.find((x) => x.id === id);
    if (v) return this.openSheet(S.visitorSheet(this, v));
    if (this.sim.resident(id)) this.openSheet(S.residentSheet(this, id));
  }

  /** A message from a real player arrived. Fresh ones show as bubbles and can be heard. */
  private receive(m: TalkMsg, fresh: boolean) {
    const me = this.api.playerId;
    const w = this.sim.walker(m.playerId);
    const near = w ? Math.hypot(w.x - this.sim.player.x, w.y - this.sim.player.y) < 9 : false;
    let text = m.body;
    if (m.kind === "phrase") text = phraseById(m.body)?.text ?? "";
    if (m.kind === "emote") {
      const e = emoteById(m.body);
      if (fresh && w && e) this.sim.emote(w, e.id, e.icon, e.id === "dance" ? 6000 : 3200);
      return;
    }
    if (m.kind === "rally") {
      const title = m.title ?? this.proposalTitles.get(m.body) ?? "Vote!";
      if (fresh && w) this.sim.emote(w, "placard", title.length > 22 ? title.slice(0, 21) + "…" : title, 10 * 60_000);
      this.addTalk({ key: m.id, talkId: m.id, whoId: m.playerId, who: m.name, kind: "text", text: `✊ is rallying for “${title}”`, at: m.at, mine: false });
      return;
    }
    if (m.kind === "voice") text = "Voice hello";
    if (!text) return;
    const toMe = !!m.to && m.to === me;
    this.addTalk({ key: m.id, talkId: m.id, whoId: m.playerId, who: m.name, kind: m.kind, text, voiceId: m.kind === "voice" ? m.body : undefined, at: m.at, mine: false, toMe });
    if (!fresh) return;
    if (w) this.sim.say(w, text, m.kind === "voice" ? 9000 : 5500, { talkId: m.id, voiceId: m.kind === "voice" ? m.body : undefined });
    sound.sfx("pop");
    if (toMe) this.toast(`${m.name}: ${text}`, "info");
    if (m.kind === "voice" && this.state.settings.voiceAuto && near) this.playVoice(m.body);
    if (m.kind === "phrase" && near) sound.speak(text, m.playerId, 0.9);
  }

  applySettings() {
    const st = this.state.settings;
    sound.setEnabled(st.sound !== false);
    sound.musicOn = st.music !== false;
    sound.voicesOn = st.voices !== false;
    this.lite = !!st.lite;
    sound.lite = this.lite;
    this.renderer.maxDpr = this.lite ? 1 : 2;
    this.renderer.resize();
    this.renderer.invalidate();
    // on slow phones fewer passers-by walk about
    let extra = 0;
    for (const r of this.sim.residents) {
      if (!r.id.startsWith("pb-") || r.waving || this.state.ride?.passengerId === r.id) continue;
      r.hidden = this.lite && extra++ >= 4;
    }
    const btn = this.hud?.soundBtn;
    if (btn) {
      btn.innerHTML = st.sound === false ? ICONS.mute : ICONS.sound;
      btn.setAttribute("aria-label", st.sound === false ? "Turn sound on" : "Turn sound off");
    }
  }

  /** Low memory, few cores or data saver: start in lite mode. */
  private static slowPhone(): boolean {
    const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    return (n.deviceMemory !== undefined && n.deviceMemory <= 2) || (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 2) || n.connection?.saveData === true;
  }

  setRiding(on: boolean) {
    if (on && !St.hasBoda(this.state, Date.now())) {
      this.toast("Rent a boda first.", "bad");
      return;
    }
    if (!on && this.state.ride?.stage === "dropoff") {
      this.toast("Your passenger is still on the back.", "bad");
      return;
    }
    this.ridingOn = on;
    this.sim.setPlayerBoda(on ? "rider" : null, { boda: BODA.speed, walk: BODA.walkSpeed });
  }

  riding() {
    return this.ridingOn;
  }

  startRide(offerId: string) {
    const s = this.state;
    if (!this.result(St.acceptRide(s, offerId, Date.now()))) return;
    const ride = s.ride!;
    const from = placeById(ride.fromId)!;
    this.setRiding(true);
    this.sim.callResidentTo(ride.passengerId, from);
    this.closeSheet();
    this.walkTo(from);
    this.changed();
  }

  cancelRide() {
    const s = this.state;
    if (s.ride?.stage === "dropoff") this.sim.setPillion(s.ride.passengerId, false, { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) });
    this.result(St.dropRide(s));
    this.sim.releaseWaiting();
    this.changed();
  }

  showLandmark(id: string) {
    const r = St.discoverLandmark(this.state, id, Date.now());
    if (r) {
      this.result(r);
      track("landmark_found");
      if (this.state.goals.includes("landmarks") && this.state.landmarks.length === 5) this.toast("Goal done: 5 Kampala landmarks. Claim it in Goals.", "ok");
      this.changed();
    }
    this.openSheet(landmarkSheet(this, id));
  }

  private async refreshPlots() {
    if (!this.isOnline) return;
    const list = await this.api.plots();
    if (list) this.plots = list;
  }

  private async claimServerRewards() {
    if (!this.isOnline) return;
    const r = await this.api.rewards();
    if (!r) return;
    const now = Date.now();
    for (const f of r.referrals) {
      const got = St.claimReferral(this.state, f.id, f.name, now);
      if (got) this.toast(got.message, "ok");
    }
    if (r.referred) {
      const got = St.claimReferredBonus(this.state, now);
      if (got) this.toast(got.message, "ok");
    }
    for (const t of r.topups ?? []) {
      const got = Money.claimTopUp(this.state, t.ref, t.credit, now);
      if (got) this.toast(got.message, "ok");
    }
    this.changed();
  }

  finishOnboarding() {
    this.state.onboarded = true;
    track("onboarded");
    this.dirty = true;
    this.enter();
  }

  resetSave() {
    this.backend.reset();
    this.running = false;
    location.reload();
  }

  installPrompt() {
    const e = this.installEvt;
    if (!e) return null;
    return () => {
      e.prompt().catch(() => {});
      this.installEvt = null;
    };
  }

  track(name: string, props?: Record<string, unknown>) {
    track(name, props);
  }

  onSnap(rec: SnapRecord | null) {
    track("snap_made");
    if (rec?.status === "queued") void this.uploadQueued();
    void this.refreshBillboard();
  }

  adoptSave(save: PlayerState, message: string) {
    this.state = { ...newPlayer(save.createdAt ?? Date.now(), save.id), ...save };
    this.sim.player.x = this.state.pos.x;
    this.sim.player.y = this.state.pos.y;
    this.sim.player.path = [];
    this.backend.save(this.state);
    this.unsynced = false;
    this.toast(message, "info");
    this.changed();
    this.unsynced = false;
  }

  residentReported() {
    const order = [
      { id: "r-okello", name: "Okello", delay: 5000 },
      { id: "r-nakato", name: "Nakato", delay: 11000 },
    ];
    for (const r of order) {
      this.sim.schedule(r.delay, () => {
        if (A.residentReport(this.state, r.id, Date.now())) {
          this.toast(`${r.name} also reported the pothole`, "info");
          if (this.state.civic.status === "verified") this.toast("3 reports. The ward office verified it.", "ok");
          this.changed();
        }
      });
    }
  }

  // ---------- flow ----------

  private showLanding() {
    const age = h("input", { type: "checkbox", id: "age-ok" });
    const enter = h("button", { class: "btn block", type: "button", disabled: true }, "Enter the street");
    age.addEventListener("change", () => (enter.disabled = !age.checked));
    enter.addEventListener("click", () => {
      this.state.ageConfirmed = true;
      this.landing?.remove();
      this.landing = null;
      track("age_confirmed");
      this.openSheet(S.tagSheet(this, true));
    });
    this.landing = h("div", { class: "landing" },
      h("div", { class: "landing-card" },
        h("div", { class: "band" }, h("div", { class: "wordmark" }, "Ug Life"), h("div", { class: "tagline" }, "A Kampala street you can live on."), h("div", { class: "checker", "aria-hidden": "true" })),
        h("div", { class: "inner" },
          h("ul", {},
            h("li", {}, "Make your Ug Tag and walk Wandegeya"),
            h("li", {}, "Run deliveries, lease a kiosk, paint your sign"),
            h("li", {}, "Fix the street with your neighbours")),
          h("label", { class: "age", for: "age-ok" }, age, "I'm 18 or older"),
          enter,
          h("p", { class: "muted small", style: "margin:0" }, "Preview build. Your progress saves on this phone. Game money is simulated and has no real value."))));
    document.body.append(this.landing);
    document.getElementById("hud")!.hidden = true;
  }

  private enter() {
    document.getElementById("hud")!.hidden = false;
    const notes = A.visit(this.state, Date.now());
    notes.forEach((n, i) => setTimeout(() => this.toast(n, "ok"), 400 + i * 900));
    const ev = eventForTime(Date.now());
    setTimeout(() => this.toast(`Today: ${ev.title}`, "info"), 400 + notes.length * 900);
    setTimeout(() => this.toast(`🔥 Hot area today: ${hotArea(kampalaDateKey(Date.now())).name}. Land there pays double rent.`, "info"), 1400 + notes.length * 900);
    if (this.state.land.length && !Land.rentCollected(this.state, Date.now())) setTimeout(() => this.actionToast("Your tenants paid rent.", "Collect", () => { this.result(Land.collectRent(this.state, Date.now())); this.changed(); }), 2600 + notes.length * 900);
    this.nextCustomerAt = performance.now() + 12000;
    // pick up a boda ride where it was left
    const ride = this.state.ride;
    if (ride && St.hasBoda(this.state, Date.now())) {
      this.setRiding(true);
      if (ride.stage === "dropoff") this.sim.setPillion(ride.passengerId, true);
      else this.sim.callResidentTo(ride.passengerId, placeById(ride.fromId)!);
    } else if (ride) {
      St.dropRide(this.state);
      this.toast("Your boda rent ended at midnight, so the passenger found another boda.", "info");
    }
    track("session_start", { days: this.state.stats.daysVisited });
    this.followDeepLink();
    if (this.deepLink.at || this.deepLink.event || this.deepLink.topup) history.replaceState(null, "", location.pathname);
    this.changed();
    void this.goOnline();
    void this.refreshBillboard();
  }

  // ---------- online ----------

  private async goOnline() {
    if (!this.api.available) return;
    const cfg = await this.api.loadConfig();
    if (!cfg) return;
    if (cfg.announcement) this.toast(cfg.announcement, "info");
    if (cfg.maintenance) {
      this.toast("Ug Life is in maintenance. Keep playing; your progress saves when it's back.", "info");
      return;
    }
    if (!(await this.api.ensureSession())) return;
    this.isOnline = true;
    await this.syncNow();
    void this.refreshVisitors();
    void this.refreshPlots();
    void this.uploadQueued();
    void this.claimServerRewards();
    void this.refreshBillboards();
    void this.refreshCommunity();
    const pendingTopUp = this.deepLink.topup || localStore("uglife.topup");
    if (pendingTopUp) void this.checkTopUp(pendingTopUp);
    if (this.deepLink.event) this.openSheet(communitySheet(this, "events"));
  }

  /** Links people share: ?at=<place> walks you there, ?event=<id> opens the event. */
  private deepLink = (() => {
    const q = new URLSearchParams(location.search);
    return { at: q.get("at"), event: q.get("event"), topup: q.get("topup") };
  })();

  private followDeepLink() {
    const at = this.deepLink.at;
    if (!at) return;
    const d = destinations(this).find((x) => x.id === at);
    if (d) setTimeout(() => {
      this.toast(`Taking you to ${d.name}`, "info");
      this.goTo(d, false);
    }, 1500);
  }

  private async syncNow() {
    if (!this.isOnline || this.syncing || !this.state.onboarded) return;
    this.syncing = true;
    this.unsynced = false;
    try {
      const r = await this.api.sync(this.state);
      if (!r) this.unsynced = true;
      else if (r.kind === "replace") this.adoptSave(r.save, r.message);
      else if (r.kind === "error") {
        this.unsynced = true;
        if (/maintenance|review/.test(r.message)) this.toast(r.message, "info");
      }
    } finally {
      this.syncing = false;
    }
  }

  /** One call brings who's on the street and what they said, and tells the server where you are. */
  private async refreshVisitors() {
    if (!this.isOnline || this.polling) return;
    this.polling = true;
    try {
      const s = this.state;
      const r = await this.api.live(s.onboarded ? { x: s.pos.x, y: s.pos.y } : null, this.talkSince);
      if (!r) return;
      const me = this.api.playerId;
      this.visitors = r.players.filter((v) => v.id !== me);
      this.sim.setVisitors(this.visitors, s.blocked);
      this.othersActive = this.visitors.some((v) => r.now - v.seen < 120_000);
      for (const m of r.talk) {
        this.talkSince = Math.max(this.talkSince, m.at);
        if (this.talkSeen.has(m.id)) continue;
        this.talkSeen.add(m.id);
        if (m.playerId === me || s.blocked.includes(m.playerId)) continue;
        this.receive(m, r.now - m.at < 20_000);
      }
    } finally {
      this.polling = false;
    }
  }

  /** Poll often while people are around or talking, rarely when the street is empty. */
  private liveInterval(t: number) {
    const talking = this.sheet?.spec.kind === "talk" || t - this.lastTalkAt < 90_000;
    return talking ? 6_000 : this.othersActive ? 10_000 : 30_000;
  }

  private async uploadQueued() {
    if (!this.isOnline) return;
    // support notes written while offline
    for (const t of this.state.tickets.filter((x) => x.status === "saved")) {
      if (!(await this.api.ticket(t.category, t.text))) break;
      t.status = "sent";
      this.changed();
    }
    if (this.api.config?.uploads === false) return;
    const snaps = await listSnaps();
    for (const s of snaps.filter((x) => x.status === "queued")) {
      const r = await this.api.uploadPhoto(s.blob, { area: s.area, place: s.place, width: s.width, height: s.height });
      if (!r) return; // offline: try again later
      if ("id" in r) {
        s.status = "pending";
        s.serverId = r.id;
        track("snap_uploaded");
        this.toast(`Your snap of ${s.place} is being checked. You'll see it on the board once approved.`, "ok");
      } else {
        s.status = "local";
        s.reason = r.error;
      }
      await saveSnap(s);
    }
    const pending = snaps.filter((x) => x.status === "pending" && x.serverId);
    if (pending.length) {
      const server = await this.api.myPhotos();
      for (const s of pending) {
        const row = server.find((p) => p.id === s.serverId);
        if (!row || row.status === "pending") continue;
        s.status = row.status === "approved" ? "approved" : "rejected";
        s.reason = row.reason ?? undefined;
        await saveSnap(s);
        this.toast(s.status === "approved" ? `Your snap of ${s.place} is on the community board!` : `Your snap of ${s.place} wasn't approved: ${s.reason ?? "it broke a photo rule"}`, s.status === "approved" ? "ok" : "info");
      }
    }
  }

  /** The rooftop billboard shows a featured community snap, or your own latest one. */
  private async refreshBillboard() {
    let src: string | null = null, key = "";
    const community = this.isOnline ? await this.api.photos() : null;
    const top = community?.photos[0];
    if (top) {
      src = this.api.photoUrl(top.id);
      key = top.id;
    } else {
      const mine = (await listSnaps())[0];
      if (mine) {
        src = URL.createObjectURL(mine.blob);
        key = mine.id;
      }
    }
    if (key === this.billboard.key) return;
    if (!src) {
      this.billboard = { img: null, key: "" };
      this.renderer.invalidate("b:pharmacy");
      return;
    }
    const img = new Image();
    img.src = src;
    try {
      await img.decode();
      this.billboard = { img, key };
      this.renderer.invalidate("b:pharmacy");
    } catch {
      /* keep the text billboard */
    }
  }

  private netTick(t: number) {
    if (!this.isOnline) return;
    if (this.unsynced && t > this.net.sync) {
      this.net.sync = t + 45_000;
      void this.syncNow();
    }
    if (t > this.net.street) {
      this.net.street = t + this.liveInterval(t);
      void this.refreshVisitors();
    }
    if (t > this.net.plots) {
      this.net.plots = t + 30_000;
      void this.refreshPlots();
    }
    if (t > this.net.track) {
      this.net.track = t + 60_000;
      void this.api.track(drainEventNames());
    }
    if (t > this.net.uploads) {
      this.net.uploads = t + 120_000;
      void this.uploadQueued();
      void this.refreshBillboard();
      void this.claimServerRewards();
      void this.refreshBillboards();
      void this.refreshCommunity();
    }
  }

  private onPlayerArrive() {
    const p = this.sim.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.walkedTiles >= 5 && A.complete(this.state, "walk")) this.toast("Goal done: walk down the street", "ok");
    for (const place of PLACES) {
      if (Math.abs(place.x - tx) <= 1 && Math.abs(place.y - ty) <= 1) {
        const ride = this.state.ride ? { ...this.state.ride } : null;
        const hadJob = !!this.state.job;
        const r = A.arriveAt(this.state, place.id, Date.now());
        if (r) {
          this.result(r);
          if (ride && r.ok) {
            if (ride.stage === "pickup") {
              this.sim.setPillion(ride.passengerId, true);
              const to = placeById(ride.toId);
              if (to) this.walkTo(to);
            } else {
              this.sim.setPillion(ride.passengerId, false, { x: tx, y: ty });
              this.sim.float(`+UGX ${ride.pay.toLocaleString()}`, p.x, p.y);
              track("ride_done");
            }
          } else if (hadJob && r.ok && !this.state.job) {
            this.sim.float(r.message.replace("Delivered. ", ""), p.x, p.y);
            track("job_completed");
          }
          this.changed();
          return;
        }
      }
    }
    this.changed();
  }

  // ---------- loop ----------

  private frame = (t: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    if (document.hidden) return;
    // lite mode: about 30 frames a second is plenty and saves battery
    if (this.lite && t - this.lastFrame < 30) return;
    this.watchSpeed(t - this.lastFrame);
    this.lastFrame = t;
    const dt = Math.min(0.05, (t - this.lastTick) / 1000);
    this.lastTick = t;
    const now = Date.now();
    this.sim.update(dt, t);
    this.state.pos = { x: this.sim.player.x, y: this.sim.player.y };

    if (advance(this.state.civic, now)) {
      const last = this.state.civic.timeline[this.state.civic.timeline.length - 1];
      this.toast(`Pothole: ${last.note}`, last.status === "resolved" ? "ok" : "info");
      if (last.status === "resolved") this.state.xp += 10;
      this.changed();
    }
    this.kioskCustomers(t);
    this.tickShift(now);
    this.netTick(t);
    if (t > this.nextAmb) {
      this.nextAmb = t + 250;
      this.ambience(now, t);
    }

    if (this.follow) {
      const p = toScreen(this.sim.player.x, this.sim.player.y);
      const cam = this.renderer.cam;
      const k = Math.min(1, dt * 4);
      cam.x += (p.sx - cam.x) * k;
      cam.y += (p.sy - 30 - cam.y) * k;
    }
    this.renderer.clampCamera();
    this.renderer.render(this.sim, this.scene(now), t);

    if (t - this.lastHud > 500) {
      this.lastHud = t;
      this.updateHud();
    }
    if (this.sheet?.spec.live && t - this.sheet.lastLive > 1000) {
      this.sheet.lastLive = t;
      const body = this.sheet.spec.body();
      const old = this.sheet.el.querySelector(".sheet-body");
      if (old) {
        body.scrollTop = old.scrollTop;
        old.replaceWith(body);
      }
    }
    this.persist(false);
  };

  /** If the phone keeps dropping frames, switch to lite mode once (unless the player chose). */
  private watchSpeed(frameMs: number) {
    const w = this.slowFrames;
    if (this.lite || w.n > 400 || this.state.settings.lite === false && w.n === -1) return;
    w.n++;
    if (frameMs > 45) w.slow++;
    if (w.n === 400 && w.slow > 160 && !this.state.settings.lite) {
      this.state.settings.lite = true;
      this.applySettings();
      this.toast("Switched to lite mode so the street runs smoother. Change it in More → Sound and settings.", "info");
      this.changed();
    }
  }

  /** Feeds the sound engine what's near the camera, and lets the street call out now and then. */
  private ambience(now: number, t: number) {
    const c = toWorld(this.renderer.cam.x, this.renderer.cam.y);
    const scene = this.scene(now);
    let bodas = 0, matatus = 0;
    for (const v of this.sim.vehicles) {
      if (Math.abs(v.x - c.x) > 9 || v.speed < 0.3) continue;
      if (v.kind === "boda") bodas++;
      else if (v.kind === "matatu") matatus++;
    }
    const ev = eventForTime(now);
    const hour = kampalaHour(now);
    const studio = Math.max(0, 1 - Math.hypot(c.x - 17.5, c.y - 4) / 14);
    const p = this.sim.player;
    sound.update({
      night: scene.night,
      rain: scene.rain,
      bodas: Math.min(1, bodas / 4),
      matatus: Math.min(1, matatus / 2),
      music: studio * (ev.id === "music" || hour >= 18 || hour < 1 ? 1 : 0.4),
      crowd: Math.min(1, 0.4 + this.visitors.length * 0.1),
      riding: p.vehicle ? (p.moving ? 1 : 0.3) : 0,
    });
    if (t > this.nextShout && this.state.onboarded) {
      this.nextShout = t + 30_000 + Math.random() * 40_000;
      const shout = STREET_SHOUTS.filter((x) => tileDistance(x.at, { x: Math.floor(p.x), y: Math.floor(p.y) }) < 9);
      const pick = shout[Math.floor(Math.random() * shout.length)];
      if (pick && !scene.night) {
        this.sim.float(pick.text.split("!")[0] + "!", pick.at.x + 0.5, pick.at.y + 0.5, "#b4442a");
        sound.speak(pick.text, pick.who, 0.75);
      }
    }
  }

  private kioskCustomers(t: number) {
    const k = this.state.kiosk;
    if (!k || t < this.nextCustomerAt || !this.state.onboarded) return;
    this.nextCustomerAt = t + 25000 + Math.random() * 20000;
    const { count, max } = A.kioskSalesToday(this.state, Date.now());
    if (count >= max) return;
    const plot = PLOTS.find((p) => p.id === k.plotId)!;
    this.sim.sendResident({ x: plot.x + 1, y: plot.y - 1 }, () => {
      const r = A.kioskSale(this.state, Date.now());
      if (r.ok) {
        this.sim.float(`+UGX 500`, plot.x + 1, plot.y + 0.5, "#1f4fd1");
        this.changed();
      }
    });
  }

  private persist(force: boolean) {
    const t = performance.now();
    if (!this.dirty && !force) return;
    if (!force && t - this.lastSave < 2000) return;
    this.backend.save(this.state);
    this.lastSave = t;
    this.dirty = false;
  }

  private yards(): Record<string, (string | null)[]> {
    const out: Record<string, (string | null)[]> = {};
    for (const p of this.plots) if (p.leasedUntil > Date.now() && p.kiosk?.yard && p.playerId !== this.api.playerId) out[p.plotId] = p.kiosk.yard;
    if (this.state.kiosk) out[this.state.kiosk.plotId] = this.state.yard;
    return out;
  }

  private scene(now: number): SceneState {
    const s = this.state;
    const hour = s.settings.liveTime ? kampalaHour(now) : 12;
    const night = hour >= 19 || hour < 6.2;
    const dusk = !night && hour >= 17.6 ? Math.min(1, (hour - 17.6) / 1.4) : 0;
    const ev = eventForTime(now);
    const kiosks: Record<string, KioskLook | null> = {};
    for (const p of PLOTS) {
      if (p.npcOwner) kiosks[p.id] = { name: p.npcOwner.sign, color: p.npcOwner.color, upgrades: ["shade"], mine: false };
      else if (s.kiosk?.plotId === p.id) kiosks[p.id] = { name: s.kiosk.name, color: s.kiosk.color, upgrades: s.kiosk.upgrades, mine: true };
      else if (this.sharedPlot(p.id)?.kiosk) {
        const k = this.sharedPlot(p.id)!.kiosk!;
        kiosks[p.id] = { name: k.name, color: k.color, upgrades: k.upgrades ?? [], mine: false };
      } else if (this.sharedPlot(p.id)) kiosks[p.id] = { name: `${this.sharedPlot(p.id)!.owner.toUpperCase()}'S`, color: "#5b6873", upgrades: [], mine: false };
      else kiosks[p.id] = null;
    }
    const target = s.ride ? St.rideTarget(s.ride) : s.job ? A.jobTarget(s.job) : null;
    return {
      night,
      dusk,
      // "Rainy afternoon" rains 1-6pm, "Morning drizzle" until 11am
      rain: ev.rain && !night && (!s.settings.liveTime || (ev.id === "rain" ? hour >= 13 && hour < 18 : hour < 11)),
      kiosks,
      civic: s.civic,
      marker: target ? { x: target.x, y: target.y } : null,
      markerLabel: s.ride ? (s.ride.stage === "pickup" ? `Pick up ${s.ride.passenger}` : "Drop off") : s.job ? (s.job.stage === "pickup" ? "Pick up" : "Drop off") : "",
      playerTag: s.tag.ghost ? null : { name: s.tag.name || "You", level: levelForXp(s.xp), status: s.tag.status, socials: s.tag.socials.map((x) => x.platform), mine: true },
      playerCarrying: s.job?.stage === "dropoff",
      hiddenTags: s.blocked,
      reducedMotion: s.settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      billboard: BILLBOARD,
      billboardImage: this.billboard.img,
      billboardKey: this.billboard.key,
      yards: this.yards(),
      ads: Object.fromEntries(this.ads.filter((a) => a.until > now).map((a) => [a.slot, { text: a.text, sub: a.sub, color: a.color }])),
    };
  }

  // ---------- HUD ----------

  private buildHud() {
    const hud = document.getElementById("hud")!;
    const btn = (icon: string, label: string, fn: () => void) => {
      const b = h("button", { class: "round", type: "button", "aria-label": label, title: label, html: icon });
      b.addEventListener("click", fn);
      return b;
    };
    const bal = h("div", { class: "bal" });
    const lvl = h("b", {});
    const xp = h("i", {});
    const eventChip = h("button", { class: "event-chip", type: "button" });
    eventChip.addEventListener("click", () => this.openSheet(S.eventSheet(this)));
    const boost = h("div", { class: "boost", hidden: true });
    const energy = h("i", {});
    const energyNum = h("span", { class: "en-num" });
    const energyRow = h("button", { class: "en", type: "button", "aria-label": "Energy" }, h("span", { class: "en-bolt" }, "⚡"), h("span", { class: "en-bar" }, energy), energyNum);
    energyRow.addEventListener("click", () => this.openSheet(workSheet(this)));
    const wallet = h("div", { class: "wallet" }, bal, h("div", { class: "lv" }, lvl, h("span", { class: "xpbar" }, xp)), energyRow, boost, h("div", { class: "sim" }, "Game shillings · not real money"));
    const goalsBtn = btn(ICONS.goals, "Street goals", () => this.openSheet(S.goalsSheet(this)));
    const soundBtn = btn(ICONS.sound, "Turn sound off", () => {
      this.state.settings.sound = this.state.settings.sound === false;
      this.applySettings();
      this.changed();
      this.toast(this.state.settings.sound ? "Sound on" : "Sound off", "info");
    });
    soundBtn.classList.add("small-round");
    const side = h("div", { class: "hud-side" },
      btn(ICONS.tag, "Your Ug Tag", () => this.openSheet(S.tagSheet(this, false))),
      goalsBtn,
      btn(ICONS.camera, "Street Snaps", () => this.openSheet(albumSheet(this))),
      btn(ICONS.share, "Invite friends", () => this.openSheet(S.shareSheet(this))),
      btn(ICONS.locate, "Find me", () => { this.follow = true; }));
    const nav = (icon: string, label: string, fn: () => void, cls = "") => {
      const b = h("button", { class: `nav-btn ${cls}`, type: "button", html: icon + `<span>${label}</span>` });
      b.addEventListener("click", () => {
        sound.sfx("tap");
        fn();
      });
      return b;
    };
    const talkBtn = nav(ICONS.talk, "Talk", () => this.openSheet(talkSheet(this)));
    const moreBtn = nav(ICONS.more, "More", () => this.openSheet(moreSheet(this)));
    const bar = h("nav", { class: "nav-bar", "aria-label": "Main" },
      nav(ICONS.go, "Go", () => this.openSheet(goSheet(this))),
      nav(ICONS.boda, "Boda", () => this.openSheet(bodaSheet(this, St.hasBoda(this.state, Date.now()) ? "work" : "ride")), "boda"),
      nav(ICONS.jobs, "Work", () => this.openSheet(workSheet(this))),
      talkBtn,
      moreBtn);
    const bottomInfo = h("div", { class: "bottom-info" });
    hud.append(h("div", { class: "hud-top" }, wallet, h("div", { class: "top-right" }, eventChip, soundBtn)), side, h("div", { class: "hud-bottom" }, bottomInfo, bar));
    this.hud = { bal, lvl, xp, eventChip, bottomInfo, goalsBtn, boost, soundBtn, talkBtn, moreBtn, energy, energyNum };
  }

  private updateHud() {
    if (!this.hud) return;
    const s = this.state;
    const now = Date.now();
    this.hud.bal.textContent = formatUGX(balanceOf(s.ledger));
    const b = s.boost && now < s.boost.until ? s.boost : null;
    this.hud.boost.hidden = !b;
    if (b) this.hud.boost.textContent = `${b.label}: +${b.pct}% pay · ${Math.ceil((b.until - now) / 60_000)} min`;
    const lv = levelForXp(s.xp);
    this.hud.lvl.textContent = `Lv ${lv}`;
    const en = energyNow(s, now), enMax = maxEnergy(s);
    this.hud.energy.style.width = `${Math.round((en / enMax) * 100)}%`;
    this.hud.energy.classList.toggle("low", en < 20);
    this.hud.energyNum.textContent = String(en);
    const span = xpForLevel(lv + 1) - xpForLevel(lv);
    (this.hud.xp as HTMLElement).style.width = `${Math.round(((s.xp - xpForLevel(lv)) / span) * 100)}%`;
    const ev = eventForTime(now);
    this.hud.eventChip.innerHTML = (ev.rain ? ICONS.rain : ICONS.sun) + "<span></span>";
    this.hud.eventChip.querySelector("span")!.textContent = ev.title;
    this.hud.eventChip.setAttribute("aria-label", `Today: ${ev.title}`);

    const hasDot = this.hud.goalsBtn.querySelector(".dot");
    const pending = !s.goals.includes("share") || !s.goals.includes("kiosk");
    if (pending && !hasDot) this.hud.goalsBtn.append(h("span", { class: "dot" }));
    if (!pending && hasDot) hasDot.remove();

    const info = this.hud.bottomInfo;
    if (s.shift) {
      const sh = SHIFTS.find((x) => x.id === s.shift!.id);
      const left = Math.max(0, Math.ceil((s.shift.endsAt - now) / 1000));
      const total = (sh?.seconds ?? 60);
      if (info.dataset.key !== `shift:${s.shift.id}`) {
        info.dataset.key = `shift:${s.shift.id}`;
        const stop = h("button", { class: "btn ghost small", type: "button" }, "Stop");
        stop.addEventListener("click", () => { this.result(Shifts.cancelShift(s)); this.sim.player.emote = undefined; this.changed(); });
        info.replaceChildren(h("div", { class: "job-card shift" },
          h("div", { class: "what" }, `🛠️ ${sh?.title ?? "Shift"}`),
          h("div", { class: "meta" }, h("span", { class: "shift-left" }), h("span", { class: "pay" }, formatUGX(sh?.pay ?? 0))),
          h("span", { class: "shift-bar" }, h("i", {})),
          h("div", { class: "row" }, stop)));
      }
      (info.querySelector(".shift-left") as HTMLElement).textContent = `${left}s left · stay at the door`;
      (info.querySelector(".shift-bar i") as HTMLElement).style.width = `${Math.round((1 - left / total) * 100)}%`;
      return;
    }
    const key = s.ride ? `ride:${s.ride.id}:${s.ride.stage}` : s.job ? `job:${s.job.id}:${s.job.stage}` : `hint:${this.hint()}`;
    if (info.dataset.key === key) return;
    info.dataset.key = key;
    info.replaceChildren();
    if (s.ride) {
      const target = St.rideTarget(s.ride);
      const go = h("button", { class: "btn small", type: "button" }, "Ride there");
      go.addEventListener("click", () => target && this.walkTo(target));
      const drop = h("button", { class: "btn ghost small", type: "button" }, "Cancel");
      drop.addEventListener("click", () => this.cancelRide());
      info.append(h("div", { class: "job-card" },
        h("div", { class: "what" }, s.ride.stage === "pickup" ? `Pick up ${s.ride.passenger}` : `Take ${s.ride.passenger} to ${target?.name}`),
        h("div", { class: "meta" }, h("span", {}, s.ride.stage === "pickup" ? `at ${target?.name}` : "on your boda"), h("span", { class: "pay" }, formatUGX(s.ride.pay))),
        h("div", { class: "row" }, go, drop)));
    } else if (s.job) {
      const target = A.jobTarget(s.job);
      const go = h("button", { class: "btn small", type: "button" }, "Walk there");
      go.addEventListener("click", () => target && this.walkTo(target));
      const drop = h("button", { class: "btn ghost small", type: "button" }, "Drop");
      drop.addEventListener("click", () => { this.result(A.dropJob(s)); this.changed(); });
      info.append(h("div", { class: "job-card" },
        h("div", { class: "steps-mini" }, h("span", { class: "on" }, "1 Pick up"), h("span", { class: s.job.stage === "dropoff" ? "on" : "" }, "2 Deliver"), h("span", {}, "3 Get paid")),
        h("div", { class: "what" }, s.job.stage === "pickup" ? `Pick up ${s.job.item}` : `Deliver ${s.job.item}`),
        h("div", { class: "meta" }, h("span", {}, s.job.stage === "pickup" ? `at ${target?.name}` : `to ${target?.name}`), h("span", { class: "pay" }, formatUGX(s.job.pay))),
        h("div", { class: "row" }, go, drop)));
    } else {
      const hint = this.hint();
      if (hint) info.append(h("div", { class: "hint" }, hint));
    }
  }

  private hint(): string {
    const s = this.state;
    const g = (id: Parameters<typeof A.complete>[1]) => s.goals.includes(id);
    const nowMs = Date.now();
    const live = this.liveEvents.find((e) => nowMs >= e.startsAt && nowMs <= e.endsAt && !e.attended);
    if (live) return `🔴 Event now: ${live.title}. Tap More, then Street news, to join.`;
    if (!g("walk")) return "Tap the street to walk. Drag to look around, pinch to zoom.";
    if (!g("delivery")) return "Tap Jobs to take your first delivery.";
    if (!g("shift") && g("delivery")) return "Tap Work: shops pay you for short shifts. Food gives you energy (⚡).";
    if (!g("rolex")) return "Hungry? Musa's rolex cart is by the taxi stage. A rolex pays you 20% more for 30 minutes.";
    if (!g("pothole")) return "See the pothole outside the pharmacy? Tap it to report it.";
    if (!g("kiosk")) return balanceOf(s.ledger) < 25_000 ? "Save UGX 25,000 to lease the kiosk across the road. Deliveries pay." : "You can afford a kiosk. Tap the TO LET board across the road.";
    if (!g("paint")) return "Tap your kiosk to paint your sign.";
    if (!g("profile")) return "Tap your Ug Tag to add your TikTok or Instagram.";
    if (!g("boda")) return "Tap Boda to ride anywhere on the street, or rent one and earn carrying passengers.";
    if (!g("snap")) return "Snap a real Kampala street with the camera button. It becomes art on the street.";
    if (!g("landmarks")) return "Tap the buildings on the hills behind the street to discover Kampala landmarks.";
    if (!g("land") && balanceOf(s.ledger) >= 3_000 && g("delivery")) return "Own a piece of Kampala: plots from UGX 3,000. Tap More, then Kampala land.";
    if (!g("build")) return "Build in your kiosk yard: chairs, string lights, a flag. Everyone sees it.";
    if (!g("share")) return "Share your Ug Tag card to WhatsApp Status.";
    return "";
  }

  // ---------- input ----------

  private bindInput() {
    const c = this.canvas;
    const pts = new Map<number, { x: number; y: number }>();
    let start: { x: number; y: number; camX: number; camY: number } | null = null;
    let moved = false;
    let pinch: { d: number; zoom: number } | null = null;
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        start = { x: e.clientX, y: e.clientY, camX: this.renderer.cam.x, camY: this.renderer.cam.y };
        moved = false;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.renderer.cam.zoom };
        moved = true;
      }
    });
    c.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        this.renderer.cam.zoom = pinch.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
        return;
      }
      if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) > 8) moved = true;
        if (moved) {
          this.follow = false;
          this.renderer.cam.x = start.camX - dx / this.renderer.cam.zoom;
          this.renderer.cam.y = start.camY - dy / this.renderer.cam.zoom;
        }
      }
    });
    const end = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 0) {
        if (!moved && start) this.handleTap(e.clientX, e.clientY);
        start = null;
      }
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", (e) => { pts.delete(e.pointerId); pinch = null; start = null; });
    c.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.renderer.cam.zoom *= Math.exp(-e.deltaY * 0.0015);
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (this.sheet || (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") {
        if (e.key === "Escape" && this.sheet?.spec.closable !== false) this.closeSheet();
        return;
      }
      const p = this.sim.player;
      const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const d = dirs[e.key];
      if (d && !p.path.length) {
        const tx = Math.floor(p.x) + d[0], ty = Math.floor(p.y) + d[1];
        if (isWalkable(tx, ty)) this.walkTo({ x: tx, y: ty });
      }
    });
  }

  /** Long walk? Offer a boda with one tap. */
  private offerBoda(tile: { x: number; y: number }, name: string, onArrive?: () => void) {
    const s = this.state;
    const p = this.sim.player;
    if (p.vehicle || s.ride) return;
    const d = tileDistance({ x: Math.floor(p.x), y: Math.floor(p.y) }, tile);
    const fare = bodaFare(d);
    if (d < 14 || balanceOf(s.ledger) < fare) return;
    this.actionToast(`Long walk. Boda ${name === "there" ? "there" : `to ${name}`}?`, `Boda · UGX ${fare.toLocaleString()}`, () => {
      track("boda_offer_taken");
      this.rideTo(tile, name === "there" ? "your spot" : name, onArrive);
    });
  }

  /** A toast with one button, for quick offers. */
  private actionToast(msg: string, label: string, fn: () => void) {
    const root = document.getElementById("toast-root")!;
    root.querySelectorAll(".toast.action").forEach((t) => t.remove());
    const b = h("button", { class: "btn small", type: "button" }, label);
    const t = h("div", { class: "toast action", role: "status" }, h("span", {}, msg), b);
    b.addEventListener("click", () => {
      t.remove();
      fn();
    });
    root.append(t);
    setTimeout(() => t.remove(), 5000);
  }

  private handleTap(x: number, y: number) {
    if (!this.state.onboarded || this.landing) return;
    const pick = this.renderer.pick(x, y, this.sim);
    switch (pick.type) {
      case "billboard":
        this.openSheet(billboardSheet(this, pick.slot));
        return;
      case "bubble":
        if (pick.voiceId) this.playVoice(pick.voiceId);
        else if (pick.walkerId === "player") this.openSheet(talkSheet(this));
        else this.openProfile(pick.walkerId);
        return;
      case "player":
        this.openSheet(S.tagSheet(this, false));
        return;
      case "resident":
        this.openSheet(S.residentSheet(this, pick.id));
        return;
      case "visitor": {
        const v = this.visitors.find((x) => x.id === pick.id);
        if (v) this.openSheet(S.visitorSheet(this, v));
        return;
      }
      case "vendor": {
        const v = VENDORS.find((x) => x.id === pick.id);
        if (v) {
          this.walkTo(v.stand);
          this.openSheet(vendorSheet(this, v.id));
        }
        return;
      }
      case "bodaStage":
        this.openSheet(bodaSheet(this, St.hasBoda(this.state, Date.now()) ? "work" : "ride"));
        return;
      case "landmark":
        this.showLandmark(pick.id);
        return;
      case "board":
        this.walkTo({ x: 25, y: 11 });
        this.openSheet(albumSheet(this));
        return;
      case "plot": {
        const plot = PLOTS.find((p) => p.id === pick.plotId)!;
        this.walkTo({ x: plot.x + 1, y: plot.y - 1 });
        this.openSheet(S.kioskSheet(this, pick.plotId));
        return;
      }
      case "pothole":
        this.walkTo({ x: POTHOLE.x, y: POTHOLE.y - 3 });
        this.openSheet(S.civicSheet(this));
        return;
      case "building": {
        const b = pick.building;
        this.renderer.tap(x, y);
        const job = this.state.job;
        const isStop = job && A.jobTarget(job)?.id === b.id;
        this.walkTo(b.door, () => {
          if (!isStop) this.openSheet(S.buildingSheet(this, b));
        });
        this.offerBoda(b.door, b.name, () => { if (!isStop) this.openSheet(S.buildingSheet(this, b)); });
        return;
      }
      case "ground":
        this.renderer.tap(x, y);
        this.walkTo({ x: pick.x, y: pick.y });
        this.offerBoda({ x: pick.x, y: pick.y }, "there");
        return;
    }
  }
}
