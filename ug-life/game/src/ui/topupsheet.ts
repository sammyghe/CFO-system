// Top up game shillings with mobile money. Shown as "coming soon" until the server
// has a payment provider and the top-up switch is on.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { TOPUP_DAILY_LIMIT, TOPUP_PACKS } from "../content/topup";
import type { GameApi, SheetSpec } from "./sheets";

export function topUpSheet(G: GameApi): SheetSpec {
  return {
    kind: "topup",
    eyebrow: "Mobile money",
    title: "Top up",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      if (!G.topUpEnabled()) {
        body.append(
          h("div", { class: "notice" }, "Top-ups with MTN and Airtel mobile money are coming soon. Until then, everything in Ug Life can be earned by playing."),
          h("p", { class: "muted small" }, "When they open: you pay real money and get game shillings to spend in the game. Game shillings can't be cashed out, sold or bet."));
        return body;
      }
      body.append(h("p", {}, "Pay with MTN or Airtel mobile money and get game shillings straight away."));
      const list = h("div", { class: "list" });
      for (const p of TOPUP_PACKS) {
        const b = h("button", { class: "btn small", type: "button" }, `Pay UGX ${p.price.toLocaleString()}`);
        b.addEventListener("click", async () => {
          b.disabled = true;
          b.textContent = "Opening…";
          await G.startTopUp(p.id);
          b.disabled = false;
          b.textContent = `Pay UGX ${p.price.toLocaleString()}`;
        });
        list.append(h("div", { class: "go-row" },
          h("div", { class: "go-name" }, h("b", {}, `${formatUGX(p.credit)} game shillings`), h("span", { class: "muted small" }, p.credit > p.price ? `+${Math.round((p.credit / p.price - 1) * 100)}% bonus` : "")),
          h("div", { class: "go-btns" }, b)));
      }
      body.append(list,
        h("p", { class: "muted small" }, `Game shillings are for the game only: no cash-out, no selling, no betting. Up to UGX ${TOPUP_DAILY_LIMIT.toLocaleString()} a day. Payments are handled by Flutterwave; we never see your PIN. Problems? Help → My progress or money.`));
      return body;
    },
  };
}
