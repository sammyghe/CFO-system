// "Kampala land": buy plots in real neighbourhoods, build them up, collect rent.
// One area is hot every day.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { kampalaDateKey } from "../game/time";
import * as L from "../game/land";
import { HOT_PRICE, HOT_RENT, LAND_AREAS, LAND_LEVELS, MAX_LAND, areaById, hotArea, rentFor } from "../content/land";
import type { GameApi, SheetSpec } from "./sheets";
import type { LandMarket } from "../net/api";

export function landSheet(G: GameApi): SheetSpec {
  let market: LandMarket | null = null;
  let loading = true;
  let busy = false;
  const redraw = () => G.openSheet(spec);
  const spec: SheetSpec = {
    kind: "land",
    eyebrow: "Own a piece of the city",
    title: "Kampala land",
    body: () => {
      const s = G.state;
      const now = G.now();
      const day = kampalaDateKey(now);
      const hot = hotArea(day);
      const bal = balanceOf(s.ledger);
      const body = h("div", { class: "sheet-body" });
      body.append(h("div", { class: "hot-banner" }, h("b", {}, `🔥 Hot today: ${hot.name}`), h("span", {}, `Rent ×${HOT_RENT} there today. Plots cost ×${HOT_PRICE}. A new area gets hot every day.`)));

      // your land
      if (s.land.length) {
        const rent = rentFor(s.land, day);
        const collected = L.rentCollected(s, now);
        const collect = h("button", { class: "btn block", type: "button", disabled: collected }, collected ? "Today's rent is collected. More tomorrow." : `Collect today's rent: ${formatUGX(rent)}`);
        collect.addEventListener("click", () => {
          if (G.result(L.collectRent(s, G.now()))) {
            G.track("rent_collected");
            G.changed();
            redraw();
          }
        });
        const mine = h("div", { class: "list" });
        for (const l of s.land) {
          const a = areaById(l.area)!;
          const lv = LAND_LEVELS[l.level];
          const next = L.nextLevel(l.level);
          const build = next ? h("button", { class: "btn small", type: "button", disabled: bal < next.cost }, `Build ${next.name} · ${formatUGX(next.cost)}`) : h("span", { class: "badge" }, "Fully built");
          if (next) build.addEventListener("click", () => {
            if (G.result(L.buildLand(s, l.area, l.slot, G.now()))) {
              G.track("land_built");
              if (l.level === 3) G.toast("Goal done: build a muzigo. Claim it in Goals.", "ok");
              G.changed();
              redraw();
            }
          });
          const dayRent = lv.rent * (l.area === hot.id ? HOT_RENT : 1);
          mine.append(h("div", { class: "land-mine" },
            h("div", { class: "land-pic", "data-level": String(l.level), "aria-hidden": "true" }, ["🌱", "🍌", "🛖", "🏘️", "🏢", "🏬"][l.level] ?? "🏠"),
            h("div", { style: "min-width:0;display:grid;gap:4px" },
              h("b", {}, `${a.name} · plot ${l.slot + 1}`),
              h("span", { class: "muted small" }, `${lv.name} · ${formatUGX(dayRent)} rent a day${l.area === hot.id ? " 🔥" : ""}`),
              build)));
        }
        body.append(h("h3", { class: "go-group" }, `Your land (${s.land.length} of ${MAX_LAND})`), collect, mine);
      } else {
        body.append(h("p", {}, "Buy a plot in a real Kampala neighbourhood from as little as UGX 3,000. Build on it, from a banana garden to apartments, and collect rent every day. Plots get dearer as an area fills up, so get in early."));
      }

      // the market
      body.append(h("h3", { class: "go-group" }, "Buy a plot"));
      if (!G.online()) {
        body.append(h("div", { class: "notice" }, "Buying land needs a connection, so two people can't buy the same plot. Your own land still earns rent offline."));
        return body;
      }
      if (loading) {
        body.append(h("p", { class: "muted" }, "Loading the land market…"));
        return body;
      }
      if (!market) {
        body.append(h("div", { class: "notice" }, "Couldn't load the land market. Try again in a minute."));
        return body;
      }
      const areas = [...LAND_AREAS].sort((a, b) => (a.id === market!.hot ? -1 : b.id === market!.hot ? 1 : a.basePrice - b.basePrice));
      for (const a of areas) {
        const m = market.areas.find((x) => x.id === a.id);
        if (!m) continue;
        const soldOut = m.sold >= a.plots;
        const owned = s.land.filter((l) => l.area === a.id).length;
        const buy = h("button", { class: "btn small", type: "button", disabled: busy || soldOut || s.land.length >= MAX_LAND || bal < m.price }, soldOut ? "Sold out" : `Buy · ${formatUGX(m.price)}`);
        buy.addEventListener("click", async () => {
          busy = true;
          buy.disabled = true;
          buy.textContent = "Buying…";
          const ok = await G.buyLand(a.id);
          busy = false;
          if (ok) {
            G.track("land_bought");
            market = (await G.api.land(true)) ?? market;
          }
          redraw();
        });
        const owners = [...new Set(m.owners.map((o) => o.name).filter(Boolean))].slice(0, 4);
        body.append(h("div", { class: `land-area${a.id === market.hot ? " hot" : ""}` },
          h("div", { class: "land-head" }, h("b", {}, `${a.id === market.hot ? "🔥 " : ""}${a.name}`), h("span", { class: "muted small" }, `${m.sold}/${a.plots} owned`)),
          h("span", { class: "muted small" }, a.blurb),
          h("div", { class: "land-bar" }, h("i", { style: `width:${Math.round((m.sold / a.plots) * 100)}%` })),
          owners.length ? h("span", { class: "small" }, `Owners: ${owners.join(", ")}${m.owners.length > owners.length ? "…" : ""}`) : h("span", { class: "small muted" }, "Nobody owns land here yet. Be first!"),
          h("div", { class: "bottom" }, h("span", { class: "small" }, owned ? `You own ${owned} here` : ""), buy)));
      }
      body.append(h("p", { class: "muted small" }, "Land is game property and has no real-world value. You can own up to 6 plots."));
      return body;
    },
  };
  void G.api.land().then((m) => {
    market = m;
    loading = false;
    if (document.getElementById("sheet-title")?.textContent?.includes("Kampala land")) redraw();
  });
  return spec;
}
