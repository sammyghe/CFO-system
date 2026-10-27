// "How you're doing": energy and the four needs, and exactly how to fix each one here.

import { h } from "./dom";
import { energyNow, maxEnergy } from "../game/energy";
import { NEEDS, NEED_INFO, hasHome, homeAt, HOMES, mood, moodLabel, needsNow } from "../game/needs";
import { AREAS } from "../world/map";
import { energyBar } from "./worksheet";
import type { GameApi, SheetSpec } from "./sheets";

export function needsSheet(G: GameApi): SheetSpec {
  return {
    kind: "needs",
    eyebrow: "How you're doing",
    title: "Needs",
    live: true,
    body: () => {
      const s = G.state;
      const now = G.now();
      const v = needsNow(s, now);
      const m = mood(s, now, energyNow(s, now));
      const body = h("div", { class: "sheet-body" },
        h("div", { class: "mood" }, h("b", {}, moodLabel(m)), h("span", { class: "muted small" }, `Mood ${m}/100. Keep your needs up to work well.`)),
        energyBar(G));
      for (const k of NEEDS) {
        const i = NEED_INFO[k];
        body.append(h("div", { class: "need-row" },
          h("span", { class: "need-ico" }, i.icon),
          h("div", { style: "display:grid;gap:4px;min-width:0" },
            h("div", { class: "need-top" }, h("b", {}, i.label), h("span", { class: "muted small" }, `${v[k]}/100`)),
            h("span", { class: "energy-bar" }, h("i", { class: v[k] < 20 ? "low" : "", style: `width:${v[k]}%` })),
            h("span", { class: "muted small" }, i.fix))));
      }
      const home = s.home && hasHome(s, now) ? homeAt(s.home.building) : null;
      const where = home ? AREAS.find((a) => a.id === home.area) : null;
      body.append(h("div", { class: "notice" }, home
        ? `Your room: ${home.name} (${where?.name}), paid until ${new Date(s.home!.until).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}. Go to its door to sleep (full ⚡${maxEnergy(s)}) and shower.`
        : `No room yet. Rent one to sleep and shower for free: ${HOMES.map((x) => `${x.name} UGX ${x.pricePerWeek.toLocaleString()}/week`).join(" · ")}.`));
      return body;
    },
  };
}
