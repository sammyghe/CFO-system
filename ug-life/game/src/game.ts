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
import { kampalaHour } from "./game/time";
import { h, ICONS } from "./ui/dom";
import * as S from "./ui/sheets";
import { drainEventNames, track } from "./track";
import { Api, type Visitor } from "./net/api";
import { listSnaps, saveSnap, type SnapRecord } from "./snaps/store";
import { albumSheet } from "./snaps/ui";

const BILLBOARD = "UG LIFE · YOUR STREET, YOUR STORY";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
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
  private net = { sync: 0, street: 0, track: 0, uploads: 0 };
  private visitors: Visitor[] = [];
  private billboard: { img: CanvasImageSource | null; key: string } = { img: null, key: "" };
  private online = false;

  constructor(private canvas: HTMLCanvasElement) {
    const now = Date.now();
    this.state = this.backend.load() ?? newPlayer(now, newPlayerId());
    this.renderer = new Renderer(canvas);
    this.sim = new Sim(this.state.look, this.state.pos);
    this.sim.player.look = this.state.look;
    const p = toScreen(this.sim.player.x, this.sim.player.y);
    this.renderer.cam = { x: p.sx, y: p.sy - 40, zoom: this.renderer.defaultZoom() };
    this.buildHud();
    this.bindInput();
    window.addEventListener("resize", () => this.renderer.resize());
    document.addEventListener("visibilitychange", () => {
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
    if (env) return env;
    if (location.protocol.startsWith("http") && !location.hostname.includes("claude")) return location.origin + location.pathname.replace(/index\.html$/, "");
    return "Ug Life (link coming at launch)";
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
    this.nextCustomerAt = performance.now() + 12000;
    track("session_start", { days: this.state.stats.daysVisited });
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
    this.online = true;
    await this.syncNow();
    void this.refreshVisitors();
    void this.uploadQueued();
  }

  private async syncNow() {
    if (!this.online || this.syncing || !this.state.onboarded) return;
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

  private async refreshVisitors() {
    if (!this.online) return;
    const list = await this.api.street();
    this.visitors = list.filter((v) => v.id !== this.api.playerId);
    this.sim.setVisitors(this.visitors, this.state.blocked);
  }

  private async uploadQueued() {
    if (!this.online) return;
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
    const community = this.online ? await this.api.photos() : null;
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
    if (!this.online) return;
    if (this.unsynced && t > this.net.sync) {
      this.net.sync = t + 45_000;
      void this.syncNow();
    }
    if (t > this.net.street) {
      this.net.street = t + 30_000;
      void this.refreshVisitors();
    }
    if (t > this.net.track) {
      this.net.track = t + 60_000;
      void this.api.track(drainEventNames());
    }
    if (t > this.net.uploads) {
      this.net.uploads = t + 120_000;
      void this.uploadQueued();
      void this.refreshBillboard();
    }
  }

  private onPlayerArrive() {
    const p = this.sim.player;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.walkedTiles >= 5 && A.complete(this.state, "walk")) this.toast("Goal done: walk down the street", "ok");
    for (const place of PLACES) {
      if (Math.abs(place.x - tx) <= 1 && Math.abs(place.y - ty) <= 1) {
        const r = A.arriveAt(this.state, place.id, Date.now());
        if (r) {
          this.result(r);
          if (r.ok && !this.state.job) {
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
    this.netTick(t);

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
      else kiosks[p.id] = null;
    }
    const target = s.job ? A.jobTarget(s.job) : null;
    return {
      night,
      dusk,
      // "Rainy afternoon" rains 1-6pm, "Morning drizzle" until 11am
      rain: ev.rain && !night && (!s.settings.liveTime || (ev.id === "rain" ? hour >= 13 && hour < 18 : hour < 11)),
      kiosks,
      civic: s.civic,
      marker: target ? { x: target.x, y: target.y } : null,
      markerLabel: s.job ? (s.job.stage === "pickup" ? "Pick up" : "Drop off") : "",
      playerTag: s.tag.ghost ? null : { name: s.tag.name || "You", level: levelForXp(s.xp), status: s.tag.status, socials: s.tag.socials.map((x) => x.platform), mine: true },
      playerCarrying: s.job?.stage === "dropoff",
      hiddenTags: s.blocked,
      reducedMotion: s.settings.reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      billboard: BILLBOARD,
      billboardImage: this.billboard.img,
      billboardKey: this.billboard.key,
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
    const wallet = h("div", { class: "wallet" }, bal, h("div", { class: "lv" }, lvl, h("span", { class: "xpbar" }, xp)), h("div", { class: "sim" }, "Simulated UGX · no real value"));
    const goalsBtn = btn(ICONS.goals, "Street goals", () => this.openSheet(S.goalsSheet(this)));
    const side = h("div", { class: "hud-side" },
      btn(ICONS.tag, "Your Ug Tag", () => this.openSheet(S.tagSheet(this, false))),
      goalsBtn,
      btn(ICONS.camera, "Street Snaps", () => this.openSheet(albumSheet(this))),
      btn(ICONS.share, "Share your card", () => this.openSheet(S.shareSheet(this))),
      btn(ICONS.help, "Help", () => this.openSheet(S.helpSheet(this))),
      btn(ICONS.locate, "Find me", () => { this.follow = true; }));
    const jobs = h("button", { class: "big-btn", type: "button", html: ICONS.jobs + "<span>Jobs</span>" });
    jobs.addEventListener("click", () => this.openSheet(S.jobsSheet(this)));
    const bottomInfo = h("div", { style: "flex:1;min-width:0;display:flex" });
    hud.append(h("div", { class: "hud-top" }, wallet, eventChip), side, h("div", { class: "hud-bottom" }, bottomInfo, jobs));
    this.hud = { bal, lvl, xp, eventChip, bottomInfo, goalsBtn };
  }

  private updateHud() {
    if (!this.hud) return;
    const s = this.state;
    const now = Date.now();
    this.hud.bal.textContent = formatUGX(balanceOf(s.ledger));
    const lv = levelForXp(s.xp);
    this.hud.lvl.textContent = `Lv ${lv}`;
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
    const key = s.job ? `job:${s.job.id}:${s.job.stage}` : `hint:${this.hint()}`;
    if (info.dataset.key === key) return;
    info.dataset.key = key;
    info.replaceChildren();
    if (s.job) {
      const target = A.jobTarget(s.job);
      const go = h("button", { class: "btn small", type: "button" }, "Walk there");
      go.addEventListener("click", () => target && this.walkTo(target));
      const drop = h("button", { class: "btn ghost small", type: "button" }, "Drop");
      drop.addEventListener("click", () => { this.result(A.dropJob(s)); this.changed(); });
      info.append(h("div", { class: "job-card" },
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
    if (!g("walk")) return "Tap the street to walk. Drag to look around, pinch to zoom.";
    if (!g("delivery")) return "Tap Jobs to take your first delivery.";
    if (!g("pothole")) return "See the pothole outside the pharmacy? Tap it to report it.";
    if (!g("kiosk")) return balanceOf(s.ledger) < 25_000 ? "Save UGX 25,000 to lease the kiosk across the road. Deliveries pay." : "You can afford a kiosk. Tap the TO LET board across the road.";
    if (!g("paint")) return "Tap your kiosk to paint your sign.";
    if (!g("profile")) return "Tap your Ug Tag to add your TikTok or Instagram.";
    if (!g("snap")) return "Snap a real Kampala street with the camera button. It becomes art on the street.";
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

  private handleTap(x: number, y: number) {
    if (!this.state.onboarded || this.landing) return;
    const pick = this.renderer.pick(x, y, this.sim);
    switch (pick.type) {
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
        return;
      }
      case "ground":
        this.renderer.tap(x, y);
        this.walkTo({ x: pick.x, y: pick.y });
        return;
    }
  }
}
