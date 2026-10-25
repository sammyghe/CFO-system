// "Work": every way to earn and everything worth paying for, in one list, each with
// plain steps. The detail panels (jobs, boda, shifts, land…) open from here.

import { h } from "./dom";
import { formatUGX, levelForXp, JOBS_PER_DAY } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { energyNow, maxEnergy, ENERGY_COST } from "../game/energy";
import { shiftsToday } from "../game/shifts";
import * as A from "../game/actions";
import * as St from "../game/street";
import { BODA, SHIFTS, SHIFTS_PER_DAY } from "../content/catalog";
import { BUILDINGS } from "../world/map";
import * as S from "./sheets";
import { bodaSheet } from "./streetsheets";
import { landSheet } from "./landsheet";
import { goSheet } from "./gosheet";
import { billboardSheet } from "./billboardsheet";
import type { GameApi, SheetSpec } from "./sheets";

export function energyBar(G: GameApi) {
  const s = G.state;
  const now = G.now();
  const e = energyNow(s, now), max = maxEnergy(s);
  return h("div", { class: "energy-row" },
    h("span", { class: "energy-label" }, `⚡ ${e} / ${max} energy`),
    h("span", { class: "energy-bar" }, h("i", { style: `width:${Math.round((e / max) * 100)}%` })),
    e < 20 ? h("span", { class: "muted small" }, "Low. Eat something: a rolex gives ⚡45.") : null);
}

export function workSheet(G: GameApi): SheetSpec {
  return {
    kind: "work",
    eyebrow: "Make money",
    title: "Work",
    body: () => {
      const s = G.state;
      const now = G.now();
      const lv = levelForXp(s.xp);
      const card = (o: { icon: string; title: string; pay: string; cost: string; steps: string[]; action: string; open: () => void; note?: string | null; locked?: string | null }) => {
        const btn = h("button", { class: "btn small", type: "button", disabled: !!o.locked }, o.locked ?? o.action);
        btn.addEventListener("click", o.open);
        return h("div", { class: "work-card" },
          h("div", { class: "work-head" }, h("span", { class: "work-ico" }, o.icon), h("div", {}, h("b", {}, o.title), h("span", { class: "muted small" }, `${o.pay} · ${o.cost}`)), btn),
          h("ol", { class: "steps" }, o.steps.map((x) => h("li", {}, x))),
          o.note ? h("p", { class: "muted small" }, o.note) : null);
      };
      const jobsLeft = A.jobsLeftToday(s, now);
      const nextShift = SHIFTS.filter((x) => x.minLevel <= lv).sort((a, b) => b.pay - a.pay)[0];
      return h("div", { class: "sheet-body" },
        energyBar(G),
        h("h3", { class: "go-group" }, "Earn"),
        card({
          icon: "📦", title: "Deliveries", pay: "UGX 1,500–4,500 each", cost: `⚡${ENERGY_COST.delivery}`,
          steps: ["Pick a delivery", "Walk (or boda) to the pickup", "Carry it to the drop-off: you're paid on arrival"],
          action: "See deliveries", open: () => G.openSheet(S.jobsSheet(G)),
          note: `${jobsLeft} of ${JOBS_PER_DAY} left today.`,
        }),
        card({
          icon: "🏍️", title: "Boda rider", pay: `UGX ${BODA.payBase.toLocaleString()}–${BODA.payMax.toLocaleString()} a ride`, cost: `UGX ${BODA.rentPrice.toLocaleString()} rent a day · ⚡${ENERGY_COST.ride} a ride`,
          steps: ["Rent a boda at the sacco for the day", "Pick a passenger who is waving", "Ride them there: they pay when they get off"],
          action: St.hasBoda(s, now) ? "Find passengers" : "Rent a boda", open: () => G.openSheet(bodaSheet(G, "work")),
          note: `${BODA.ridesPerDay - St.ridesToday(s, now)} paid rides left today.`,
        }),
        card({
          icon: "🛠️", title: "Shop shifts", pay: "UGX 1,500–2,800 a shift", cost: "⚡12–22, under a minute",
          steps: ["Walk to a shop that needs help", "Start the shift at the door", "Stay until the timer ends to get paid"],
          action: "Find a shift", open: () => G.openSheet(shiftsSheet(G)),
          note: `${SHIFTS_PER_DAY - shiftsToday(s, now)} shifts left today.${nextShift ? ` Best for your level: ${nextShift.title}.` : ""}`,
        }),
        card({
          icon: "🏪", title: "Run a kiosk", pay: "about UGX 3,000 a day, more with upgrades", cost: "UGX 25,000 for 7 days",
          steps: ["Save UGX 25,000", "Lease an empty plot across the road", "Paint it, upgrade it, build in your yard: customers come by themselves"],
          action: s.kiosk ? "Your kiosk" : "Find a plot", open: () => G.openSheet(goSheet(G, "kiosk")),
        }),
        card({
          icon: "🏘️", title: "Landlord", pay: "UGX 50–6,000 rent a day per plot", cost: "plots from UGX 3,000",
          steps: ["Buy a plot in a Kampala area", "Build on it: banana garden up to apartments", "Collect rent once a day (double in the hot area)"],
          action: "Kampala land", open: () => G.openSheet(landSheet(G)),
        }),
        card({
          icon: "📷", title: "Street Snaps", pay: "UGX 1,000 a day for a snap", cost: "free",
          steps: ["Photograph a real Kampala street", "Your phone turns it into street art", "Share it: approved snaps go on the board"],
          action: "Snap", open: () => G.openSnaps(),
        }),
        card({
          icon: "🎯", title: "Goals and invites", pay: "UGX 500–3,000 each", cost: "free",
          steps: ["Open Goals", "Do the thing", "Tap Claim"],
          action: "Goals", open: () => G.openSheet(S.goalsSheet(G)),
          note: "Invite a friend: UGX 3,000 for you and 2,000 for them when they finish their first job.",
        }),
        h("h3", { class: "go-group" }, "Spend"),
        h("div", { class: "spend-grid" },
          spend("🍳", "Food and energy", "UGX 200–2,000", () => G.openSheet(goSheet(G, "food"))),
          spend("🏍️", "Boda ride anywhere", "from UGX 700", () => G.openSheet(bodaSheet(G, "ride"))),
          spend("🪧", "Your billboard", "from UGX 3,000 a day", () => G.openSheet(billboardSheet(G))),
          spend("🏘️", "Land and buildings", "from UGX 1,500", () => G.openSheet(landSheet(G))),
          spend("🪑", "Kiosk yard", "UGX 500–3,000", () => G.openSheet(goSheet(G, "kiosk"))),
          spend("💛", "Top up", G.topUpEnabled() ? "with mobile money" : "coming soon", () => G.openTopUp())),
        h("p", { class: "muted small" }, `You have ${formatUGX(balanceOf(s.ledger))}. Level ${lv}: higher levels unlock better shifts and more energy.`));
      function spend(icon: string, title: string, price: string, open: () => void) {
        const b = h("button", { class: "spend", type: "button" }, h("span", { class: "work-ico" }, icon), h("b", {}, title), h("span", { class: "muted small" }, price));
        b.addEventListener("click", open);
        return b;
      }
    },
  };
}

/** All shops that need help, nearest first, with Walk buttons. */
export function shiftsSheet(G: GameApi): SheetSpec {
  return {
    kind: "shifts",
    eyebrow: "Work",
    title: "Shop shifts",
    live: true,
    body: () => {
      const s = G.state;
      const now = G.now();
      const lv = levelForXp(s.xp);
      const body = h("div", { class: "sheet-body" }, energyBar(G));
      if (s.shift) {
        const sh = SHIFTS.find((x) => x.id === s.shift!.id)!;
        body.append(h("div", { class: "notice ok" }, `On shift: ${sh.title}. ${Math.max(0, Math.ceil((s.shift.endsAt - now) / 1000))}s left. Stay at the door.`));
        return body;
      }
      const left = SHIFTS_PER_DAY - shiftsToday(s, now);
      body.append(h("p", { class: "muted small" }, `${left} shifts left today. Walk to the shop, then start the shift at its door.`));
      const list = h("div", { class: "list" });
      for (const sh of SHIFTS) {
        const b = BUILDINGS.find((x) => x.id === sh.building)!;
        const locked = lv < sh.minLevel;
        const go = h("button", { class: "btn small", type: "button", disabled: locked || left <= 0 }, locked ? `Level ${sh.minLevel}` : "Go there");
        go.addEventListener("click", () => G.goTo({ id: b.id, name: b.name, group: "Shops & places", detail: b.kind, tile: b.door, open: "building" }, false));
        list.append(h("div", { class: "go-row" },
          h("div", { class: "go-name" }, h("b", {}, sh.title), h("span", { class: "muted small" }, `${formatUGX(sh.pay)} · ⚡${sh.energy} · ${sh.seconds}s · ${b.name}`)),
          h("div", { class: "go-btns" }, go)));
      }
      body.append(list);
      return body;
    },
  };
}
