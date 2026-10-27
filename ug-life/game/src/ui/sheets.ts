// The panels that slide up from the bottom. Player-entered text is always set
// with textContent (via h()), never as HTML.

import { h } from "./dom";
import * as A from "../game/actions";
import { balanceOf } from "../game/ledger";
import { KIOSK_LEASE_PRICE, PRODUCTS, SIGN_COLORS, UPGRADES, formatUGX, kioskDailyIncome, levelForXp } from "../game/economy";
import { eventForTime } from "../game/daily";
import { OFFICE_NAME, secondsToNextStage, type IssueStatus } from "../game/civic";
import { PLATFORMS, checkDisplayName, checkFreeText, profileUrl, type Platform } from "../game/moderation";
import { GOALS, type Look, type PlayerState } from "../game/state";
import { AREA, PLOTS, placeById, type Building } from "../world/map";
import { RESIDENTS } from "../content/residents";
import { FAQ } from "../content/faq";
import { drawPerson } from "../world/art";
import { renderShareCard } from "./sharecard";
import { DAY_MS } from "../game/time";
import type { Api, SharedPlot, Visitor } from "../net/api";
import { snackMenu, yardSheet } from "./streetsheets";
import { billboardSheet } from "./billboardsheet";
import * as Needs from "../game/needs";
import * as People from "../game/people";
import { homeAt } from "../game/needs";
import * as St from "../game/street";
import type { SnapRecord } from "../snaps/store";
import type { Destination } from "./gosheet";
import type { BillboardAd } from "../content/billboards";
import type { LiveEvent, Proposal } from "../content/community";
import { shiftFor, shiftsToday } from "../game/shifts";
import { levelForXp as lvFor } from "../game/economy";
import { SHIFTS_PER_DAY } from "../content/catalog";
import type { TalkEntry } from "./talksheet";
import { talkSheet } from "./talksheet";
import { bodaFare } from "../content/catalog";
import { tileDistance } from "../world/path";

export interface GameApi {
  state: PlayerState;
  now(): number;
  changed(): void;
  toast(msg: string, kind?: "ok" | "bad" | "info"): void;
  result(r: A.Result): boolean;
  openSheet(s: SheetSpec): void;
  closeSheet(): void;
  walkTo(tile: { x: number; y: number }, onArrive?: () => void): void;
  joinUrl(): string;
  finishOnboarding(): void;
  resetSave(): void;
  installPrompt(): (() => void) | null;
  track(name: string, props?: Record<string, unknown>): void;
  residentReported(): void;
  api: Api;
  /** A snap was saved or deleted on this phone. */
  onSnap(rec: SnapRecord | null): void;
  /** Replace the whole save (restore on a new phone). */
  adoptSave(save: PlayerState, message: string): void;
  /** Who holds a kiosk plot on the shared street (server), if known. */
  sharedPlot(plotId: string): SharedPlot | null;
  /** Claims the plot on the server, then pays the lease. renew = extend your own. */
  leasePlot(plotId: string, renew?: boolean): Promise<boolean>;
  /** Pays the fare and rides a boda to a place. */
  takeBoda(placeId: string): void;
  /** Get on or off your own rented boda. */
  setRiding(on: boolean): void;
  riding(): boolean;
  /** Accepts a passenger and heads to them. */
  startRide(offerId: string): void;
  cancelRide(): void;
  /** Shows a landmark, paying the first-visit reward. */
  showLandmark(id: string): void;
  /** Walk (or ride a boda) to a place and open its panel on arrival. */
  goTo(d: Destination, boda: boolean): void;
  /** Connected to the server right now. */
  online(): boolean;
  /** Street talk: say a phrase, a short text or an emote. */
  say(kind: "phrase" | "text" | "emote", body: string, to?: string): void;
  sendVoice(blob: Blob, ms: number): Promise<void>;
  playVoice(voiceId: string): void;
  reportTalk(e: TalkEntry): void;
  talkLog(): TalkEntry[];
  /** Listen for new talk; returns a function that stops listening. */
  onTalk(fn: () => void): () => void;
  /** Open the card of whoever has this id (resident or player). */
  openProfile(id: string): void;
  /** Say hi to a resident: they answer out loud. */
  greetResident(id: string): void;
  /** Plays a sound effect. */
  sfx(name: "tap" | "coin" | "pop" | "send" | "horn" | "hoot" | "kick" | "sizzle" | "ok" | "bad" | "whoosh"): void;
  /** Asks the server for a plot of land in an area, then pays for it. */
  buyLand(area: string): Promise<boolean>;
  openSnaps(): void;
  topUpEnabled(): boolean;
  cryptoEnabled(): boolean;
  creditTopUp(ref: string, credit: number): void;
  openTopUp(): void;
  /** Starts a mobile money payment and sends the player to the checkout page. */
  startTopUp(pack: string): Promise<void>;
  /** Billboard ads currently up (players' and brands'). */
  billboards(): BillboardAd[];
  rentBillboard(slot: string, o: { text: string; sub: string; color: string; days: number }): Promise<boolean>;
  markNewsRead(at: number): void;
  attendEvent(e: LiveEvent): Promise<boolean>;
  /** Share a link to the game (with ?at=, ?event=…) via the phone's share sheet. */
  shareLink(title: string, params: Record<string, string>): void;
  /** Walk to the community board and hold up a placard for an idea. */
  rally(p: Proposal): void;
  startShift(shiftId: string): void;
  /** Travel to another Kampala area. */
  travel(area: string, mode: "matatu" | "boda" | "walk"): void;
  /** Players online per area (from the server). */
  areaCounts(): Record<string, number>;
  /** Saves to the server now (before actions the server checks, like standing for election). */
  saveNow(): Promise<void>;
  /** Unread private messages and friend requests. */
  social(): { dm: number; requests: number };
  /** Your character dances for a few seconds. */
  dance(): void;
  /** Apply sound settings after they change. */
  applySettings(): void;
}

export interface SheetSpec {
  kind: string;
  eyebrow?: string;
  title: string;
  body: () => HTMLElement;
  closable?: boolean;
  /** Rebuild the body every second while open (for countdowns). */
  live?: boolean;
  onClose?: () => void;
}

const SKINS = ["#f1c7a5", "#c68a62", "#a86b45", "#8d5a3b", "#6b4228", "#4e3020"];
const SHIRTS = ["#1f4fd1", "#b4442a", "#2f7a4b", "#f2d23c", "#7a2fa8", "#13202b", "#f4efe4", "#e0457b"];
const HAIRS: { id: Look["hair"]; label: string }[] = [
  { id: "short", label: "Short" }, { id: "bun", label: "Bun" }, { id: "braids", label: "Braids" }, { id: "cap", label: "Cap" },
];

function avatarCanvas(look: Look, size = 72): HTMLCanvasElement {
  const c = h("canvas", { class: "avatar", width: size * 2, height: size * 2, "aria-hidden": "true" });
  const g = c.getContext("2d");
  if (g) {
    g.scale(2, 2);
    g.fillStyle = "#b4442a";
    g.beginPath(); g.ellipse(size / 2, size - 10, size * 0.3, 6, 0, 0, Math.PI * 2); g.fill();
    drawPerson(g, size / 2, size - 10, look, 0, false, false, size / 52);
  }
  return c;
}

function field(label: string, input: HTMLElement, err?: HTMLElement) {
  return h("div", { class: "field" }, h("label", { for: input.id }, label), input, err ?? null);
}

function swatchRow(colors: readonly string[], current: string, onPick: (c: string) => void, label: string) {
  const row = h("div", { class: "swatches", role: "group", "aria-label": label });
  for (const c of colors) {
    const b = h("button", { class: "swatch", type: "button", style: `background:${c}`, "aria-label": c, "aria-pressed": String(c === current) });
    b.addEventListener("click", () => {
      row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onPick(c);
    });
    row.append(b);
  }
  return row;
}

function chipRow<T extends string>(items: { id: T; label: string }[], current: T, onPick: (v: T) => void, label: string) {
  const row = h("div", { class: "chips", role: "group", "aria-label": label });
  for (const it of items) {
    const b = h("button", { class: "chip", type: "button", "aria-pressed": String(it.id === current) }, it.label);
    b.addEventListener("click", () => {
      row.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onPick(it.id);
    });
    row.append(b);
  }
  return row;
}

// ---------- Ug Tag ----------

export function tagSheet(G: GameApi, onboarding: boolean): SheetSpec {
  return {
    kind: "tag",
    eyebrow: onboarding ? "Step 2 of 2" : "Your Ug Tag",
    title: onboarding ? "Make your Ug Tag" : "Edit your Ug Tag",
    closable: !onboarding,
    body: () => {
      const s = G.state;
      const look = { ...s.look };
      const preview = h("div", { class: "profile-head" }, avatarCanvas(look), h("div", {}, h("p", { class: "muted small" }, "This is how you look on the street. Other players see your tag above your head.")));
      const redraw = () => preview.replaceChild(avatarCanvas(look), preview.firstChild!);
      const name = h("input", { id: "tag-name", maxlength: "20", autocomplete: "nickname", value: s.tag.name, placeholder: "e.g. Sammy" });
      const nameErr = h("div", { class: "err", role: "alert" });
      const status = h("input", { id: "tag-status", maxlength: "60", value: s.tag.status, placeholder: "e.g. Designer · open for gigs" });
      const statusErr = h("div", { class: "err", role: "alert" });
      const save = h("button", { class: "btn block", type: "button" }, onboarding ? "Enter the street" : "Save tag");
      save.addEventListener("click", () => {
        nameErr.textContent = "";
        statusErr.textContent = "";
        const n = checkDisplayName(name.value);
        if (!n.ok) { nameErr.textContent = n.reason; return; }
        const st = checkFreeText(status.value, 60);
        if (!st.ok) { statusErr.textContent = st.reason; return; }
        if (!G.result(A.setTag(s, name.value, status.value))) return;
        s.look = look;
        G.changed();
        if (onboarding) {
          G.closeSheet();
          G.finishOnboarding();
        } else G.toast("Ug Tag saved", "ok");
      });

      const parts: HTMLElement[] = [
        preview,
        field("Display name", name, nameErr),
        field("Status (optional)", status, statusErr),
        h("div", { class: "field" }, h("label", {}, "Skin tone"), swatchRow(SKINS, look.skin, (c) => { look.skin = c; redraw(); }, "Skin tone")),
        h("div", { class: "field" }, h("label", {}, "Shirt"), swatchRow(SHIRTS, look.shirt, (c) => { look.shirt = c; redraw(); }, "Shirt colour")),
        h("div", { class: "field" }, h("label", {}, "Hair"), chipRow(HAIRS, look.hair, (v) => { look.hair = v; redraw(); }, "Hair")),
      ];
      if (!onboarding) parts.push(socialsBlock(G), ghostToggle(G));
      parts.push(save);
      if (!onboarding) {
        const share = h("button", { class: "btn ghost block", type: "button" }, "Share my card");
        share.addEventListener("click", () => G.openSheet(shareSheet(G)));
        parts.push(share);
      }
      return h("div", { class: "sheet-body" }, parts);
    },
  };
}

function socialsBlock(G: GameApi): HTMLElement {
  const s = G.state;
  const wrap = h("div", { class: "field" }, h("label", {}, `Socials (${s.tag.socials.length}/3)`));
  for (const soc of s.tag.socials) {
    const p = PLATFORMS.find((x) => x.id === soc.platform)!;
    const rm = h("button", { class: "btn danger small", type: "button" }, "Remove");
    rm.addEventListener("click", () => { A.removeSocial(s, soc.platform); G.changed(); G.openSheet(tagSheet(G, false)); });
    wrap.append(h("div", { class: "social-row" },
      h("span", {}, h("b", {}, p.label), " ", h("a", { href: profileUrl(soc.platform, soc.handle), target: "_blank", rel: "noopener noreferrer" }, "@" + soc.handle), " ", h("span", { class: "badge grey" }, soc.verified ? "verified" : "unverified")),
      rm));
  }
  if (s.tag.socials.length < 3) {
    const free = PLATFORMS.filter((p) => !s.tag.socials.some((x) => x.platform === p.id));
    const sel = h("select", { id: "soc-platform", "aria-label": "Platform" }, free.map((p) => h("option", { value: p.id }, p.label)));
    const handle = h("input", { id: "soc-handle", placeholder: "@yourhandle", autocapitalize: "off", autocomplete: "off" });
    const err = h("div", { class: "err", role: "alert" });
    const add = h("button", { class: "btn small", type: "button" }, "Add");
    add.addEventListener("click", () => {
      const r = A.addSocial(s, sel.value as Platform, handle.value);
      if (!r.ok) { err.textContent = r.message; return; }
      G.changed();
      G.toast(r.message, "ok");
      G.openSheet(tagSheet(G, false));
    });
    wrap.append(h("div", { style: "display:grid;grid-template-columns:auto 1fr auto;gap:8px" }, sel, handle, add), err);
  }
  wrap.append(h("p", { class: "muted small" }, "Verification by signing in to each platform comes with online accounts. Until then every social shows as unverified."));
  return wrap;
}

function ghostToggle(G: GameApi): HTMLElement {
  const s = G.state;
  const cb = h("input", { type: "checkbox", id: "ghost", checked: s.tag.ghost });
  cb.addEventListener("change", () => { s.tag.ghost = cb.checked; G.changed(); G.toast(cb.checked ? "Ghost mode on. Your tag is hidden." : "Ghost mode off", "info"); });
  return h("label", { class: "toggle", for: "ghost" }, h("span", {}, h("b", {}, "Ghost mode"), h("small", {}, "Hide your tag and socials from everyone.")), cb);
}

// ---------- Jobs ----------

export function jobsSheet(G: GameApi): SheetSpec {
  return {
    kind: "jobs",
    eyebrow: "Delivery board",
    title: "Pick a delivery",
    body: () => {
      const s = G.state;
      const now = G.now();
      const left = A.jobsLeftToday(s, now);
      const ev = eventForTime(now);
      const body = h("div", { class: "sheet-body" });
      if (ev.jobBonus > 1) body.append(h("div", { class: "notice ok" }, `${ev.title}: deliveries pay ${Math.round((ev.jobBonus - 1) * 100)}% more today.`));
      if (s.job) {
        const target = A.jobTarget(s.job);
        body.append(h("div", { class: "notice" }, `You're carrying a delivery. Next stop: ${target?.name}.`));
        const drop = h("button", { class: "btn danger block", type: "button" }, "Drop this delivery");
        drop.addEventListener("click", () => { G.result(A.dropJob(s)); G.changed(); G.closeSheet(); });
        body.append(drop);
        return body;
      }
      if (left <= 0) {
        body.append(h("div", { class: "notice warn" }, "That's 10 deliveries today. The board refreshes at midnight Kampala time."));
        return body;
      }
      body.append(h("p", { class: "muted small" }, `${left} of 10 deliveries left today. Pay is in simulated UGX.`));
      const list = h("div", { class: "list" });
      for (const o of A.jobOffers(s, now)) {
        const from = placeById(o.fromId), to = placeById(o.toId);
        const go = h("button", { class: "btn small", type: "button" }, "Take it");
        go.addEventListener("click", () => {
          if (G.result(A.acceptJob(s, o.id, now))) {
            G.track("job_accepted", { pay: o.pay });
            G.changed();
            G.closeSheet();
            if (from) G.walkTo(from);
          }
        });
        list.append(h("div", { class: "offer" },
          h("div", { class: "muted small" }, `Carry ${o.item}`),
          h("div", { class: "route" }, from?.name ?? "", h("i", {}, "→"), to?.name ?? ""),
          h("div", { class: "bottom" }, h("span", { class: "pay" }, formatUGX(o.pay)), h("span", { class: "muted small" }, `about ${Math.max(1, Math.round(o.distance / 3))} min walk`), go)));
      }
      body.append(list);
      return body;
    },
  };
}

// ---------- Residents ----------

export function residentSheet(G: GameApi, id: string): SheetSpec {
  const r = RESIDENTS.find((x) => x.id === id)!;
  return {
    kind: "resident",
    eyebrow: "Street resident",
    title: r.name,
    body: () => {
      const s = G.state;
      const blocked = s.blocked.includes(id);
      const socials = r.socials.length
        ? h("div", { class: "field" }, h("label", {}, "Socials"), r.socials.map((so) => h("div", { class: "social-row" }, h("span", {}, h("b", {}, PLATFORMS.find((p) => p.id === so.platform)?.label ?? ""), " @" + so.handle), h("span", { class: "badge grey" }, "fictional"))))
        : null;
      const report = h("button", { class: "btn ghost small", type: "button" }, "Report");
      report.addEventListener("click", () => G.openSheet(helpSheet(G, `Report about ${r.name}: `)));
      const block = h("button", { class: "btn danger small", type: "button" }, blocked ? "Unblock" : "Block");
      block.addEventListener("click", () => {
        s.blocked = blocked ? s.blocked.filter((x) => x !== id) : [...s.blocked, id];
        G.changed();
        G.toast(blocked ? `${r.name} unblocked` : `${r.name} blocked. You won't see their tag.`, "info");
        G.closeSheet();
      });
      const hi = h("button", { class: "btn", type: "button" }, "👋 Say hi");
      hi.addEventListener("click", () => {
        G.greetResident(id);
        G.closeSheet();
      });
      const talk = h("button", { class: "btn ghost", type: "button" }, "Talk");
      talk.addEventListener("click", () => G.openSheet(talkSheet(G)));
      // friendship: greet daily, treat them, ask them out when you're close
      const pts = People.friendship(s, id);
      const treat = h("button", { class: "btn ghost", type: "button" }, `🥙 Treat · UGX ${People.GIFT_COST.toLocaleString()}`);
      treat.addEventListener("click", () => {
        if (G.result(People.giveGift(s, id, r.name, G.now()))) { G.track("gift"); G.sfx("coin"); G.changed(); G.openSheet(residentSheet(G, id)); }
      });
      const dating = s.partner === id;
      const date = h("button", { class: "btn", type: "button", disabled: pts < 50 }, dating ? `💞 Date night · UGX ${People.DATE_COST.toLocaleString()}` : pts < 50 ? "💞 Ask out (be close friends first)" : `💞 Ask ${r.name} out · UGX ${People.DATE_COST.toLocaleString()}`);
      date.addEventListener("click", () => {
        if (G.result(People.goOnDate(s, id, r.name, G.now()))) { G.track("date"); G.dance(); G.sfx("ok"); G.changed(); G.openSheet(residentSheet(G, id)); }
      });
      const part = h("button", { class: "btn ghost small", type: "button" }, "Part ways");
      part.addEventListener("click", () => { G.result(People.breakUp(s)); G.changed(); G.openSheet(residentSheet(G, id)); });
      return h("div", { class: "sheet-body" },
        h("div", { class: "profile-head" }, avatarCanvas(r.look), h("div", { style: "display:grid;gap:6px" }, h("div", {}, h("span", { class: "badge" }, `Level ${r.level}`)), h("b", {}, r.role))),
        h("div", { class: "row-btns" }, hi, talk),
        h("div", { class: "friend-meter" }, h("div", { class: "need-top" }, h("b", {}, dating ? `💞 Dating ${r.name}` : People.friendshipLabel(pts)), h("span", { class: "muted small" }, `${pts}/100`)),
          h("span", { class: "energy-bar" }, h("i", { style: `width:${pts}%;background:#e0457b` })),
          h("span", { class: "muted small" }, "Say hi every day (+5), treat them (+12). Close friends (50) can go on dates.")),
        h("div", { class: "row-btns" }, treat, date),
        dating ? part : null,
        h("p", {}, r.bio),
        socials,
        h("p", { class: "muted small" }, "Street residents are characters in the game, not real people. Real players get the same card with their own work and socials."),
        h("div", { class: "row-btns" }, report, block));
    },
  };
}

// ---------- Buildings ----------

export function buildingSheet(G: GameApi, b: Building): SheetSpec {
  return {
    kind: "building",
    eyebrow: b.kind,
    title: b.name,
    body: () => {
      const job = G.state.job;
      const relevant = job && (job.fromId === b.id || job.toId === b.id);
      const owner = RESIDENTS.find((r) => (r.area ?? "wandegeya") === AREA.id && r.start.x === b.door.x && r.start.y === b.door.y);
      const s = G.state;
      const from = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
      const dist = tileDistance(from, b.door);
      const actions = h("div", { class: "row-btns" });
      if (dist >= 3) {
        const fare = bodaFare(dist);
        const boda = h("button", { class: "btn", type: "button" }, `Boda here · UGX ${fare.toLocaleString()}`);
        boda.addEventListener("click", () => G.goTo({ id: b.id, name: b.name, group: "Shops & places", detail: b.kind, tile: b.door }, true));
        const walk = h("button", { class: "btn ghost", type: "button" }, "Walk here");
        walk.addEventListener("click", () => { G.walkTo(b.door); G.closeSheet(); });
        actions.append(boda, walk);
      }
      const share = h("button", { class: "btn ghost", type: "button" }, "Share");
      share.addEventListener("click", () => G.shareLink(`Meet me at ${b.name} on Ug Life`, { at: b.id }));
      actions.append(share);
      const jobs = h("button", { class: "btn ghost", type: "button" }, "Jobs");
      jobs.addEventListener("click", () => G.openSheet(jobsSheet(G)));
      actions.append(jobs);
      if (owner) {
        const hi = h("button", { class: "btn ghost", type: "button" }, `👋 Greet ${owner.name}`);
        hi.addEventListener("click", () => { G.greetResident(owner.id); G.closeSheet(); });
        actions.append(hi);
      }
      const sh = shiftFor(b.id);
      let shiftBox: HTMLElement | null = null;
      if (sh) {
        const atDoor = dist <= 2;
        const lvOk = lvFor(s.xp) >= sh.minLevel;
        const left = SHIFTS_PER_DAY - shiftsToday(s, G.now());
        const start = h("button", { class: "btn small", type: "button", disabled: !lvOk || left <= 0 || !!s.shift }, !lvOk ? `Needs level ${sh.minLevel}` : atDoor ? "Start shift" : "Walk to the door");
        start.addEventListener("click", () => {
          if (!atDoor) { G.walkTo(b.door, () => G.openSheet(buildingSheet(G, b))); G.closeSheet(); return; }
          G.startShift(sh.id);
        });
        shiftBox = h("div", { class: "work-card" }, h("div", { class: "work-head" }, h("span", { class: "work-ico" }, "🛠️"), h("div", {}, h("b", {}, "Work a shift here"), h("span", { class: "muted small" }, `${sh.title} · UGX ${sh.pay.toLocaleString()} · ⚡${sh.energy} · ${sh.seconds}s`)), start),
          h("span", { class: "muted small" }, s.shift ? "You're already on a shift." : `${left} shifts left today. Stay at the door until the timer ends.`));
      }
      let roof: HTMLElement | null = null;
      if (b.id === "pharmacy") {
        roof = h("button", { class: "btn ghost", type: "button" }, "🪧 Rent the rooftop billboard");
        roof.addEventListener("click", () => G.openSheet(billboardSheet(G, "pharmacy")));
      }
      // a room to rent, a shower, a night out
      const life = h("div", { class: "row-btns" });
      const now = G.now();
      const home = homeAt(b.id);
      const mine = home && s.home && s.home.building === b.id && s.home.until > now;
      const act = (label: string, fn: () => A.Result, cls = "btn") => {
        const btn = h("button", { class: cls, type: "button" }, label);
        btn.addEventListener("click", () => {
          if (dist > 2) { G.walkTo(b.door, () => G.openSheet(buildingSheet(G, b))); G.closeSheet(); return; }
          if (G.result(fn())) { G.sfx("ok"); G.changed(); G.openSheet(buildingSheet(G, b)); }
        });
        life.append(btn);
      };
      if (home) {
        if (mine) {
          act("😴 Sleep (full energy)", () => Needs.sleepAtHome(s, b.id, G.now()));
          act("🚿 Shower", () => Needs.shower(s, b.id, G.now()), "btn ghost");
          act(`Pay another week · UGX ${home.pricePerWeek.toLocaleString()}`, () => Needs.rentHome(s, b.id, G.now()), "btn ghost");
        } else act(`🏠 Rent: ${home.name} · UGX ${home.pricePerWeek.toLocaleString()}/week`, () => Needs.rentHome(s, b.id, G.now()));
      }
      if (Needs.WASHROOMS[b.id] && !mine) act(`🚿 Shower · UGX ${Needs.WASHROOMS[b.id]}`, () => Needs.shower(s, b.id, G.now()));
      const venue = Needs.VENUES[b.id];
      if (venue) act(`🎉 ${venue.label}${venue.fee ? ` · UGX ${venue.fee.toLocaleString()}` : ""}`, () => {
        const r = Needs.enjoyVenue(s, b.id, G.now());
        if (r.ok) G.dance();
        return r;
      });
      return h("div", { class: "sheet-body" },
        actions,
        life.childElementCount ? life : null,
        life.childElementCount && dist > 2 ? h("p", { class: "muted small" }, "Tap a button to walk to the door first.") : null,
        shiftBox,
        roof,
        b.id === "chapati" ? snackMenu(G, "chapati") : null,
        b.id === "pharmacy" ? h("div", { class: "notice" }, "The billboard on this roof shows the featured Street Snap. Snap your street and it could be next.") : null,
        relevant ? h("div", { class: "notice ok" }, job!.stage === "pickup" && job!.fromId === b.id ? "Your pickup is here. Walk to the door." : "Your drop-off is here. Walk to the door.") : null,
        owner ? h("p", {}, `${owner.name} works here. ${owner.role}.`) : null,
        h("p", { class: "muted small" }, "Deliveries start and end at this door. Tap Jobs to see who needs something carried here."),
      );
    },
  };
}

// ---------- Kiosk ----------

export function kioskSheet(G: GameApi, plotId: string): SheetSpec {
  const plot = PLOTS.find((p) => p.id === plotId)!;
  return {
    kind: "kiosk",
    eyebrow: "Kiosk plot",
    title: plot.npcOwner ? plot.npcOwner.sign : G.state.kiosk?.plotId === plotId ? G.state.kiosk.name : "Kiosk to let",
    body: () => {
      const s = G.state;
      const now = G.now();
      const body = h("div", { class: "sheet-body" });
      if (plot.npcOwner) {
        body.append(h("p", {}, `${plot.npcOwner.name} leases this kiosk and sells ${plot.npcOwner.product.toLowerCase()}.`), h("p", { class: "muted small" }, "When a kiosk lease ends, the plot goes back on the market."));
        return body;
      }
      const mine = s.kiosk && s.kiosk.plotId === plotId ? s.kiosk : null;
      const shared = G.sharedPlot(plotId);
      if (!mine && shared && shared.playerId !== G.api.playerId) {
        body.append(
          h("p", {}, `${shared.owner || "Another player"} runs this kiosk${shared.kiosk ? `: ${shared.kiosk.name}, selling ${shared.kiosk.product.toLowerCase()}` : ""}.`),
          h("p", { class: "muted small" }, `Their lease runs until ${new Date(shared.leasedUntil).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}. If they don't renew, the plot goes back on the market.`));
        return body;
      }
      if (!mine) {
        const bal = balanceOf(s.ledger);
        body.append(
          h("div", { class: "stat-row" },
            h("div", { class: "stat" }, h("b", {}, formatUGX(KIOSK_LEASE_PRICE)), h("span", {}, "per 7 days")),
            h("div", { class: "stat" }, h("b", {}, formatUGX(kioskDailyIncome([], 1))), h("span", {}, "sales a day")),
            h("div", { class: "stat" }, h("b", {}, formatUGX(bal)), h("span", {}, "you have"))));
        if (s.kiosk) body.append(h("div", { class: "notice" }, "You already lease a kiosk. One per player for now."));
        else {
          const lease = h("button", { class: "btn block", type: "button", disabled: bal < KIOSK_LEASE_PRICE }, bal < KIOSK_LEASE_PRICE ? `Need ${formatUGX(KIOSK_LEASE_PRICE - bal)} more` : "Lease this kiosk");
          lease.addEventListener("click", async () => {
            lease.disabled = true;
            lease.textContent = "Checking the plot…";
            if (await G.leasePlot(plotId)) G.openSheet(kioskSheet(G, plotId));
            else G.openSheet(kioskSheet(G, plotId));
          });
          body.append(lease, h("p", { class: "muted small" }, "Customers visit while you play. While you're away, you get 60% of a day's sales, for up to 3 days."));
        }
        return body;
      }
      const daysLeft = Math.max(0, Math.ceil((mine.leasedUntil - now) / DAY_MS));
      const sales = A.kioskSalesToday(s, now);
      body.append(h("div", { class: "stat-row" },
        h("div", { class: "stat" }, h("b", {}, `${sales.count}/${sales.max}`), h("span", {}, "sales today")),
        h("div", { class: "stat" }, h("b", {}, formatUGX(kioskDailyIncome(mine.upgrades, eventForTime(now).kioskBonus))), h("span", {}, "max a day")),
        h("div", { class: "stat" }, h("b", {}, `${daysLeft} days`), h("span", {}, "lease left"))));

      // paint
      let color = mine.color, product = mine.product;
      const nm = h("input", { id: "kiosk-name", maxlength: "20", value: mine.name });
      const err = h("div", { class: "err", role: "alert" });
      const paint = h("button", { class: "btn", type: "button" }, "Paint sign");
      paint.addEventListener("click", () => {
        const r = A.paintKiosk(s, nm.value, color, product);
        if (!r.ok) { err.textContent = r.message; return; }
        G.toast(r.message, "ok");
        G.track("kiosk_painted");
        G.changed();
        G.openSheet(kioskSheet(G, plotId));
      });
      body.append(
        field("Sign", nm, err),
        h("div", { class: "field" }, h("label", {}, "Paint"), swatchRow(SIGN_COLORS, color, (c) => (color = c), "Paint colour")),
        h("div", { class: "field" }, h("label", {}, "What you sell"), chipRow(PRODUCTS.map((p) => ({ id: p, label: p })), product as (typeof PRODUCTS)[number], (v) => (product = v), "Product")),
        paint);

      // upgrades
      const ups = h("div", { class: "list" });
      for (const u of UPGRADES) {
        const owned = mine.upgrades.includes(u.id);
        const buy = h("button", { class: owned ? "btn ghost small" : "btn small", type: "button", disabled: owned }, owned ? "Installed" : formatUGX(u.price));
        buy.addEventListener("click", () => {
          if (G.result(A.buyUpgrade(s, u.id, G.now()))) {
            G.track("upgrade_bought", { id: u.id });
            G.changed();
            G.openSheet(kioskSheet(G, plotId));
          }
        });
        ups.append(h("div", { class: "offer" }, h("div", { class: "bottom" }, h("b", {}, u.name), buy), h("div", { class: "muted small" }, `${u.blurb} +${formatUGX(u.incomeBonus)} a day.`)));
      }
      body.append(h("div", { class: "field" }, h("label", {}, "Upgrades"), ups));
      const build = h("button", { class: "btn ghost block", type: "button" }, "Build in your yard");
      build.addEventListener("click", () => G.openSheet(yardSheet(G)));
      body.append(build);
      if (daysLeft <= 2) {
        const renew = h("button", { class: "btn ghost block", type: "button" }, `Renew 7 days for ${formatUGX(KIOSK_LEASE_PRICE)}`);
        renew.addEventListener("click", async () => {
          renew.disabled = true;
          await G.leasePlot(plotId, true);
          G.openSheet(kioskSheet(G, plotId));
        });
        body.append(renew);
      }
      return body;
    },
  };
}

// ---------- Civic ----------

const STAGES: { id: IssueStatus; label: string }[] = [
  { id: "reported", label: "Reported by residents" },
  { id: "verified", label: "Verified (3 reports)" },
  { id: "assigned", label: "Crew assigned" },
  { id: "in_progress", label: "Repair in progress" },
  { id: "resolved", label: "Fixed" },
];

export function civicSheet(G: GameApi): SheetSpec {
  return {
    kind: "civic",
    eyebrow: OFFICE_NAME,
    title: G.state.civic.title,
    live: true,
    body: () => {
      const s = G.state;
      const c = s.civic;
      const now = G.now();
      const order = STAGES.map((x) => x.id);
      const idx = order.indexOf(c.status as IssueStatus);
      const tl = h("ol", { class: "timeline" });
      STAGES.forEach((st, i) => {
        const ev = c.timeline.find((e) => e.status === st.id);
        const cls = i < idx || c.status === "resolved" ? "done" : i === idx ? "now" : "";
        tl.append(h("li", { class: cls }, h("span", { class: "pip" }, cls === "done" ? "✓" : String(i + 1)), h("div", {}, h("div", { class: "t" }, st.label), h("div", { class: "d" }, ev ? `${ev.note} · ${new Date(ev.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : st.id === "reported" ? "Waiting for the first report" : ""))));
      });
      const left = secondsToNextStage(c, now);
      const body = h("div", { class: "sheet-body" },
        h("div", { class: "stat-row" },
          h("div", { class: "stat" }, h("b", {}, `${c.reporters.length}/3`), h("span", {}, "reports")),
          h("div", { class: "stat" }, h("b", {}, "1.2M"), h("span", {}, "budget (fictional UGX)")),
          h("div", { class: "stat" }, h("b", {}, left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : c.status === "resolved" ? "Done" : "—"), h("span", {}, "next step"))),
        tl);
      if (!c.reporters.includes(s.id) && c.status !== "resolved") {
        const btn = h("button", { class: "btn block", type: "button" }, "Report this pothole");
        btn.addEventListener("click", () => {
          if (G.result(A.reportPothole(s, G.now()))) {
            G.track("pothole_reported");
            G.residentReported();
            G.changed();
          }
        });
        body.append(btn);
      } else if (c.status === "resolved") body.append(h("div", { class: "notice ok" }, "The road is patched. Walk over it and see."));
      body.append(h("p", { class: "muted small" }, "The ward office, budget and crew are fictional. Later, players will vote on which problems get fixed first and officials will manage the budget."));
      return body;
    },
  };
}

// ---------- Goals, event, help, share ----------

export function goalsSheet(G: GameApi): SheetSpec {
  return {
    kind: "goals",
    eyebrow: "Your first week",
    title: "Street goals",
    body: () => {
      const s = G.state;
      const done = GOALS.filter((g) => s.goals.includes(g.id)).length;
      return h("div", { class: "sheet-body" },
        h("p", { class: "muted small" }, `${done} of ${GOALS.length} done. Finish a goal, then claim its reward.`),
        h("div", { class: "list" }, GOALS.map((g) => {
          const ok = s.goals.includes(g.id);
          const claimed = St.goalClaimed(s, g.id);
          const reward = St.GOAL_REWARDS[g.id];
          let action: HTMLElement;
          if (ok && !claimed) {
            action = h("button", { class: "btn small", type: "button" }, `Claim ${formatUGX(reward)}`);
            action.addEventListener("click", () => {
              if (G.result(St.claimGoal(s, g.id, G.now()))) {
                G.track("goal_claimed", { goal: g.id });
                G.changed();
                G.openSheet(goalsSheet(G));
              }
            });
          } else action = h("span", { class: "muted small" }, claimed ? "Claimed" : formatUGX(reward));
          return h("div", { class: ok ? "goal done" : "goal" }, h("span", { class: "box" }, ok ? "✓" : ""), h("span", { style: "flex:1" }, g.label), action);
        })));
    },
  };
}

export function eventSheet(G: GameApi): SheetSpec {
  const ev = eventForTime(G.now());
  return {
    kind: "event",
    eyebrow: "Today on the street",
    title: ev.title,
    body: () => h("div", { class: "sheet-body" }, h("p", {}, ev.blurb), h("p", { class: "muted small" }, "A new street event starts every day at midnight Kampala time. Come back tomorrow to see what's happening.")),
  };
}

export function helpSheet(G: GameApi, prefill = ""): SheetSpec {
  return {
    kind: "help",
    eyebrow: "Help",
    title: "How can we help?",
    body: () => {
      const s = G.state;
      const body = h("div", { class: "sheet-body" });
      body.append(h("div", { class: "notice warn" }, "Ug Life will never ask you for money, mobile money PINs or passwords. If anyone does, it's a scam."));
      for (const f of FAQ) body.append(h("details", { class: "faq" }, h("summary", {}, f.q), h("p", {}, f.a)));

      const cat = h("select", { id: "t-cat" },
        h("option", { value: "how-to" }, "Question"),
        h("option", { value: "bug" }, "Something is broken"),
        h("option", { value: "safety", selected: prefill.startsWith("Report") }, "Safety or scam"),
        h("option", { value: "account" }, "My progress or money"),
        h("option", { value: "other" }, "Something else"));
      const text = h("textarea", { id: "t-text", maxlength: "1000", placeholder: "What happened?" });
      text.value = prefill;
      const err = h("div", { class: "err", role: "alert" });
      const online = G.api.available && G.api.signedIn;
      const send = h("button", { class: "btn block", type: "button" }, online ? "Send to support" : "Save my note");
      send.addEventListener("click", async () => {
        const r = A.addTicket(s, cat.value as PlayerState["tickets"][number]["category"], text.value, G.now());
        if (!r.ok) { err.textContent = r.message; return; }
        G.changed();
        G.track("ticket_saved", { category: cat.value });
        send.disabled = true;
        const sent = online && (await G.api.ticket(cat.value, text.value.trim()));
        if (sent) s.tickets[s.tickets.length - 1].status = "sent";
        if (sent && prefill.startsWith("Report about")) await G.api.report(prefill.slice(13, -2), text.value.trim());
        G.toast(sent ? "Sent. Replies show up here in Help, usually within a day." : "Saved on this phone. It sends when you're back online.", "ok");
        G.closeSheet();
      });
      const replies = h("div", { class: "list" });
      body.append(
        h("h3", { style: "margin:6px 0 0;font-size:16px" }, "Contact support"),
        ...(online ? [] : [h("div", { class: "notice" }, G.api.available ? "You're offline. Your note is saved on this phone and sent when you reconnect." : "Support is connected on the live site. In this preview, your note stays on this phone.")]),
        field("Topic", cat), field("Your message", text, err), send, replies);
      if (online) {
        void G.api.myTickets().then((list) => {
          if (!list.length) return;
          replies.append(h("label", { style: "font-size:13px;font-weight:700" }, "Your messages"));
          for (const t of list.slice(0, 5)) replies.append(h("div", { class: "offer" }, h("div", { class: "muted small" }, t.body.slice(0, 140)), t.reply ? h("div", {}, h("b", {}, "Ug Life: "), t.reply) : h("div", { class: "muted small" }, t.status === "open" ? "Waiting for a reply" : t.status)));
        });
      }

      // move to a new phone
      if (G.api.available) {
        const code = G.api.recoveryCode();
        const box = h("div", { class: "field" }, h("label", {}, "Move to a new phone"));
        if (code) {
          const show = h("button", { class: "btn ghost small", type: "button" }, "Show my recovery code");
          show.addEventListener("click", () => {
            show.replaceWith(h("div", { class: "notice" }, h("b", { class: "code" }, code.match(/.{1,4}/g)!.join(" ")), h("br", {}), "Write this down and keep it private. Anyone with this code can play as you."));
          });
          box.append(show);
        }
        const input = h("input", { id: "restore-code", placeholder: "Recovery code from your old phone", autocomplete: "off", autocapitalize: "off" });
        const restore = h("button", { class: "btn ghost small", type: "button" }, "Restore");
        const rerr = h("div", { class: "err", role: "alert" });
        restore.addEventListener("click", async () => {
          restore.disabled = true;
          const r = await G.api.restore(input.value);
          restore.disabled = false;
          if ("error" in r) { rerr.textContent = r.error; return; }
          if (r.save) G.adoptSave(r.save, "Your progress is back.");
          else G.toast("Code accepted. That account had no progress yet.", "info");
          G.closeSheet();
        });
        box.append(h("div", { style: "display:grid;grid-template-columns:1fr auto;gap:8px" }, input, restore), rerr);
        body.append(box);
      }

      // settings
      const live = h("input", { type: "checkbox", id: "set-live", checked: s.settings.liveTime });
      live.addEventListener("change", () => { s.settings.liveTime = live.checked; G.changed(); });
      const rm = h("input", { type: "checkbox", id: "set-rm", checked: s.settings.reducedMotion });
      rm.addEventListener("change", () => { s.settings.reducedMotion = rm.checked; G.changed(); });
      const toggle = (id: string, key: "sound" | "music" | "voices" | "voiceAuto" | "lite" | "effects" | "ambience", title: string, help: string, dflt: boolean) => {
        const box = h("input", { type: "checkbox", id, checked: s.settings[key] ?? dflt });
        box.addEventListener("change", () => {
          s.settings[key] = box.checked;
          G.changed();
          G.applySettings();
          if (key === "sound" && !box.checked) G.track("sound_off");
        });
        return h("label", { class: "toggle", for: id }, h("span", {}, h("b", {}, title), h("small", {}, help)), box);
      };
      const volumeSlider = () => {
        const r = h("input", { type: "range", id: "set-volume", min: "0", max: "100", step: "5", value: String(s.settings.volume ?? 90), "aria-label": "Volume" });
        r.addEventListener("input", () => { s.settings.volume = Number(r.value); G.applySettings(); });
        r.addEventListener("change", () => G.changed());
        return h("label", { class: "toggle", for: "set-volume" }, h("span", {}, h("b", {}, "Volume")), r);
      };
      body.append(
        h("h3", { style: "margin:6px 0 0;font-size:16px" }, "Sound"),
        toggle("set-sound", "sound", "All sound", "Turn off to mute everything (same as the speaker button).", true),
        volumeSlider(),
        toggle("set-ambience", "ambience", "Street sounds", "Boda engines and horns, matatus, birds, crickets, rain, the crowd.", true),
        toggle("set-effects", "effects", "Game effects", "Taps, coins, horns and pops when you do things.", true),
        toggle("set-music", "music", "Music", "Studio 256, Club 256 and the halls, louder at night.", true),
        toggle("set-voices", "voices", "Street voices", "Conductors, vendors and residents call out loud using your phone's voice.", true),
        toggle("set-voiceauto", "voiceAuto", "Play voice hellos by themselves", "Off: tap a voice bubble to hear it.", false),
        h("h3", { style: "margin:6px 0 0;font-size:16px" }, "Settings"),
        toggle("set-lite", "lite", "Lite mode for slow phones", "Sharper on fast phones when off. Fewer people walking, simpler sound, smoother on older phones.", G.state.settings.lite ?? false),
        h("label", { class: "toggle", for: "set-live" }, h("span", {}, h("b", {}, "Follow Kampala time"), h("small", {}, "Night falls on the street after 7pm. Turn off to always play in daylight.")), live),
        h("label", { class: "toggle", for: "set-rm" }, h("span", {}, h("b", {}, "Reduce motion"), h("small", {}, "Stops rain animation and pulsing markers.")), rm));
      const install = G.installPrompt();
      if (install) {
        const b = h("button", { class: "btn ghost block", type: "button" }, "Add Ug Life to your home screen");
        b.addEventListener("click", install);
        body.append(b);
      }
      // reset with an in-page confirm step
      const reset = h("button", { class: "btn danger block", type: "button" }, "Delete my progress");
      let armed = false;
      reset.addEventListener("click", () => {
        if (!armed) {
          armed = true;
          reset.textContent = "Tap again to delete everything on this phone";
          return;
        }
        G.resetSave();
      });
      body.append(reset, h("p", { class: "muted small" }, G.api.available
        ? "Privacy: we store your Ug Tag, progress, support messages and the snaps you choose to share. No phone number, email or location. Delete my progress clears this phone; ask support to delete your online copy."
        : "Privacy: this preview stores your tag, progress and notes only on this phone. Nothing is sent to a server."));
      return body;
    },
  };
}

export function shareSheet(G: GameApi): SheetSpec {
  return {
    kind: "share",
    eyebrow: "Your card",
    title: "Share your Ug Tag",
    body: () => {
      const s = G.state;
      const url = G.joinUrl();
      const canvas = renderShareCard(s, url);
      const img = h("img", { class: "card-preview", alt: `Ug Tag card for ${s.tag.name}` });
      img.src = canvas.toDataURL("image/png");
      const level = levelForXp(s.xp);
      const text = `I'm ${s.tag.ghost ? "on" : s.tag.name + ", level " + level + " on"} Ug Life, a Kampala street you can live on. Find me there: ${url}`;
      const done = () => {
        G.track("card_shared");
        if (A.complete(s, "share")) G.toast("Goal done: share your card", "ok");
        G.changed();
      };
      const btns = h("div", { class: "row-btns" });
      if (typeof navigator.share === "function") {
        const share = h("button", { class: "btn", type: "button" }, "Share");
        share.addEventListener("click", () => {
          canvas.toBlob(async (blob) => {
            try {
              const file = blob ? new File([blob], "ug-life-card.png", { type: "image/png" }) : null;
              if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
              else await navigator.share({ text });
              done();
            } catch {
              /* cancelled */
            }
          }, "image/png");
        });
        btns.append(share);
      }
      const wa = h("a", { class: "btn", href: `https://wa.me/?text=${encodeURIComponent(text)}`, target: "_blank", rel: "noopener noreferrer", style: "background:#1fa855" }, "Send on WhatsApp");
      wa.addEventListener("click", done);
      const copy = h("button", { class: "btn ghost", type: "button" }, "Copy text");
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          G.toast("Copied", "ok");
          done();
        } catch {
          G.toast("Couldn't copy. Long-press the card to save it instead.", "bad");
        }
      });
      btns.append(wa, copy);
      return h("div", { class: "sheet-body" }, img, btns, h("p", { class: "muted small" }, "Long-press the card to save it, then post it to your WhatsApp Status or TikTok."));
    },
  };
}

// ---------- real players on the street ----------

export function visitorSheet(G: GameApi, v: Visitor): SheetSpec {
  return {
    kind: "visitor",
    eyebrow: "Player",
    title: v.name,
    body: () => {
      const s = G.state;
      const blocked = s.blocked.includes(v.id);
      const socials = v.tag.socials?.length
        ? h("div", { class: "field" }, h("label", {}, "Socials"), v.tag.socials.map((so) => {
          const p = PLATFORMS.find((x) => x.id === so.platform);
          return p ? h("div", { class: "social-row" }, h("span", {}, h("b", {}, p.label), " ", h("a", { href: profileUrl(p.id, so.handle), target: "_blank", rel: "noopener noreferrer" }, "@" + so.handle)), h("span", { class: "badge grey" }, "unverified")) : null;
        }))
        : null;
      const report = h("button", { class: "btn ghost small", type: "button" }, "Report");
      report.addEventListener("click", () => G.openSheet(helpSheet(G, `Report about ${v.name} (${v.id}): `)));
      const block = h("button", { class: "btn danger small", type: "button" }, blocked ? "Unblock" : "Block");
      block.addEventListener("click", () => {
        s.blocked = blocked ? s.blocked.filter((x) => x !== v.id) : [...s.blocked, v.id];
        G.changed();
        G.toast(blocked ? `${v.name} unblocked` : `${v.name} blocked. You won't see them.`, "info");
        G.closeSheet();
      });
      G.track("visitor_viewed");
      const hi = h("button", { class: "btn", type: "button" }, "👋 Say hi");
      hi.addEventListener("click", () => {
        G.say("phrase", "otya", v.id);
        G.say("emote", "wave");
        G.closeSheet();
      });
      const talk = h("button", { class: "btn ghost", type: "button" }, "Talk");
      talk.addEventListener("click", () => G.openSheet(talkSheet(G, { id: v.id, name: v.name })));
      const friend = h("button", { class: "btn ghost", type: "button" }, "➕ Add friend");
      friend.addEventListener("click", async () => {
        friend.disabled = true;
        const r = await G.api.addFriend(v.id);
        if (!r.ok) { G.toast(r.message, "bad"); friend.disabled = false; return; }
        G.track("friend_added");
        G.toast(r.status === "friends" ? `You and ${v.name} are friends now! Message them from More → Friends.` : `Friend request sent to ${v.name}.`, "ok");
        friend.textContent = r.status === "friends" ? "Friends ✓" : "Request sent";
      });
      const near = { x: Math.floor(v.pos.x), y: Math.floor(v.pos.y) };
      const go = h("button", { class: "btn ghost", type: "button" }, "Go to them");
      go.addEventListener("click", () => { G.walkTo(near); G.closeSheet(); });
      return h("div", { class: "sheet-body" },
        h("div", { class: "profile-head" }, avatarCanvas(v.look), h("div", { style: "display:grid;gap:6px" }, h("div", {}, h("span", { class: "badge", style: "background:#2f7a4b" }, `Level ${v.level}`)), h("b", {}, v.tag.status || "On the street"))),
        blocked ? null : h("div", { class: "row-btns" }, hi, talk, go),
        blocked ? null : h("div", { class: "row-btns" }, friend),
        v.kiosk ? h("div", { class: "notice" }, `Runs the kiosk ${v.kiosk.name}`) : null,
        socials,
        h("p", { class: "muted small" }, "A real player who was on the street in the last few minutes. Never send money or codes to anyone you meet here."),
        h("div", { class: "row-btns" }, report, block));
    },
  };
}
