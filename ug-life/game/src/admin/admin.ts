// Ug Life Control Room: where Sammy (and the ops agents, through the same API)
// approve snaps, answer players, review flags and flip switches. Phone-friendly.

import "./admin.css";
import { h } from "../ui/dom";
import { BILLBOARD_SLOTS } from "../content/billboards";
import { EVENT_MAX_REWARD, type LiveEvent, type NewsPost, type Proposal } from "../content/community";
import { PLACES } from "../world/map";

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
  ["grow", "Grow"],
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
  money?: { crypto24h: number; cryptoAll: number; mobile24h: number };
  online?: number;
  config: Record<string, string>;
};

const VIEWS: Record<Tab, () => Promise<HTMLElement>> = {
  async today() {
    const o = await api<Overview>("GET", "overview");
    const stat = (n: number | string, label: string, alert = false) => h("div", { class: alert ? "stat alert" : "stat" }, h("b", {}, String(n)), h("span", {}, label));
    const setting = (key: string, label: string, placeholder: string, size: number) => {
      const input = h("input", { id: `cfg-${key}`, value: o.config[key] ?? "", placeholder, size: String(size), autocomplete: "off" });
      const btn = h("button", { class: "btn small", type: "button" }, "Save");
      const msg = h("small", { class: "muted" });
      btn.addEventListener("click", async () => {
        try {
          await api("POST", "config", { key, value: input.value.trim() });
          msg.textContent = "Saved ✓";
        } catch (e) {
          msg.textContent = (e as Error).message;
        }
      });
      return h("div", { class: "field" }, h("label", { for: `cfg-${key}` }, label), input, btn, msg);
    };
    const toggle = (key: string, label: string, help: string, invert = false) => {
      // maintenance and top-ups are off unless set; everything else is on unless set to "false"
      const on = ["maintenance_mode", "topups_enabled", "crypto_enabled"].includes(key) ? o.config[key] === "true" : o.config[key] !== "false";
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
        stat(o.flags.open + o.reports.open, "flags and reports", o.flags.open + o.reports.open > 0), stat(o.economy.circulating.toLocaleString(), "UGX held by weekly players"),
        stat(o.online ?? 0, "online now"), stat(`$${((o.money?.crypto24h ?? 0) / 1e6).toFixed(2)}`, "crypto in today"), stat(`$${((o.money?.cryptoAll ?? 0) / 1e6).toFixed(2)}`, "crypto in, all time"), stat((o.money?.mobile24h ?? 0).toLocaleString(), "UGX mobile money today")),
      h("h2", {}, "Switches"),
      toggle("maintenance_mode", "Maintenance mode", "Pauses saving, sign-ups and uploads. Players keep playing offline."),
      toggle("uploads_enabled", "Snap uploads", "Turn off if moderation falls behind."),
      toggle("signups_enabled", "New players", "Turn off to stop sign-ups during an attack or overload."),
      toggle("talk_enabled", "Street talk", "Turn off to pause messages, emotes and voice hellos (spam or abuse wave)."),
      h("p", { class: "muted" }, "Mobile money top-ups need the FLW_SECRET_KEY setting on Netlify first; then switch them on here."),
      toggle("topups_enabled", "Mobile money top-ups", "Players pay real UGX for game shillings (no cash-out). Off by default."),
      h("h2", {}, "Crypto top-ups (USDT on TRON)"),
      h("p", { class: "muted" }, "Paste the TRC20 USDT deposit address of a wallet you control (Binance → Deposit → USDT → network TRON, or Trust Wallet). Money goes straight there; the game only reads the blockchain to credit players. Check it twice: payments to a wrong address are lost."),
      setting("crypto_address", "Receiving address (TRC20)", "T…", 40),
      setting("usd_ugx", "UGX per 1 USDT", "3600", 6),
      toggle("crypto_enabled", "Crypto top-ups", "Players send USDT and get game shillings (no cash-out). Needs the address above."),
      h("h2", {}, "Busy day"),
      h("p", { class: "muted" }, "If the game is slow or Netlify credits run low, make phones check for other players less often. Blank = automatic (it already slows down as more people join)."),
      setting("poll_ms", "Seconds between checks × 1000 (e.g. 60000)", "automatic", 8),
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
      const row = h("div", { class: "row" });
      // street talk reports: "talk:<message id>:<player id>"
      const [kind, talkId, playerId] = r.target.split(":");
      if ((kind === "dm" || kind === "proposal") && playerId) {
        const freeze = h("button", { class: "btn danger small", type: "button" }, "Freeze sender");
        freeze.addEventListener("click", async () => {
          await api("POST", `players/${playerId}`, { frozen: true });
          freeze.textContent = "Frozen";
        });
        row.append(freeze);
      }
      if (kind === "talk" && talkId) {
        const hide = h("button", { class: "btn danger small", type: "button" }, "Hide message");
        hide.addEventListener("click", async () => {
          await api("POST", `talk/${talkId}`, { action: "hide" });
          hide.textContent = "Hidden";
        });
        row.append(hide);
        if (playerId) {
          const freeze = h("button", { class: "btn danger small", type: "button" }, "Freeze player");
          freeze.addEventListener("click", async () => {
            await api("POST", `players/${playerId}`, { frozen: true });
            freeze.textContent = "Frozen";
          });
          row.append(freeze);
        }
      }
      row.append(done);
      return h("div", { class: "card" }, h("b", {}, r.target), h("p", {}, r.reason), row);
    });
    return h("div", { class: "stack" },
      h("h2", {}, `Economy flags (${flags.length})`),
      h("p", { class: "muted" }, "Written automatically when a save breaks the money rules. Freezing stops that player's saves until you unfreeze them."),
      flagRows.length ? h("div", { class: "stack" }, flagRows) : h("p", { class: "muted" }, "No flags."),
      h("h2", {}, `Player reports (${reports.length})`),
      reportRows.length ? h("div", { class: "stack" }, reportRows) : h("p", { class: "muted" }, "No reports."));
  },

  async grow() {
    const pub = async <T,>(path: string): Promise<T> => (await fetch(`/api/${path}`, { headers: { authorization: `Bearer ${token}` } })).json() as Promise<T>;
    const c = await pub<{ now: number; proposals: Proposal[]; done: Proposal[]; news: NewsPost[]; events: LiveEvent[] }>(`community?t=${Date.now()}`);
    const ads = await pub<{ ads: { slot: string; kind: string; owner: string; text: string; until: number }[] }>(`billboards?t=${Date.now()}`);
    const reload = () => void show("grow");
    const field = (label: string, el: HTMLElement) => h("div", { class: "field" }, h("label", {}, label), el);

    // news
    const nt = h("input", { placeholder: "Headline, e.g. New: Kampala land is open!", maxlength: "80" });
    const nb = h("textarea", { placeholder: "A few lines for players (optional)", maxlength: "1000" });
    const np = h("button", { class: "btn small", type: "button" }, "Post to What's new");
    np.addEventListener("click", async () => { await api("POST", "news", { title: nt.value, body: nb.value }); reload(); });
    const newsList = c.news.map((n) => {
      const del = h("button", { class: "btn ghost small", type: "button" }, "Delete");
      del.addEventListener("click", async () => { await api("DELETE", `news/${n.id}`); reload(); });
      return h("div", { class: "card" }, h("b", {}, n.title), h("p", { class: "muted" }, new Date(n.at).toLocaleString()), del);
    });

    // events
    const et = h("input", { placeholder: "Event name, e.g. Launch party at Studio 256", maxlength: "80" });
    const eb = h("input", { placeholder: "What happens (optional)", maxlength: "500" });
    const ep = h("select", {}, PLACES.map((p) => h("option", { value: p.id }, p.name)));
    const es = h("input", { type: "datetime-local" });
    const ed = h("input", { type: "number", value: "2", min: "1", max: "168" });
    const er = h("input", { type: "number", value: "1000", min: "0", max: String(EVENT_MAX_REWARD), step: "100" });
    const eg = h("button", { class: "btn small", type: "button" }, "Create event");
    eg.addEventListener("click", async () => {
      const start = es.value ? new Date(es.value).getTime() : Date.now();
      await api("POST", "events", { title: et.value, body: eb.value, place: ep.value, startsAt: start, endsAt: start + Number(ed.value) * 3600_000, reward: Number(er.value) });
      reload();
    });
    const eventList = c.events.map((e) => {
      const del = h("button", { class: "btn ghost small", type: "button" }, "Cancel event");
      del.addEventListener("click", async () => { await api("DELETE", `events/${e.id}`); reload(); });
      return h("div", { class: "card" }, h("b", {}, e.title), h("p", { class: "muted" }, `${new Date(e.startsAt).toLocaleString()} → ${new Date(e.endsAt).toLocaleString()} · ${e.place} · UGX ${e.reward}`), del);
    });

    // brand billboards
    const bs = h("select", {}, BILLBOARD_SLOTS.map((b) => h("option", { value: b.id }, b.name)));
    const bn = h("input", { placeholder: "Brand name, e.g. Rolex Republic", maxlength: "40" });
    const bt = h("input", { placeholder: "Big text (26 max)", maxlength: "26" });
    const bsub = h("input", { placeholder: "Small text (40 max)", maxlength: "40" });
    const bc = h("input", { type: "color", value: "#13202b" });
    const bd = h("input", { type: "number", value: "7", min: "1", max: "90" });
    const bl = h("input", { placeholder: "https:// link (optional)" });
    const bg = h("button", { class: "btn small", type: "button" }, "Put brand on billboard");
    bg.addEventListener("click", async () => { await api("POST", `billboards/${bs.value}`, { brand: bn.value, text: bt.value, sub: bsub.value, color: bc.value, days: Number(bd.value), link: bl.value }); reload(); });
    const adList = ads.ads.map((a) => {
      const clear = h("button", { class: "btn ghost small", type: "button" }, "Remove brand");
      clear.addEventListener("click", async () => { await api("POST", `billboards/${a.slot}`, { clear: true }); reload(); });
      return h("div", { class: "card" }, h("b", {}, `${a.slot}: ${a.text}`), h("p", { class: "muted" }, `${a.kind === "brand" ? "Brand" : "Player"} ${a.owner} until ${new Date(a.until).toLocaleString()}`), a.kind === "brand" ? clear : null);
    });

    // ideas
    const ideas = c.proposals.map((p) => {
      const done = h("button", { class: "btn small", type: "button" }, "Mark done");
      const note = h("input", { placeholder: "Note shown to players, e.g. Built on 1 Nov!" });
      done.addEventListener("click", async () => { await api("POST", `proposals/${p.id}`, { status: "done", note: note.value }); reload(); });
      const hide = h("button", { class: "btn danger small", type: "button" }, "Hide");
      hide.addEventListener("click", async () => { await api("POST", `proposals/${p.id}`, { status: "hidden" }); reload(); });
      return h("div", { class: "card" }, h("b", {}, `${p.votes} votes · ${p.title}`), h("p", { class: "muted" }, `by ${p.name}${p.body ? ` · ${p.body}` : ""}`), note, h("div", { class: "row" }, done, hide));
    });

    return h("div", { class: "stack" },
      h("h2", {}, "What's new"), h("div", { class: "card" }, field("Headline", nt), field("Text", nb), np), ...newsList,
      h("h2", {}, "Events"), h("p", { class: "muted" }, "Players who come to the place while it's on get the reward once (up to UGX 5,000). Great for launches and real-world meetups."),
      h("div", { class: "card" }, field("Name", et), field("Details", eb), field("Where", ep), field("Starts (empty = now)", es), field("Hours", ed), field("Reward (game UGX)", er), eg), ...eventList,
      h("h2", {}, "Brand billboards"), h("p", { class: "muted" }, "For real local businesses who sponsor a billboard. A brand shows above a player's rental on the same spot."),
      h("div", { class: "card" }, field("Billboard", bs), field("Brand", bn), field("Big text", bt), field("Small text", bsub), field("Colour", bc), field("Days", bd), field("Link", bl), bg), ...adList,
      h("h2", {}, `Ideas from players (${c.proposals.length})`), ideas.length ? h("div", { class: "stack" }, ideas) : h("p", { class: "muted" }, "No ideas yet."));
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
