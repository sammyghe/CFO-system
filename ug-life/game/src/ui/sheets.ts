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
import { PLOTS, placeById, type Building } from "../world/map";
import { RESIDENTS } from "../content/residents";
import { FAQ } from "../content/faq";
import { drawPerson } from "../world/art";
import { renderShareCard } from "./sharecard";
import { DAY_MS } from "../game/time";

export interface GameApi {
  state: PlayerState;
  now(): number;
  changed(): void;
  toast(msg: string, kind?: "ok" | "bad" | "info"): void;
  result(r: A.Result): boolean;
  openSheet(s: SheetSpec): void;
  closeSheet(): void;
  walkTo(tile: { x: number; y: number }): void;
  joinUrl(): string;
  finishOnboarding(): void;
  resetSave(): void;
  installPrompt(): (() => void) | null;
  track(name: string, props?: Record<string, unknown>): void;
  residentReported(): void;
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
      return h("div", { class: "sheet-body" },
        h("div", { class: "profile-head" }, avatarCanvas(r.look), h("div", { style: "display:grid;gap:6px" }, h("div", {}, h("span", { class: "badge" }, `Level ${r.level}`)), h("b", {}, r.role))),
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
      const owner = RESIDENTS.find((r) => r.start.x === b.door.x && r.start.y === b.door.y);
      return h("div", { class: "sheet-body" },
        b.id === "pharmacy" ? h("div", { class: "notice" }, "The billboard on this roof is a demo ad for Ug Life. Later, real shops can book billboards and sponsored events.") : null,
        relevant ? h("div", { class: "notice ok" }, job!.stage === "pickup" && job!.fromId === b.id ? "Your pickup is here. Walk to the door." : "Your drop-off is here. Walk to the door.") : null,
        owner ? h("p", {}, `${owner.name} works here. ${owner.role}.`) : null,
        h("p", { class: "muted small" }, "In later builds you'll be able to go inside shops, work shifts here and see who owns each business."),
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
          lease.addEventListener("click", () => {
            if (G.result(A.leaseKiosk(s, plotId, G.now()))) {
              G.track("kiosk_leased");
              G.changed();
              G.openSheet(kioskSheet(G, plotId));
            }
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
      if (daysLeft <= 2) {
        const renew = h("button", { class: "btn ghost block", type: "button" }, `Renew 7 days for ${formatUGX(KIOSK_LEASE_PRICE)}`);
        renew.addEventListener("click", () => { if (G.result(A.renewKiosk(s, G.now()))) { G.changed(); G.openSheet(kioskSheet(G, plotId)); } });
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
        h("p", { class: "muted small" }, `${done} of ${GOALS.length} done`),
        h("div", { class: "list" }, GOALS.map((g) => {
          const ok = s.goals.includes(g.id);
          return h("div", { class: ok ? "goal done" : "goal" }, h("span", { class: "box" }, ok ? "✓" : ""), h("span", {}, g.label));
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
      const send = h("button", { class: "btn block", type: "button" }, "Save my note");
      send.addEventListener("click", () => {
        const r = A.addTicket(s, cat.value as PlayerState["tickets"][number]["category"], text.value, G.now());
        if (!r.ok) { err.textContent = r.message; return; }
        G.changed();
        G.track("ticket_saved", { category: cat.value });
        G.toast("Saved. It goes to support when accounts go live.", "ok");
        G.closeSheet();
      });
      body.append(
        h("h3", { style: "margin:6px 0 0;font-size:16px" }, "Contact support"),
        h("div", { class: "notice" }, "Support isn't connected in this preview build. Your note is saved on this phone and sent to support once online accounts are switched on."),
        field("Topic", cat), field("Your message", text, err), send);
      if (s.tickets.length) body.append(h("p", { class: "muted small" }, `${s.tickets.length} note${s.tickets.length === 1 ? "" : "s"} saved on this phone.`));

      // settings
      const live = h("input", { type: "checkbox", id: "set-live", checked: s.settings.liveTime });
      live.addEventListener("change", () => { s.settings.liveTime = live.checked; G.changed(); });
      const rm = h("input", { type: "checkbox", id: "set-rm", checked: s.settings.reducedMotion });
      rm.addEventListener("change", () => { s.settings.reducedMotion = rm.checked; G.changed(); });
      body.append(
        h("h3", { style: "margin:6px 0 0;font-size:16px" }, "Settings"),
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
      body.append(reset, h("p", { class: "muted small" }, "Privacy: this build stores your tag, progress and notes only on this phone. Nothing is sent to a server."));
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
