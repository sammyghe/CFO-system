// Panels for street life: bodas, food carts, building your yard, landmarks.

import { h } from "./dom";
import { balanceOf } from "../game/ledger";
import { formatUGX } from "../game/economy";
import * as St from "../game/street";
import { BODA, SNACKS, VENDORS, YARD_ITEMS, YARD_SLOTS } from "../content/catalog";
import { LANDMARKS, LANDMARKS_FOR_GOAL, LANDMARK_REWARD } from "../content/landmarks";
import { PLACES, placeById } from "../world/map";
import { tileDistance } from "../world/path";
import type { GameApi, SheetSpec } from "./sheets";

// ---------- boda ----------

export function bodaSheet(G: GameApi, tab: "ride" | "work" = "ride"): SheetSpec {
  return {
    kind: "boda",
    eyebrow: "Boda boda",
    title: tab === "ride" ? "Where to?" : "Work as a rider",
    body: () => {
      const s = G.state;
      const now = G.now();
      const body = h("div", { class: "sheet-body" });
      const tabs = h("div", { class: "chips", role: "tablist" });
      for (const [id, label] of [["ride", "Take a boda"], ["work", "Ride for money"]] as const) {
        const b = h("button", { class: "chip", type: "button", role: "tab", "aria-pressed": String(id === tab) }, label);
        b.addEventListener("click", () => G.openSheet(bodaSheet(G, id)));
        tabs.append(b);
      }
      body.append(tabs);

      if (tab === "ride") {
        const from = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
        body.append(h("p", { class: "muted small" }, `A rider picks you up right here. You have ${formatUGX(balanceOf(s.ledger))}.`));
        const list = h("div", { class: "list" });
        const places = PLACES.map((p) => ({ p, d: tileDistance(from, p) })).filter((x) => x.d >= 3).sort((a, b) => a.d - b.d);
        for (const { p, d } of places) {
          const fare = St.fareTo(from, p.id);
          const go = h("button", { class: "btn small", type: "button" }, formatUGX(fare));
          go.addEventListener("click", () => G.takeBoda(p.id));
          list.append(h("div", { class: "bottom offer" }, h("span", {}, h("b", {}, p.name), h("br", {}), h("span", { class: "muted small" }, `about ${Math.max(1, Math.round(d / 8))} min by boda`)), go));
        }
        body.append(list);
        return body;
      }

      // work as a rider
      const has = St.hasBoda(s, now);
      const left = BODA.ridesPerDay - St.ridesToday(s, now);
      if (!has) {
        const rent = h("button", { class: "btn block", type: "button" }, `Rent a boda for today: ${formatUGX(BODA.rentPrice)}`);
        rent.addEventListener("click", () => {
          if (G.result(St.rentBoda(s, G.now()))) {
            G.changed();
            G.setRiding(true);
            G.openSheet(bodaSheet(G, "work"));
          }
        });
        body.append(
          h("p", {}, `Rent a boda from the sacco, pick up passengers waiting around the street, and carry them where they're going. Each ride pays ${formatUGX(BODA.payBase)} to ${formatUGX(BODA.payMax)}, more with a rolex in your stomach.`),
          rent, h("p", { class: "muted small" }, `Up to ${BODA.ridesPerDay} rides a day. The rent covers you until midnight.`));
        return body;
      }
      const toggle = h("button", { class: "btn ghost block", type: "button" }, G.riding() ? "Get off the boda" : "Get on your boda");
      toggle.addEventListener("click", () => {
        G.setRiding(!G.riding());
        G.openSheet(bodaSheet(G, "work"));
      });
      body.append(toggle);
      if (s.ride) {
        const target = St.rideTarget(s.ride);
        const drop = h("button", { class: "btn danger block", type: "button" }, "Cancel this ride");
        drop.addEventListener("click", () => {
          G.cancelRide();
          G.openSheet(bodaSheet(G, "work"));
        });
        body.append(h("div", { class: "notice" }, s.ride.stage === "pickup" ? `${s.ride.passenger} is waving at ${target?.name}.` : `Carrying ${s.ride.passenger} to ${target?.name}.`), drop);
        return body;
      }
      if (s.job) {
        body.append(h("div", { class: "notice" }, "Finish your delivery before picking up passengers."));
        return body;
      }
      if (left <= 0) {
        body.append(h("div", { class: "notice warn" }, `That's ${BODA.ridesPerDay} rides today. Rest, and ride again tomorrow.`));
        return body;
      }
      body.append(h("p", { class: "muted small" }, `${left} rides left today.`));
      const list = h("div", { class: "list" });
      for (const o of St.rideOffers(s, now)) {
        const take = h("button", { class: "btn small", type: "button" }, "Pick up");
        take.addEventListener("click", () => G.startRide(o.id));
        list.append(h("div", { class: "offer" },
          h("div", { class: "muted small" }, `${o.passenger} needs a boda`),
          h("div", { class: "route" }, placeById(o.fromId)?.name ?? "", h("i", {}, "→"), placeById(o.toId)?.name ?? ""),
          h("div", { class: "bottom" }, h("span", { class: "pay" }, formatUGX(o.pay)), take)));
      }
      body.append(list);
      return body;
    },
  };
}

// ---------- food ----------

export function vendorSheet(G: GameApi, id: string): SheetSpec {
  const v = VENDORS.find((x) => x.id === id)!;
  return {
    kind: "vendor",
    eyebrow: `${v.seller}'s cart`,
    title: v.name,
    live: true,
    body: () => {
      const s = G.state;
      const now = G.now();
      const buy = h("button", { class: "btn block", type: "button" }, `Buy ${v.product.toLowerCase()}: ${formatUGX(v.price)}`);
      buy.addEventListener("click", () => {
        if (G.result(St.buyFood(s, v.id, G.now()))) {
          G.track(v.id === "rolex" ? "rolex_bought" : "food_bought");
          G.sfx(v.id === "rolex" ? "sizzle" : "coin");
          G.changed();
        }
      });
      const boost = s.boost && now < s.boost.until ? s.boost : null;
      return h("div", { class: "sheet-body" },
        h("p", {}, v.blurb),
        h("div", { class: "stat-row" },
          h("div", { class: "stat" }, h("b", {}, formatUGX(v.price)), h("span", {}, "price")),
          h("div", { class: "stat" }, h("b", {}, `+${v.boostPct}%`), h("span", {}, "pay on jobs and rides")),
          h("div", { class: "stat" }, h("b", {}, `${v.boostMinutes} min`), h("span", {}, "lasts"))),
        boost ? h("div", { class: "notice ok" }, `${boost.label}: +${boost.pct}% pay for ${Math.ceil((boost.until - now) / 60_000)} more min.`) : null,
        buy,
        snackMenu(G, v.id));
    },
  };
}

/** Cheap things on the menu at a cart or shop. */
export function snackMenu(G: GameApi, where: string): HTMLElement | null {
  const items = SNACKS.filter((x) => x.soldAt.includes(where));
  if (!items.length) return null;
  const grid = h("div", { class: "snacks" });
  for (const sn of items) {
    const b = h("button", { class: "snack", type: "button" }, h("span", { class: "snack-ico" }, sn.icon), h("b", {}, sn.name), h("span", { class: "muted small" }, `${formatUGX(sn.price)} · +${sn.boostPct}%`));
    b.addEventListener("click", () => {
      if (G.result(St.buySnack(G.state, sn.id, G.now()))) {
        G.sfx("coin");
        G.track("food_bought");
        G.changed();
      }
    });
    grid.append(b);
  }
  return h("div", { class: "field" }, h("label", {}, "Cheap bites"), grid);
}

// ---------- yard ----------

export function yardSheet(G: GameApi): SheetSpec {
  return {
    kind: "yard",
    eyebrow: "Your kiosk yard",
    title: "Build your corner",
    body: () => {
      const s = G.state;
      const body = h("div", { class: "sheet-body" });
      if (!s.kiosk) {
        body.append(h("p", {}, "Lease a kiosk across the road to get a yard you can build in."));
        return body;
      }
      body.append(h("p", { class: "muted small" }, `Five spots around your kiosk. Everyone on the street sees what you build. Some things bring extra customers. You have ${formatUGX(balanceOf(s.ledger))}.`));
      for (let slot = 0; slot < YARD_SLOTS; slot++) {
        const current = YARD_ITEMS.find((i) => i.id === s.yard[slot]);
        const sel = h("select", { id: `yard-${slot}`, "aria-label": `Spot ${slot + 1}` },
          h("option", { value: "" }, current ? `Keep: ${current.name}` : "Choose something to build"),
          YARD_ITEMS.filter((i) => i.id !== current?.id).map((i) => h("option", { value: i.id }, `${i.name} · ${formatUGX(i.price)}${i.incomeBonus ? ` · +${formatUGX(i.incomeBonus)}/day` : ""}`)));
        const build = h("button", { class: "btn small", type: "button" }, "Build");
        build.addEventListener("click", () => {
          if (!sel.value) return;
          if (G.result(St.buildInYard(s, slot, sel.value, G.now()))) {
            G.track("yard_built", { item: sel.value });
            G.changed();
            G.openSheet(yardSheet(G));
          }
        });
        const row = h("div", { class: "offer" }, h("b", {}, `Spot ${slot + 1}: ${current ? current.name : "empty"}`), h("div", { style: "display:grid;grid-template-columns:1fr auto;gap:8px" }, sel, build));
        if (current) {
          const clear = h("button", { class: "btn ghost small", type: "button" }, "Clear spot");
          clear.addEventListener("click", () => {
            St.clearYardSlot(s, slot);
            G.changed();
            G.openSheet(yardSheet(G));
          });
          row.append(clear);
        }
        body.append(row);
      }
      return body;
    },
  };
}

// ---------- landmarks ----------

export function landmarkSheet(G: GameApi, id: string): SheetSpec {
  const lm = LANDMARKS.find((l) => l.id === id)!;
  return {
    kind: "landmark",
    eyebrow: lm.where,
    title: lm.name,
    body: () => {
      const s = G.state;
      const found = s.landmarks.length;
      return h("div", { class: "sheet-body" },
        h("p", {}, lm.facts),
        h("div", { class: "notice" }, `You've found ${found} of ${LANDMARKS.length} Kampala landmarks. Each new one pays ${formatUGX(LANDMARK_REWARD)}; find ${LANDMARKS_FOR_GOAL} for the landmarks goal.`),
        h("div", { class: "list" }, LANDMARKS.map((l) => h("div", { class: s.landmarks.includes(l.id) ? "goal done" : "goal" }, h("span", { class: "box" }, s.landmarks.includes(l.id) ? "✓" : ""), h("span", {}, s.landmarks.includes(l.id) ? l.name : "Look around the hills…")))),
        h("p", { class: "muted small" }, "Look at the hills behind the street and tap the buildings on them. Drag the view to see more."));
    },
  };
}
