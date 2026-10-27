// Travel around Kampala: every area, how many people are there now, and three ways to go.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { energyNow } from "../game/energy";
import { TRAVEL, canTravel, type TravelMode } from "../game/travel";
import { AREA, AREAS } from "../world/map";
import type { GameApi, SheetSpec } from "./sheets";

const ICON: Record<string, string> = { wandegeya: "🏪", makerere: "🎓", owino: "🛍️", kabalagala: "🌃" };

export function travelSheet(G: GameApi): SheetSpec {
  return {
    kind: "travel",
    eyebrow: `You're in ${AREA.name}`,
    title: "Go around Kampala",
    body: () => {
      const s = G.state;
      const bal = balanceOf(s.ledger);
      const en = energyNow(s, G.now());
      const body = h("div", { class: "sheet-body" });
      const blocked = canTravel(s);
      if (!blocked.ok) body.append(h("div", { class: "notice warn" }, blocked.message));
      const counts = G.areaCounts();
      for (const a of AREAS) {
        const here = a.id === AREA.id;
        const card = h("div", { class: `area-card${here ? " here" : ""}` },
          h("div", { class: "area-head" }, h("span", { class: "area-ico" }, ICON[a.id] ?? "📍"),
            h("div", {}, h("b", {}, a.name), h("span", { class: "muted small" }, here ? "You're here" : `${counts[a.id] ?? 0} players here now`))),
          h("p", { class: "small" }, a.blurb));
        if (!here) {
          const row = h("div", { class: "travel-btns" });
          for (const mode of ["matatu", "boda", "walk"] as TravelMode[]) {
            const t = TRAVEL[mode];
            const cant = !blocked.ok || (t.fare > bal) || (t.energy > en);
            const b = h("button", { class: `btn small ${mode === "boda" ? "boda-btn" : mode === "walk" ? "ghost" : ""}`, type: "button", disabled: cant, title: t.blurb },
              `${mode === "matatu" ? "🚐" : mode === "boda" ? "🏍️" : "🚶"} ${t.label}${t.fare ? ` ${formatUGX(t.fare)}` : ""}`);
            b.addEventListener("click", () => G.travel(a.id, mode));
            row.append(b);
          }
          card.append(row);
        }
        body.append(card);
      }
      body.append(h("p", { class: "muted small" }, "Matatu: cheapest. Boda: fastest. Walking is free but uses ⚡20. Each area has its own shops, shifts, food, billboards and people."));
      return body;
    },
  };
}
