import { drawPerson } from "../world/art";
import { formatUGX, levelForXp } from "../game/economy";
import { balanceOf } from "../game/ledger";
import { PLATFORMS } from "../game/moderation";
import type { PlayerState } from "../game/state";

/** The Ug Tag card people post to WhatsApp Status and TikTok. 1080 x 1350 (4:5). */
export function renderShareCard(state: PlayerState, joinUrl: string): HTMLCanvasElement {
  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const font = (w: number, s: number) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  g.fillStyle = "#1f4fd1";
  g.fillRect(0, 0, W, H);
  // checker bands
  const band = (y: number) => {
    const s = 30;
    for (let x = 0; x < W; x += s) for (let k = 0; k < 2; k++) {
      g.fillStyle = (x / s + k) % 2 ? "#ffffff" : "#1f4fd1";
      g.fillRect(x, y + k * s, s, s);
    }
  };
  band(150);
  band(H - 230);

  g.fillStyle = "#fff";
  g.font = font(900, 96);
  g.fillText("UG LIFE", 70, 120);
  g.font = font(600, 34);
  g.globalAlpha = 0.85;
  g.textAlign = "right";
  g.fillText("Wandegeya · Kampala", W - 70, 112);
  g.textAlign = "left";
  g.globalAlpha = 1;

  // card body
  g.fillStyle = "#ffffff";
  roundRect(g, 60, 260, W - 120, H - 540, 44);
  g.fill();

  // avatar on a laterite ground disc
  g.fillStyle = "#e6edfd";
  g.beginPath(); g.arc(250, 470, 150, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#b4442a";
  g.beginPath(); g.ellipse(250, 585, 120, 34, 0, 0, Math.PI * 2); g.fill();
  drawPerson(g, 250, 590, state.look, 0, false, false, 7.2, false);

  const level = levelForXp(state.xp);
  const name = state.tag.ghost ? "A Ug Life resident" : state.tag.name || "New resident";
  g.fillStyle = "#13202b";
  g.font = font(900, fit(g, name, 520, 76, 900));
  g.fillText(name, 440, 420);
  g.fillStyle = "#1f4fd1";
  roundRect(g, 440, 450, 170, 56, 28);
  g.fill();
  g.fillStyle = "#fff";
  g.font = font(800, 30);
  g.fillText(`Level ${level}`, 466, 488);
  if (state.tag.status && !state.tag.ghost) {
    g.fillStyle = "#5b6873";
    g.font = font(500, 32);
    wrapText(g, state.tag.status, 440, 560, 540, 40, 2);
  }

  // stats
  const stats: [string, string][] = [
    [String(state.stats.deliveries), "deliveries"],
    [formatUGX(balanceOf(state.ledger)).replace("UGX ", ""), "UGX saved"],
    [String(state.stats.daysVisited), state.stats.daysVisited === 1 ? "day on the street" : "days on the street"],
  ];
  stats.forEach(([v, l], i) => {
    const x = 100 + i * 300;
    g.fillStyle = "#f3f5f7";
    roundRect(g, x, 680, 270, 150, 26);
    g.fill();
    g.fillStyle = "#13202b";
    g.font = font(900, fit(g, v, 230, 54, 900));
    g.fillText(v, x + 22, 755);
    g.fillStyle = "#5b6873";
    g.font = font(600, 24);
    g.fillText(l, x + 22, 800);
  });

  // kiosk + socials
  let y = 900;
  if (state.kiosk) {
    g.fillStyle = state.kiosk.color;
    roundRect(g, 100, y, W - 200, 90, 22);
    g.fill();
    g.fillStyle = "#fff";
    g.font = font(900, fit(g, state.kiosk.name, W - 280, 44, 900));
    g.fillText(state.kiosk.name, 130, y + 58);
    y += 120;
  }
  if (!state.tag.ghost && state.tag.socials.length) {
    g.fillStyle = "#5b6873";
    g.font = font(700, 30);
    const line = state.tag.socials.map((s) => `${PLATFORMS.find((p) => p.id === s.platform)?.label}: @${s.handle}`).join("   ");
    g.fillText(fitText(g, line, W - 200), 100, y + 30);
  }

  g.fillStyle = "#ffffff";
  g.font = font(900, 54);
  g.fillText("Find me on the street", 70, H - 80);
  g.font = font(600, 30);
  g.globalAlpha = 0.85;
  g.fillText(joinUrl.replace(/^https?:\/\//, ""), 70, H - 34);
  g.globalAlpha = 1;
  return c;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fit(g: CanvasRenderingContext2D, text: string, max: number, size: number, weight: number) {
  let s = size;
  g.font = `${weight} ${s}px system-ui, sans-serif`;
  while (g.measureText(text).width > max && s > 18) {
    s -= 2;
    g.font = `${weight} ${s}px system-ui, sans-serif`;
  }
  return s;
}

function fitText(g: CanvasRenderingContext2D, text: string, max: number) {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number, lines: number) {
  const words = text.split(" ");
  let line = "";
  let n = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > max && line) {
      g.fillText(n === lines - 1 ? fitText(g, line + " " + w, max) : line, x, y + n * lh);
      n++;
      line = w;
      if (n >= lines) return;
    } else line = test;
  }
  if (line && n < lines) g.fillText(line, x, y + n * lh);
}
