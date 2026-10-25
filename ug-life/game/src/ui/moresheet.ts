// "More": everything that isn't on the bottom bar, as big tappable rows, plus the
// street leaderboard.

import { h, ICONS } from "./dom";
import { formatUGX } from "../game/economy";
import * as S from "./sheets";
import { albumSheet } from "../snaps/ui";
import type { GameApi, SheetSpec } from "./sheets";
import { landSheet } from "./landsheet";

export function moreSheet(G: GameApi): SheetSpec {
  return {
    kind: "more",
    eyebrow: "Ug Life",
    title: "More",
    body: () => {
      const row = (icon: string, title: string, sub: string, open: () => void) => {
        const b = h("button", { class: "menu-row", type: "button" }, h("span", { class: "menu-ico", html: icon }), h("span", {}, h("b", {}, title), h("small", {}, sub)));
        b.addEventListener("click", open);
        return b;
      };
      return h("div", { class: "sheet-body" },
        h("div", { class: "menu" },
          row(ICONS.tag, "Your Ug Tag", "Name, look, status and socials", () => G.openSheet(S.tagSheet(G, false))),
          row(ICONS.goals, "Street goals", "Things to do, with rewards to claim", () => G.openSheet(S.goalsSheet(G))),
          row(ICONS.land, "Kampala land", "Buy cheap plots, build, collect rent. One area is hot today", () => G.openSheet(landSheet(G))),
          row(ICONS.trophy, "Top of the street", "Richest, highest level, best snappers", () => G.openSheet(leaderboardSheet(G))),
          row(ICONS.camera, "Street Snaps", "Turn a real street photo into art", () => G.openSheet(albumSheet(G))),
          row(ICONS.share, "Invite friends", "Share your card; you both get UGX when they join", () => G.openSheet(S.shareSheet(G))),
          row(ICONS.sound, "Sound and settings", "Music, street voices, lite mode", () => {
            G.openSheet(S.helpSheet(G));
            document.getElementById("set-sound")?.closest("label")?.scrollIntoView({ block: "center" });
          }),
          row(ICONS.help, "Help", "Questions, report a problem, move to a new phone", () => G.openSheet(S.helpSheet(G)))));
    },
  };
}

export function leaderboardSheet(G: GameApi): SheetSpec {
  return {
    kind: "leaderboard",
    eyebrow: "This week",
    title: "Top of the street",
    body: () => {
      const body = h("div", { class: "sheet-body" }, h("p", { class: "muted" }, "Loading…"));
      G.track("leaderboard_viewed");
      if (!G.online()) {
        body.replaceChildren(h("div", { class: "notice" }, "The leaderboard needs a connection. Your own progress is safe on this phone."));
        return body;
      }
      void G.api.leaderboard().then((b) => {
        if (!b) {
          body.replaceChildren(h("div", { class: "notice" }, "Couldn't load the leaderboard. Try again in a minute."));
          return;
        }
        const me = G.api.playerId;
        const table = (title: string, rows: { id?: string; name: string; value: string }[]) =>
          h("div", { class: "board" }, h("h3", {}, title),
            rows.length ? h("ol", {}, rows.map((r, i) => h("li", { class: r.id && r.id === me ? "me" : "" }, h("span", { class: "rank" }, i < 3 ? ["🥇", "🥈", "🥉"][i] : String(i + 1)), h("span", { class: "nm" }, r.name), h("span", { class: "val" }, r.value))))
              : h("p", { class: "muted small" }, "Nobody yet. Be the first!"));
        body.replaceChildren(
          table("Most UGX", b.rich.map((r) => ({ id: r.id, name: r.name, value: formatUGX(r.balance) }))),
          table("Highest level", b.levels.map((r) => ({ id: r.id, name: r.name, value: `Lv ${r.level}` }))),
          table("Biggest landlords", (b.landlords ?? []).map((r) => ({ id: r.id, name: r.name, value: `${r.plots} plots` }))),
          table("Best street snappers", b.snappers.map((r) => ({ name: r.name, value: `${r.n} snaps` }))),
          table("Friendliest today", b.talkers.map((r) => ({ name: r.name, value: `${r.n} hellos` }))),
          h("p", { class: "muted small" }, "Players who played in the last 7 days. Ghost mode keeps you off the board."));
      });
      return body;
    },
  };
}
