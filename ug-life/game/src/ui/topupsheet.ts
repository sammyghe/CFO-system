// The wallet: add real money as game shillings, with mobile money (Flutterwave, when
// the business account is set up) or crypto (USDT on TRON, straight to the game's own
// address). One way only: game shillings can't be cashed out, sold or bet.

import qrcode from "qrcode-generator";
import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { CRYPTO_PACKS, DEFAULT_USD_UGX, TOPUP_DAILY_LIMIT, TOPUP_PACKS, cryptoCredit } from "../content/topup";
import type { CryptoDeposit } from "../net/api";
import type { GameApi, SheetSpec } from "./sheets";

const PENDING_KEY = "uglife.crypto";

/** 5037100 → "5.0371" (always 4 decimals: the last digits are how we know it's yours). */
export function usdtText(micro: number) {
  return (micro / 1_000_000).toFixed(4);
}

export function savedDeposit(): CryptoDeposit | null {
  try {
    const d = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as CryptoDeposit | null;
    return d && d.until > Date.now() ? d : null;
  } catch {
    return null;
  }
}

export function forgetDeposit() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked */
  }
}

function rememberDeposit(d: CryptoDeposit) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(d));
  } catch {
    /* storage blocked */
  }
}

function copyButton(G: GameApi, label: string, value: string) {
  const b = h("button", { class: "btn small", type: "button" }, label);
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      b.textContent = "Copied ✓";
    } catch {
      G.toast("Couldn't copy. Press and hold the text to copy it.", "info");
    }
  });
  return b;
}

export function topUpSheet(G: GameApi, tab: "crypto" | "mobile" = G.cryptoEnabled() || !G.topUpEnabled() ? "crypto" : "mobile"): SheetSpec {
  let deposit = savedDeposit();
  let timer = 0;
  let status = "";
  const spec: SheetSpec = {
    kind: "topup",
    eyebrow: "Wallet",
    title: "Add money",
    onClose: () => clearInterval(timer),
    body: () => {
      const body = h("div", { class: "sheet-body wallet" });
      body.append(h("div", { class: "wallet-balance" }, h("span", { class: "muted small" }, "Your game shillings"), h("b", {}, formatUGX(balanceOf(G.state.ledger)))));
      const tabs = h("div", { class: "chips" });
      for (const [id, label] of [["crypto", "💲 Crypto (USDT)"], ["mobile", "📱 Mobile money"]] as const) {
        const b = h("button", { class: "chip", type: "button", "aria-pressed": String(tab === id) }, label);
        b.addEventListener("click", () => G.openSheet(topUpSheet(G, id)));
        tabs.append(b);
      }
      body.append(tabs);
      if (tab === "mobile") mobile(body);
      else crypto(body);
      body.append(h("p", { class: "muted small" }, `Game shillings are for the game only: no cash-out, no selling, no betting. Up to UGX ${TOPUP_DAILY_LIMIT.toLocaleString()} a day. Never send money to another player: Ug Life staff will never ask you to.`));
      return body;
    },
  };

  function mobile(body: HTMLElement) {
    if (!G.topUpEnabled()) {
      body.append(h("div", { class: "notice" }, "MTN and Airtel mobile money top-ups are coming soon. Until then, use crypto or earn everything by playing."));
      return;
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
    body.append(list, h("p", { class: "muted small" }, "Payments are handled by Flutterwave; we never see your PIN."));
  }

  function crypto(body: HTMLElement) {
    if (!G.cryptoEnabled()) {
      body.append(h("div", { class: "notice" }, "Crypto top-ups (USDT) are coming soon. Until then, everything in Ug Life can be earned by playing."));
      return;
    }
    if (deposit) return waiting(body, deposit);
    const rate = G.api.config?.usdUgx ?? DEFAULT_USD_UGX;
    body.append(h("p", {}, "Send USDT on the TRON network (TRC20) from Binance, Trust Wallet or any wallet. It lands in a minute or two."));
    const list = h("div", { class: "list" });
    for (const p of CRYPTO_PACKS) {
      const { credit } = cryptoCredit(p, rate);
      const b = h("button", { class: "btn small", type: "button" }, `Send $${p.usd}`);
      b.addEventListener("click", async () => {
        b.disabled = true;
        const r = await G.api.cryptoStart(p.id);
        b.disabled = false;
        if ("error" in r) {
          G.toast(r.error, "bad");
          return;
        }
        G.track("topup_started");
        deposit = r;
        rememberDeposit(r);
        G.openSheet(spec);
      });
      list.append(h("div", { class: "go-row" },
        h("div", { class: "go-name" }, h("b", {}, `${formatUGX(credit)} game shillings`), h("span", { class: "muted small" }, `${p.usd} USDT${p.bonus ? ` · +${p.bonus}% bonus` : ""}`)),
        h("div", { class: "go-btns" }, b)));
    }
    body.append(list,
      h("details", { class: "how" }, h("summary", {}, "No USDT yet? How to get it with mobile money"),
        h("ol", { class: "small" },
          h("li", {}, "In the Binance app, open P2P and buy USDT with MTN or Airtel mobile money."),
          h("li", {}, "Come back here and pick a pack. You get an address and an exact amount."),
          h("li", {}, "In Binance: Withdraw → USDT → network TRON (TRC20) → paste the address and amount."))));
  }

  function waiting(body: HTMLElement, d: CryptoDeposit) {
    const amount = usdtText(d.micro);
    const qr = qrcode(0, "M");
    qr.addData(d.address);
    qr.make();
    const mins = Math.max(0, Math.round((d.until - Date.now()) / 60_000));
    const statusEl = h("div", { class: "notice", role: "status" }, status || "⏳ Waiting for your USDT… keep this open or come back later.");
    body.append(
      h("div", { class: "crypto-step" }, h("span", { class: "muted small" }, "1. Send exactly"), h("b", { class: "crypto-amount" }, `${amount} USDT`), copyButton(G, "Copy amount", amount)),
      h("p", { class: "small warn" }, `The last digits (${amount.slice(-4)}) are how we know it's yours. If your app takes a fee out of the amount, make sure exactly ${amount} arrives.`),
      h("div", { class: "crypto-step" }, h("span", { class: "muted small" }, "2. On the TRON network (TRC20), to"), h("code", { class: "crypto-address" }, d.address), copyButton(G, "Copy address", d.address)),
      h("img", { class: "crypto-qr", src: qr.createDataURL(5, 2), alt: "QR code of the address", width: "180", height: "180" }),
      h("p", { class: "small" }, `3. You get ${formatUGX(d.credit)} game shillings as soon as it arrives. This address and amount work for ${mins} more minutes.`),
      statusEl);
    const check = h("button", { class: "btn", type: "button" }, "I've sent it: check now");
    const cancel = h("button", { class: "btn ghost small", type: "button" }, "Pick another pack");
    cancel.addEventListener("click", () => {
      forgetDeposit();
      deposit = null;
      status = "";
      G.openSheet(spec);
    });
    const poll = async () => {
      const r = await G.api.cryptoCheck(d.ref);
      if (!r) return;
      if ("credit" in r) {
        clearInterval(timer);
        forgetDeposit();
        deposit = null;
        G.creditTopUp(d.ref, r.credit);
        status = "";
        G.closeSheet();
        return;
      }
      if ("expired" in r) {
        clearInterval(timer);
        forgetDeposit();
        deposit = null;
        status = "";
        G.toast("That deposit timed out. If you sent USDT, tap Help → My progress or money and include your transaction ID.", "info");
        G.openSheet(spec);
        return;
      }
      status = r.slow ? "⏳ The blockchain is slow to answer. We'll keep looking." : `⏳ Not arrived yet (checked ${new Date().toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" })}). Most transfers take 1–3 minutes.`;
      statusEl.textContent = status;
    };
    check.addEventListener("click", () => void poll());
    body.append(h("div", { class: "row-btns" }, check, cancel));
    clearInterval(timer);
    timer = window.setInterval(() => void poll(), 20_000);
  }

  return spec;
}
