// Billboards: see who holds each one, rent a free one for your kiosk or message,
// and (for real brands) how to book one.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { checkFreeText } from "../game/moderation";
import { BILLBOARD_COLORS, BILLBOARD_MAX_DAYS, BILLBOARD_SLOTS, BILLBOARD_SUB, BILLBOARD_TEXT, type BillboardAd } from "../content/billboards";
import * as S from "./sheets";
import type { GameApi, SheetSpec } from "./sheets";

function until(t: number) {
  return new Date(t).toLocaleString("en-GB", { timeZone: "Africa/Kampala", weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function billboardSheet(G: GameApi, focus?: string): SheetSpec {
  const spec: SheetSpec = {
    kind: "billboards",
    eyebrow: "Be seen on the street",
    title: "Billboards",
    body: () => {
      const s = G.state;
      const ads = G.billboards();
      const body = h("div", { class: "sheet-body" });
      body.append(h("p", { class: "muted small" }, "Everyone on the street sees these. Rent one for your kiosk, your music or a shout-out. Pay in game shillings, by the day."));
      const slots = focus ? [...BILLBOARD_SLOTS].sort((a) => (a.id === focus ? -1 : 1)) : BILLBOARD_SLOTS;
      for (const slot of slots) {
        const ad: BillboardAd | undefined = ads.find((a) => a.slot === slot.id && a.until > G.now());
        const card = h("div", { class: `board-card${slot.id === focus ? " focus" : ""}` }, h("b", {}, slot.name));
        if (ad) {
          card.append(h("div", { class: "ad-preview", style: `background:${ad.color}` }, h("b", {}, ad.text), ad.sub ? h("span", {}, ad.sub) : null));
          card.append(h("span", { class: "muted small" }, ad.kind === "brand" ? `Sponsored by ${ad.owner} until ${until(ad.until)}` : `${ad.ownerId === G.api.playerId ? "Yours" : `Rented by ${ad.owner}`} until ${until(ad.until)}`));
          if (ad.kind === "brand" && ad.link) card.append(h("a", { class: "btn small ghost", href: ad.link, target: "_blank", rel: "noopener noreferrer sponsored" }, `Visit ${ad.owner}`));
        } else {
          card.append(rentForm(G, slot.id, slot.pricePerDay, balanceOf(s.ledger), () => G.openSheet(spec)));
        }
        body.append(card);
      }
      const brands = h("button", { class: "btn ghost block", type: "button" }, "A real business? Advertise on Ug Life");
      brands.addEventListener("click", () => G.openSheet(S.helpSheet(G, "Advertising: I'd like to put my business on a Ug Life billboard. Business name and what we sell: ")));
      body.append(brands);
      return body;
    },
  };
  return spec;
}

function rentForm(G: GameApi, slot: string, perDay: number, balance: number, redraw: () => void) {
  const text = h("input", { maxlength: String(BILLBOARD_TEXT), placeholder: "Big text, e.g. AMINA JUICE", autocomplete: "off", "aria-label": "Billboard text" });
  if (G.state.kiosk) text.value = G.state.kiosk.name.slice(0, BILLBOARD_TEXT);
  const sub = h("input", { maxlength: String(BILLBOARD_SUB), placeholder: "Small text, e.g. Fresh passion juice, plot D", autocomplete: "off", "aria-label": "Billboard small text" });
  let color: string = BILLBOARD_COLORS[0];
  let days = 1;
  const preview = h("div", { class: "ad-preview", style: `background:${color}` }, h("b", {}, text.value || "YOUR TEXT"), h("span", {}, ""));
  const price = h("b", {});
  const btn = h("button", { class: "btn", type: "button" }, "Rent");
  const err = h("div", { class: "err", role: "alert" });
  const update = () => {
    preview.style.background = color;
    (preview.firstChild as HTMLElement).textContent = text.value.trim() || "YOUR TEXT";
    (preview.lastChild as HTMLElement).textContent = sub.value.trim();
    price.textContent = formatUGX(perDay * days);
    btn.disabled = balance < perDay * days;
  };
  text.addEventListener("input", update);
  sub.addEventListener("input", update);
  const colors = h("div", { class: "swatches" }, BILLBOARD_COLORS.map((c) => {
    const b = h("button", { class: "swatch", type: "button", style: `background:${c}`, "aria-label": c, "aria-pressed": String(c === color) });
    b.addEventListener("click", () => { color = c; colors.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); update(); });
    return b;
  }));
  const dayChips = h("div", { class: "chips" }, Array.from({ length: BILLBOARD_MAX_DAYS }, (_, i) => {
    const b = h("button", { class: "chip", type: "button", "aria-pressed": String(i === 0) }, `${i + 1} day${i ? "s" : ""}`);
    b.addEventListener("click", () => { days = i + 1; dayChips.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); update(); });
    return b;
  }));
  btn.addEventListener("click", async () => {
    const t = checkFreeText(text.value, BILLBOARD_TEXT), u = checkFreeText(sub.value, BILLBOARD_SUB);
    if (!t.ok || !u.ok) { err.textContent = (!t.ok ? t.reason : !u.ok ? u.reason : ""); return; }
    if (t.value.length < 2) { err.textContent = "Write what the billboard says."; return; }
    btn.disabled = true;
    btn.textContent = "Renting…";
    const ok = await G.rentBillboard(slot, { text: t.value, sub: u.value, color, days });
    if (ok) redraw();
    else { btn.disabled = false; btn.textContent = "Rent"; }
  });
  update();
  return h("div", { class: "rent-form" }, preview, text, sub, colors, dayChips, h("div", { class: "bottom" }, h("span", {}, "Price: ", price), btn), err,
    h("span", { class: "muted small" }, `${formatUGX(perDay)} a day. No links or phone numbers. Rude or scam billboards are taken down without a refund.`));
}
