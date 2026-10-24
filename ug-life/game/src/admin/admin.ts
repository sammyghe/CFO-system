// Ug Life Control Room: where Sammy (and the ops agents, through the same API)
// approve snaps, answer players, review flags and flip switches. Phone-friendly.

import "./admin.css";
import { h } from "../ui/dom";

const KEY = "uglife.admin";
let token = "";
try {
  token = sessionStorage.getItem(KEY) ?? "";
} catch {
  /* blocked */
}

const root = document.getElementById("admin")!;

async function api<T = Record<string, unknown>>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    signOut("That admin token didn't work.");
    throw new Error("unauthorised");
  }
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

function signOut(msg = "") {
  token = "";
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  login(msg);
}

function login(msg = "") {
  const input = h("input", { type: "password", id: "tok", placeholder: "Admin token", autocomplete: "current-password" });
  const go = h("button", { class: "btn", type: "submit" }, "Open the control room");
  const form = h("form", { class: "card login" }, h("h1", {}, "Ug Life Control Room"), h("p", { class: "muted" }, "Approve snaps, answer players, review flags. Only for Sammy and the ops agents."), input, go, msg ? h("p", { class: "err" }, msg) : null);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    token = input.value.trim();
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
    void show("today");
  });
  root.replaceChildren(form);
}

const TABS = [
  ["today", "Today"],
  ["photos", "Snaps"],
  ["tickets", "Support"],
  ["flags", "Flags"],
  ["metrics", "Numbers"],
] as const;
type Tab = (typeof TABS)[number][0];

async function show(tab: Tab) {
  const nav = h("nav", { class: "tabs" }, TABS.map(([id, label]) => {
    const b = h("button", { type: "button", class: id === tab ? "on" : "" }, label);
    b.addEventListener("click", () => void show(id));
    return b;
  }));
  const out = h("button", { type: "button", class: "link" }, "Sign out");
  out.addEventListener("click", () => signOut());
  const main = h("main", {}, h("p", { class: "muted" }, "Loading…"));
  root.replaceChildren(h("header", {}, h("b", {}, "Ug Life · Control Room"), out), nav, main);
  try {
    main.replaceChildren(await VIEWS[tab]());
  } catch (e) {
    main.replaceChildren(h("p", { class: "err" }, (e as Error).message));
  }
}


type Overview = {
  players: { total: number; active24h: number; active7d: number; new24h: number };
  photos: { pending: number; approved: number };
  tickets: { open: number; p0: number };
  reports: { open: number };
  flags: { open: number };
  economy: { circulating: number };
  config: Record<string, string>;
};

const VIEWS: Record<Tab, () => Promise<HTMLElement>> = {
  async today() {
    const o = await api<Overview>("GET", "overview");
    const stat = (n: number | string, label: string, alert = false) => h("div", { class: alert ? "stat alert" : "stat" }, h("b", {}, String(n)), h("span", {}, label));
    const toggle = (key: string, label: string, help: string, invert = false) => {
      const on = o.config[key] === "true";
      const cb = h("input", { type: "checkbox", checked: invert ? !on : on, id: `cfg-${key}` });
      cb.addEventListener("change", async () => {
        const value = invert ? !cb.checked : cb.checked;
        await api("POST", "config", { key, value: String(value) });
        void show("today");
      });
      return h("label", { class: "toggle", for: `cfg-${key}` }, h("span", {}, h("b", {}, label), h("small", {}, help)), cb);
    };
    const ann = h("input", { id: "ann", value: o.config.announcement ?? "", maxlength: "280", placeholder: "Message shown to everyone when they open the game" });
    const save = h("button", { class: "btn small", type: "button" }, "Save message");
    save.addEventListener("click", async () => {
      await api("POST", "config", { key: "announcement", value: ann.value });
      save.textContent = "Saved";
    });
    return h("div", { class: "stack" },
      o.tickets.p0 ? h("div", { class: "banner" }, `${o.tickets.p0} safety ticket(s) need you now (P0). Open Support.`) : null,
      h("div", { class: "grid" },
        stat(o.players.active24h, "players today"), stat(o.players.new24h, "new today"), stat(o.players.active7d, "this week"), stat(o.players.total, "all players"),
        stat(o.photos.pending, "snaps to check", o.photos.pending > 0), stat(o.tickets.open, "open tickets", o.tickets.open > 0),
        stat(o.flags.open + o.reports.open, "flags and reports", o.flags.open + o.reports.open > 0), stat(o.economy.circulating.toLocaleString(), "UGX held by weekly players")),
      h("h2", {}, "Switches"),
      toggle("maintenance_mode", "Maintenance mode", "Pauses saving, sign-ups and uploads. Players keep playing offline."),
      toggle("uploads_enabled", "Snap uploads", "Turn off if moderation falls behind."),
      toggle("signups_enabled", "New players", "Turn off to stop sign-ups during an attack or overload."),
      h("div", { class: "field" }, h("label", { for: "ann" }, "Announcement"), ann, save));
  },

  async photos() {
    const { photos } = await api<{ photos: { id: string; author: string; area: string; place: string; created_at: number; player_id: string }[] }>("GET", "photos?status=pending");
    const approved = await api<{ photos: { id: string; place: string; area: string; featured: number }[] }>("GET", "photos?status=approved");
    const act = async (id: string, action: string, reason?: string) => {
      await api("POST", `photos/${id}`, { action, reason });
      void show("photos");
    };
    const pending = photos.map((p) => {
      const img = h("img", { alt: `${p.place}, ${p.area}`, loading: "lazy" });
      void fetch(`/api/photo/${p.id}`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.blob()).then((b) => (img.src = URL.createObjectURL(b)));
      const ok = h("button", { class: "btn", type: "button" }, "Approve");
      ok.addEventListener("click", () => act(p.id, "approve"));
      const reasons = ["A face or number plate isn't blurred", "Not a street or place photo", "Shows a child", "Inappropriate content"];
      const sel = h("select", {}, reasons.map((r) => h("option", { value: r }, r)));
      const no = h("button", { class: "btn danger", type: "button" }, "Reject");
      no.addEventListener("click", () => act(p.id, "reject", sel.value));
      return h("div", { class: "card photo" }, img, h("div", {}, h("b", {}, p.place), ` · ${p.area} · by ${p.author}`, h("br", {}), h("small", { class: "muted" }, new Date(p.created_at).toLocaleString())), h("div", { class: "row" }, ok, sel, no));
    });
    const board = approved.photos.map((p) => {
      const feat = h("button", { class: "btn ghost small", type: "button" }, p.featured ? "Unfeature" : "Feature on billboard");
      feat.addEventListener("click", () => act(p.id, "feature"));
      const rm = h("button", { class: "btn danger small", type: "button" }, "Remove");
      rm.addEventListener("click", () => act(p.id, "remove", "Removed on request"));
      return h("div", { class: "line" }, h("span", {}, h("b", {}, p.place), ` · ${p.area}`), feat, rm);
    });
    return h("div", { class: "stack" },
      h("h2", {}, `To check (${photos.length})`),
      h("p", { class: "muted" }, "Approve only street, shop and road photos with faces and number plates blurred. When in doubt, reject."),
      pending.length ? h("div", { class: "photos" }, pending) : h("p", { class: "muted" }, "Nothing waiting. Good."),
      h("h2", {}, `On the board (${board.length})`),
      board.length ? h("div", { class: "stack" }, board) : h("p", { class: "muted" }, "No approved snaps yet."));
  },

  async tickets() {
    const { tickets } = await api<{ tickets: { id: string; category: string; priority: string; body: string; created_at: number; reply: string | null }[] }>("GET", "tickets?status=open");
    return h("div", { class: "stack" },
      h("h2", {}, `Open (${tickets.length})`),
      tickets.length ? h("div", { class: "stack" }, tickets.map((t) => {
        const reply = h("textarea", { placeholder: "Reply to the player" });
        const send = h("button", { class: "btn", type: "button" }, "Send reply");
        send.addEventListener("click", async () => {
          await api("POST", `tickets/${t.id}`, { reply: reply.value, status: "answered" });
          void show("tickets");
        });
        const close = h("button", { class: "btn ghost", type: "button" }, "Close without reply");
        close.addEventListener("click", async () => {
          await api("POST", `tickets/${t.id}`, { status: "closed" });
          void show("tickets");
        });
        return h("div", { class: `card ticket ${t.priority}` }, h("div", {}, h("span", { class: "tag" }, t.priority), " ", h("b", {}, t.category), h("small", { class: "muted" }, ` · ${new Date(t.created_at).toLocaleString()}`)), h("p", {}, t.body), reply, h("div", { class: "row" }, send, close));
      })) : h("p", { class: "muted" }, "Inbox zero."));
  },

  async flags() {
    const { flags } = await api<{ flags: { id: string; player_id: string; kind: string; detail: string; created_at: number }[] }>("GET", "flags");
    const { reports } = await api<{ reports: { id: string; target: string; reason: string; created_at: number }[] }>("GET", "reports");
    const flagRows = flags.map((f) => {
      const freeze = h("button", { class: "btn danger small", type: "button" }, "Freeze player");
      freeze.addEventListener("click", async () => {
        await api("POST", `players/${f.player_id}`, { frozen: true });
        freeze.textContent = "Frozen";
      });
      const done = h("button", { class: "btn ghost small", type: "button" }, "Resolve");
      done.addEventListener("click", async () => {
        await api("POST", `flags/${f.id}`, {});
        void show("flags");
      });
      return h("div", { class: "card" }, h("b", {}, f.kind), h("small", { class: "muted" }, ` · ${f.player_id} · ${new Date(f.created_at).toLocaleString()}`), h("p", {}, f.detail), h("div", { class: "row" }, freeze, done));
    });
    const reportRows = reports.map((r) => {
      const done = h("button", { class: "btn ghost small", type: "button" }, "Close");
      done.addEventListener("click", async () => {
        await api("POST", `reports/${r.id}`, {});
        void show("flags");
      });
      return h("div", { class: "card" }, h("b", {}, r.target), h("p", {}, r.reason), done);
    });
    return h("div", { class: "stack" },
      h("h2", {}, `Economy flags (${flags.length})`),
      h("p", { class: "muted" }, "Written automatically when a save breaks the money rules. Freezing stops that player's saves until you unfreeze them."),
      flagRows.length ? h("div", { class: "stack" }, flagRows) : h("p", { class: "muted" }, "No flags."),
      h("h2", {}, `Player reports (${reports.length})`),
      reportRows.length ? h("div", { class: "stack" }, reportRows) : h("p", { class: "muted" }, "No reports."));
  },

  async metrics() {
    const { events } = await api<{ events: { day: string; name: string; count: number }[] }>("GET", "metrics?days=14");
    const days = [...new Set(events.map((e) => e.day))];
    const names = [...new Set(events.map((e) => e.name))].sort();
    const get = (d: string, n: string) => events.find((e) => e.day === d && e.name === n)?.count ?? 0;
    return h("div", { class: "stack" },
      h("h2", {}, "Last 14 days"),
      h("p", { class: "muted" }, "Daily counts only. No personal data is collected."),
      events.length
        ? h("div", { class: "scroll" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Event"), days.map((d) => h("th", {}, d.slice(5))))), h("tbody", {}, names.map((n) => h("tr", {}, h("td", {}, n.replace(/_/g, " ")), days.map((d) => h("td", {}, String(get(d, n)))))))))
        : h("p", { class: "muted" }, "No events yet."));
  },
};

if (token) void show("today");
else login();
