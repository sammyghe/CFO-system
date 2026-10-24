import "./style.css";
import { Game } from "./game";

function showError(message: string) {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.hidden = false;
  boot.className = "error";
  boot.replaceChildren();
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "logo";
  title.textContent = "Ug Life";
  const p = document.createElement("p");
  p.textContent = message;
  const btn = document.createElement("button");
  btn.textContent = "Reload";
  btn.addEventListener("click", () => location.reload());
  wrap.append(title, p, btn);
  boot.append(wrap);
}

// Remember who invited this player (from ?ref=...), so they're credited when the account is made.
try {
  const ref = new URLSearchParams(location.search).get("ref");
  if (ref && /^p_[a-z0-9]{6,40}$/.test(ref) && !localStorage.getItem("uglife.token")) localStorage.setItem("uglife.ref", ref);
} catch {
  /* storage blocked */
}

function boot() {
  const canvas = document.getElementById("world") as HTMLCanvasElement | null;
  if (!canvas || !canvas.getContext) {
    showError("This browser can't draw the street. Try Chrome or update your browser.");
    return;
  }
  try {
    const game = new Game(canvas);
    game.start();
    // QA hook for automated play tests: open the game with ?debug=1
    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { ug: Game }).ug = game;
    document.getElementById("boot")!.hidden = true;
  } catch (e) {
    console.error(e);
    showError("The street didn't load. Check your connection and reload. Your progress on this phone is safe.");
  }
}

window.addEventListener("error", (e) => console.error("[ug-life]", e.error ?? e.message));

if (import.meta.env.MODE !== "single" && "serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

boot();
