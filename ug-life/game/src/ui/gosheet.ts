// "Go": every place on the street in one list, with Walk and Boda buttons, so
// getting around on a small phone never needs precise taps on the map.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { BUILDINGS, PLOTS, POTHOLE, BODA_STAGE } from "../world/map";
import { tileDistance } from "../world/path";
import { VENDORS, BODA, bodaFare } from "../content/catalog";
import type { GameApi, SheetSpec } from "./sheets";

export interface Destination {
  id: string;
  name: string;
  group: "Food" | "Shops & places" | "Transport" | "Kiosks" | "Things to do";
  detail: string;
  tile: { x: number; y: number };
  /** Panel to open on arrival. */
  open?: "vendor" | "building" | "kiosk" | "board" | "pothole" | "boda" | "gate";
}

export function destinations(G: GameApi): Destination[] {
  const out: Destination[] = [];
  for (const v of VENDORS) out.push({ id: v.id, name: v.name, group: "Food", detail: `${v.product} · ${formatUGX(v.price)} · +${v.boostPct}% pay`, tile: v.stand, open: "vendor" });
  out.push({ id: "chapati", name: "Mama Rose Chapati", group: "Food", detail: "Chapati and tea", tile: BUILDINGS.find((b) => b.id === "chapati")!.door, open: "building" });
  out.push({ id: "bodastage", name: "Boda stage", group: "Transport", detail: "Take a boda or rent one to earn", tile: BODA_STAGE, open: "boda" });
  out.push({ id: "taxistage", name: "Taxi stage", group: "Transport", detail: "Matatus to Wandegeya and Kikoni", tile: { x: 3, y: 11 } });
  out.push({ id: "sacco", name: "Kikoni Boda Sacco", group: "Transport", detail: "Where riders rent their bodas", tile: BUILDINGS.find((b) => b.id === "sacco")!.door, open: "boda" });
  for (const b of BUILDINGS) if (!["chapati", "sacco"].includes(b.id)) out.push({ id: b.id, name: b.name, group: "Shops & places", detail: b.kind, tile: b.door, open: "building" });
  for (const p of PLOTS) {
    const shared = G.sharedPlot(p.id);
    const mine = G.state.kiosk?.plotId === p.id;
    const name = mine ? `Your kiosk: ${G.state.kiosk!.name}` : p.npcOwner ? p.npcOwner.sign : shared?.kiosk?.name ?? (shared ? `${shared.owner}'s kiosk` : "Empty kiosk plot");
    out.push({ id: p.id, name, group: "Kiosks", detail: mine ? "Paint, upgrade, build in your yard" : p.npcOwner || shared ? "Run by a neighbour" : "To let: lease it for your business", tile: { x: p.x + 1, y: p.y - 1 }, open: "kiosk" });
  }
  out.push({ id: "board", name: "Community board", group: "Things to do", detail: "Street Snaps from real Kampala streets", tile: { x: 25, y: 11 }, open: "board" });
  out.push({ id: "pothole", name: "The pothole", group: "Things to do", detail: "Report it and get it fixed", tile: { x: POTHOLE.x, y: POTHOLE.y - 3 }, open: "pothole" });
  out.push({ id: "gate", name: "Makerere University gate", group: "Things to do", detail: "A Kampala landmark", tile: { x: 14, y: 1 }, open: "gate" });
  return out;
}

export function goSheet(G: GameApi, query = ""): SheetSpec {
  return {
    kind: "go",
    eyebrow: "Get around",
    title: "Where do you want to go?",
    body: () => {
      const s = G.state;
      const from = { x: Math.floor(s.pos.x), y: Math.floor(s.pos.y) };
      const body = h("div", { class: "sheet-body" });
      const search = h("input", { id: "go-search", type: "search", placeholder: "Search: rolex, pharmacy, kiosk…", value: query, autocomplete: "off", "aria-label": "Search places" });
      const list = h("div", { class: "list go-list" });
      const balance = balanceOf(s.ledger);
      const render = () => {
        const q = search.value.trim().toLowerCase();
        list.replaceChildren();
        const all = destinations(G).filter((d) => !q || `${d.name} ${d.detail} ${d.group}`.toLowerCase().includes(q));
        if (!all.length) list.append(h("p", { class: "muted" }, "Nothing with that name on this street yet."));
        let group = "";
        for (const d of q ? all.sort((a, b) => tileDistance(from, a.tile) - tileDistance(from, b.tile)) : all) {
          if (!q && d.group !== group) {
            group = d.group;
            list.append(h("h3", { class: "go-group" }, group));
          }
          const dist = tileDistance(from, d.tile);
          const walkSec = Math.max(1, Math.round(dist / BODA.walkSpeed));
          const walk = h("button", { class: "btn ghost small", type: "button" }, dist < 2 ? "You're here" : "Walk");
          walk.disabled = dist < 2;
          walk.addEventListener("click", () => {
            G.track("place_go");
            G.closeSheet();
            G.goTo(d, false);
          });
          const fare = bodaFare(dist);
          const ride = h("button", { class: "btn small boda-btn", type: "button" }, `Boda ${formatUGX(fare)}`);
          ride.disabled = balance < fare || !!s.ride;
          ride.addEventListener("click", () => {
            G.track("place_go");
            G.goTo(d, true);
          });
          list.append(h("div", { class: "go-row" },
            h("div", { class: "go-name" }, h("b", {}, d.name), h("span", { class: "muted small" }, `${d.detail} · ${dist < 2 ? "right here" : walkSec < 5 ? "a short walk" : `${walkSec}s walk`}`)),
            h("div", { class: "go-btns" }, walk, dist >= 8 ? ride : null)));
        }
      };
      search.addEventListener("input", render);
      render();
      body.append(search, list);
      return body;
    },
  };
}
