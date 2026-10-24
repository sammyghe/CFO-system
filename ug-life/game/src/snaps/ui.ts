// Street Snaps panels: take or pick a photo, blur faces and number plates,
// turn it into street art, then keep it or send it to the community board.

import { h } from "../ui/dom";
import { AREAS, checkSnapDetails, rewardSnap, type SnapMeta } from "../game/snaps";
import { pixelateCircle, toonify, type Img, type ToonOptions } from "./toon";
import ToonWorker from "./toon.worker?worker&inline";
import { deleteSnap, listSnaps, saveSnap, type SnapRecord } from "./store";
import type { GameApi, SheetSpec } from "../ui/sheets";

const MAX_SIDE = 800;
const STYLES: { id: string; label: string; realism: number }[] = [
  { id: "real", label: "More real", realism: 0.6 },
  { id: "balanced", label: "Balanced", realism: 0.35 },
  { id: "art", label: "More art", realism: 0.12 },
];

const RULES = [
  "Photograph streets, shops, roads and buildings. No selfies.",
  "Blur any face you can recognise and every number plate. Tap the photo to blur.",
  "No children, no inside of people's homes, no military or police sites.",
  "Only photos you took yourself.",
];

function runToon(img: Img, options: ToonOptions): Promise<Img> {
  return new Promise((resolve) => {
    try {
      const w = new ToonWorker();
      const copy = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
      w.onmessage = (e: MessageEvent<Img>) => {
        resolve(e.data);
        w.terminate();
      };
      w.onerror = () => {
        w.terminate();
        resolve(toonify(img, options));
      };
      w.postMessage({ img: copy, options }, [copy.data.buffer]);
    } catch {
      resolve(toonify(img, options)); // no worker support: do it here
    }
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((webp) => {
      if (webp && webp.type === "image/webp") return resolve(webp);
      canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error("encode failed"))), "image/jpeg", 0.85);
    }, "image/webp", 0.82);
  });
}

async function loadImage(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function snapSheet(G: GameApi): SheetSpec {
  return {
    kind: "snap",
    eyebrow: "Street Snaps",
    title: "Snap a real street",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      const cam = h("input", { type: "file", accept: "image/*", capture: "environment", id: "snap-cam", hidden: true });
      const pick = h("input", { type: "file", accept: "image/*", id: "snap-pick", hidden: true });
      const take = h("button", { class: "btn block", type: "button" }, "Take a photo");
      const choose = h("button", { class: "btn ghost block", type: "button" }, "Choose from your gallery");
      take.addEventListener("click", () => cam.click());
      choose.addEventListener("click", () => pick.click());
      const onFile = async (input: HTMLInputElement) => {
        const f = input.files?.[0];
        if (!f) return;
        if (!f.type.startsWith("image/")) return G.toast("That isn't a photo.", "bad");
        try {
          const canvas = await loadImage(f);
          editor(G, body, canvas);
        } catch {
          G.toast("Couldn't open that photo. Try another one.", "bad");
        }
      };
      cam.addEventListener("change", () => onFile(cam));
      pick.addEventListener("change", () => onFile(pick));
      body.append(
        h("p", {}, "Photograph a real Kampala street. Your phone turns it into street art for the game. Snaps from each area decide which neighbourhood gets built next."),
        h("div", { class: "notice" }, h("b", {}, "Photo rules"), h("ul", { class: "rules" }, RULES.map((r) => h("li", {}, r)))),
        take, choose, cam, pick,
        h("p", { class: "muted small" }, "The photo is processed on your phone. Nothing is uploaded unless you choose to share it, and every shared snap is checked by a person before anyone else sees it."));
      return body;
    },
  };
}

function editor(G: GameApi, body: HTMLElement, source: HTMLCanvasElement) {
  const ctx = source.getContext("2d")!;
  const history: ImageData[] = [];
  const view = h("canvas", { class: "snap-canvas", width: source.width, height: source.height, "aria-label": "Your photo. Tap to blur a face or number plate." });
  const vctx = view.getContext("2d")!;
  const draw = () => vctx.drawImage(source, 0, 0);
  draw();
  view.addEventListener("click", (e) => {
    const rect = view.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * source.width;
    const y = ((e.clientY - rect.top) / rect.height) * source.height;
    const data = ctx.getImageData(0, 0, source.width, source.height);
    history.push(ctx.getImageData(0, 0, source.width, source.height));
    if (history.length > 12) history.shift();
    pixelateCircle(data, x, y, Math.max(source.width, source.height) * 0.07, Math.max(8, Math.round(source.width / 45)));
    ctx.putImageData(data, 0, 0);
    draw();
  });
  const undo = h("button", { class: "btn ghost", type: "button" }, "Undo blur");
  undo.addEventListener("click", () => {
    const prev = history.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      draw();
    }
  });
  const go = h("button", { class: "btn", type: "button" }, "Make it street art");
  go.addEventListener("click", () => stylize(G, body, source, 1));
  body.replaceChildren(
    h("p", {}, h("b", {}, "Step 1: blur faces and number plates. "), "Tap anywhere on the photo to blur it."),
    view,
    h("div", { class: "row-btns" }, undo, go));
}

async function stylize(G: GameApi, body: HTMLElement, source: HTMLCanvasElement, styleIdx: number) {
  const status = h("div", { class: "notice", role: "status" }, "Painting your street…");
  body.replaceChildren(status);
  const t0 = performance.now();
  const img = source.getContext("2d")!.getImageData(0, 0, source.width, source.height);
  const out = await runToon(img, { realism: STYLES[styleIdx].realism });
  const art = h("canvas", { class: "snap-canvas", width: out.width, height: out.height, "aria-label": "Your street as art" });
  art.getContext("2d")!.putImageData(new ImageData(out.data as unknown as Uint8ClampedArray<ArrayBuffer>, out.width, out.height), 0, 0);
  G.track("snap_made", { ms: Math.round(performance.now() - t0) });

  const styles = h("div", { class: "chips", role: "group", "aria-label": "Style" });
  STYLES.forEach((s, i) => {
    const b = h("button", { class: "chip", type: "button", "aria-pressed": String(i === styleIdx) }, s.label);
    b.addEventListener("click", () => stylize(G, body, source, i));
    styles.append(b);
  });
  const compare = h("button", { class: "btn ghost small", type: "button" }, "Hold to see the photo");
  const showOrig = (on: boolean) => {
    const c = art.getContext("2d")!;
    if (on) c.drawImage(source, 0, 0);
    else c.putImageData(new ImageData(out.data as unknown as Uint8ClampedArray<ArrayBuffer>, out.width, out.height), 0, 0);
  };
  compare.addEventListener("pointerdown", () => showOrig(true));
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => compare.addEventListener(ev, () => showOrig(false)));

  const area = h("select", { id: "snap-area" }, h("option", { value: "" }, "Choose the area"), AREAS.map((a) => h("option", { value: a }, a)));
  const place = h("input", { id: "snap-place", maxlength: "20", placeholder: "e.g. Wandegeya market" });
  const consent = h("input", { type: "checkbox", id: "snap-consent" });
  const share = h("input", { type: "checkbox", id: "snap-share", checked: G.api.available });
  const err = h("div", { class: "err", role: "alert" });
  const save = h("button", { class: "btn block", type: "button" }, "Save snap");
  save.addEventListener("click", async () => {
    err.textContent = "";
    const d = checkSnapDetails(area.value, place.value);
    if (!d.ok) { err.textContent = d.reason; return; }
    if (share.checked && !consent.checked) { err.textContent = "Tick the photo rules box to share."; return; }
    save.disabled = true;
    try {
      const blob = await toBlob(art);
      const now = G.now();
      const rec: SnapRecord = {
        id: `s-${now.toString(36)}`, area: area.value, place: d.place, createdAt: now, width: out.width, height: out.height,
        status: share.checked && G.api.available ? "queued" : "local", blob,
      };
      await saveSnap(rec);
      G.result(rewardSnap(G.state, now));
      G.changed();
      G.onSnap(rec);
      G.openSheet(albumSheet(G));
    } catch {
      save.disabled = false;
      err.textContent = "Couldn't save the snap on this phone. Free some space and try again.";
    }
  });

  body.replaceChildren(
    art,
    h("div", { class: "row-btns" }, compare),
    h("div", { class: "field" }, h("label", {}, "Style"), styles),
    h("div", { class: "field" }, h("label", { for: "snap-area" }, "Area"), area),
    h("div", { class: "field" }, h("label", { for: "snap-place" }, "Place"), place),
    h("label", { class: "toggle", for: "snap-share" }, h("span", {}, h("b", {}, "Share to the community board"), h("small", {}, G.api.available ? "A person checks it before anyone else sees it." : "Sharing works on the live site. This preview keeps snaps on your phone.")), share),
    h("label", { class: "toggle", for: "snap-consent" }, h("span", {}, h("b", {}, "I took this photo and followed the photo rules"), h("small", {}, "Faces and number plates are blurred, no children, no private homes.")), consent),
    err, save);
}

const STATUS_TEXT: Record<SnapMeta["status"], string> = {
  local: "On your phone",
  queued: "Waiting to upload",
  pending: "Being checked",
  approved: "On the board",
  rejected: "Not approved",
};

export function albumSheet(G: GameApi): SheetSpec {
  return {
    kind: "album",
    eyebrow: "Street Snaps",
    title: "Kampala, street by street",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      const snap = h("button", { class: "btn block", type: "button" }, "Snap a street");
      snap.addEventListener("click", () => G.openSheet(snapSheet(G)));
      const board = h("div", { class: "field" }, h("label", {}, "Next neighbourhood to build"), h("p", { class: "muted small" }, "Loading…"));
      const community = h("div", { class: "field" }, h("label", {}, "Community board"));
      const mine = h("div", { class: "field" }, h("label", {}, "Your snaps"));
      body.append(snap, board, community, mine);

      void (async () => {
        const own = await listSnaps();
        const online = await G.api.photos();
        // leaderboard: server counts, or your own snaps when offline
        const counts = online?.areas?.length ? online.areas : Object.entries(own.reduce<Record<string, number>>((a, s) => ((a[s.area] = (a[s.area] ?? 0) + 1), a), {})).map(([area, n]) => ({ area, n }));
        counts.sort((a, b) => b.n - a.n);
        const max = Math.max(1, ...counts.map((c) => c.n));
        board.replaceChildren(
          h("label", {}, "Next neighbourhood to build"),
          counts.length
            ? h("div", { class: "list" }, counts.slice(0, 5).map((c, i) => h("div", { class: "bar-row" }, h("span", {}, `${i + 1}. ${c.area}`), h("span", { class: "bar" }, h("i", { style: `width:${Math.round((c.n / max) * 100)}%` })), h("b", {}, String(c.n)))))
            : h("p", { class: "muted small" }, "No snaps yet. The first area with 25 approved snaps gets built next."),
          h("p", { class: "muted small" }, online ? "Counts approved snaps from every player." : "Showing your own snaps. Community counts load on the live site."));

        community.replaceChildren(h("label", {}, "Community board"));
        if (online?.photos.length) {
          const grid = h("div", { class: "snap-grid" });
          for (const p of online.photos) {
            const fig = h("figure", { class: "snap" }, h("img", { src: G.api.photoUrl(p.id), alt: `${p.place}, ${p.area}`, loading: "lazy", width: p.width, height: p.height }), h("figcaption", {}, h("b", {}, p.place), ` · ${p.area} · ${p.author}`));
            grid.append(fig);
          }
          community.append(grid);
        } else community.append(h("p", { class: "muted small" }, online ? "No approved snaps yet. Be the first." : "The community board shows on the live site."));

        mine.replaceChildren(h("label", {}, `Your snaps (${own.length})`));
        if (!own.length) mine.append(h("p", { class: "muted small" }, "Snaps you take appear here, even without signal."));
        const grid = h("div", { class: "snap-grid" });
        for (const s of own) {
          const url = URL.createObjectURL(s.blob);
          const del = h("button", { class: "btn danger small", type: "button" }, "Delete");
          let armed = false;
          del.addEventListener("click", async () => {
            if (!armed) { armed = true; del.textContent = "Tap again"; return; }
            await deleteSnap(s.id);
            G.onSnap(null);
            G.openSheet(albumSheet(G));
          });
          grid.append(h("figure", { class: "snap" }, h("img", { src: url, alt: `${s.place}, ${s.area}`, width: s.width, height: s.height }),
            h("figcaption", {}, h("b", {}, s.place), ` · ${s.area}`, h("br", {}), h("span", { class: `pill ${s.status}` }, STATUS_TEXT[s.status]), s.reason ? h("span", { class: "muted small" }, ` ${s.reason}`) : null, " ", del)));
        }
        if (own.length) mine.append(grid);
      })();
      return body;
    },
  };
}
