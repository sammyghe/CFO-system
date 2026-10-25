// "Street news": what's new from Ug Life, live events (go there, get a reward),
// and the community's ideas: propose, vote and rally for them.

import { h } from "./dom";
import { formatUGX } from "../game/economy";
import { checkFreeText } from "../game/moderation";
import { PROPOSAL_BODY, PROPOSAL_TITLE, type LiveEvent, type Proposal } from "../content/community";
import { placeById } from "../world/map";
import type { GameApi, SheetSpec } from "./sheets";

type Tab = "news" | "events" | "ideas";

function when(t: number) {
  return new Date(t).toLocaleString("en-GB", { timeZone: "Africa/Kampala", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function communitySheet(G: GameApi, tab: Tab = "news"): SheetSpec {
  let data: Awaited<ReturnType<GameApi["api"]["community"]>> = null;
  let loading = true;
  const spec: SheetSpec = {
    kind: "community",
    eyebrow: "Wandegeya",
    title: "Street news",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      const tabs = h("div", { class: "chips", role: "tablist" });
      for (const [id, label] of [["news", "What's new"], ["events", "Events"], ["ideas", "Ideas and votes"]] as const) {
        const b = h("button", { class: "chip", type: "button", role: "tab", "aria-pressed": String(id === tab) }, label);
        b.addEventListener("click", () => { tab = id; G.openSheet(spec); });
        tabs.append(b);
      }
      body.append(tabs);
      if (!G.online()) {
        body.append(h("div", { class: "notice" }, "Street news needs a connection. Everything else keeps working offline."));
        return body;
      }
      if (loading) {
        body.append(h("p", { class: "muted" }, "Loading…"));
        return body;
      }
      if (!data) {
        body.append(h("div", { class: "notice" }, "Couldn't load. Try again in a minute."));
        return body;
      }
      if (tab === "news") {
        G.markNewsRead(data.news[0]?.at ?? 0);
        if (!data.news.length) body.append(h("p", { class: "muted" }, "No news yet."));
        for (const n of data.news) body.append(h("article", { class: "news" }, h("span", { class: "muted small" }, when(n.at)), h("b", {}, n.title), n.body ? h("p", {}, n.body) : null));
      } else if (tab === "events") {
        if (!data.events.length) body.append(h("p", { class: "muted" }, "No events planned right now. Watch What's new."));
        for (const e of data.events) body.append(eventCard(G, e, data.now, () => G.openSheet(spec)));
      } else {
        body.append(proposeForm(G, reload));
        if (!data.proposals.length) body.append(h("p", { class: "muted" }, "No ideas yet. Be the first!"));
        for (const p of data.proposals) body.append(ideaCard(G, p, reload));
        if (data.done.length) {
          body.append(h("h3", { class: "go-group" }, "Done"));
          for (const p of data.done) body.append(h("div", { class: "idea done" }, h("b", {}, `✓ ${p.title}`), h("span", { class: "muted small" }, p.note || `${p.votes} votes`)));
        }
        body.append(h("p", { class: "muted small" }, "Ideas are about the game street: what to build, fix or add. The most-voted ideas get built. Join a rally to show support: your character holds a placard by the community board."));
      }
      return body;
    },
  };
  const reload = () => {
    void G.api.community().then((d) => {
      data = d;
      loading = false;
      if (document.getElementById("sheet-title")?.textContent?.endsWith("Street news")) G.openSheet(spec);
    });
  };
  reload();
  return spec;
}

function eventCard(G: GameApi, e: LiveEvent, now: number, redraw: () => void) {
  const place = placeById(e.place);
  const live = now >= e.startsAt && now <= e.endsAt;
  const card = h("div", { class: `event-card${live ? " live" : ""}` },
    h("span", { class: "muted small" }, live ? "🔴 Happening now" : `Starts ${when(e.startsAt)}`),
    h("b", {}, e.title),
    e.body ? h("p", {}, e.body) : null,
    h("span", { class: "small" }, `📍 ${place?.name ?? "On the street"}${e.reward ? ` · Come and get ${formatUGX(e.reward)}` : ""}`));
  const row = h("div", { class: "row-btns" });
  if (place) {
    const go = h("button", { class: "btn ghost small", type: "button" }, "Go there");
    go.addEventListener("click", () => G.goTo({ id: place.id, name: place.name, group: "Things to do", detail: e.title, tile: place }, false));
    row.append(go);
  }
  if (live && !e.attended) {
    const join = h("button", { class: "btn small", type: "button" }, "I'm here: join");
    join.addEventListener("click", async () => {
      join.disabled = true;
      if (await G.attendEvent(e)) { e.attended = true; redraw(); }
      else join.disabled = false;
    });
    row.append(join);
  } else if (e.attended) row.append(h("span", { class: "badge" }, "You came ✓"));
  const share = h("button", { class: "btn ghost small", type: "button" }, "Share");
  share.addEventListener("click", () => G.shareLink(`${e.title} on Ug Life`, { event: e.id }));
  row.append(share);
  card.append(row);
  return card;
}

function ideaCard(G: GameApi, p: Proposal, reload: () => void) {
  const vote = h("button", { class: "btn small", type: "button", disabled: !!p.mine }, p.mine ? "Voted ✓" : "Vote");
  vote.addEventListener("click", async () => {
    vote.disabled = true;
    const r = await G.api.vote(p.id);
    if (r.ok) { G.track("voted"); G.sfx("ok"); reload(); }
    else { G.toast(r.message, "bad"); vote.disabled = false; }
  });
  const rally = h("button", { class: "btn ghost small", type: "button" }, "✊ Rally");
  rally.addEventListener("click", () => G.rally(p));
  const rep = h("button", { class: "talk-report", type: "button", title: "Report", "aria-label": `Report idea: ${p.title}` }, "⚑");
  rep.addEventListener("click", async () => {
    if (await G.api.reportProposal(p.id)) G.toast("Reported. Thanks; our team will look at it.", "ok");
  });
  return h("div", { class: "idea" },
    h("div", { class: "idea-votes" }, h("b", {}, String(p.votes)), h("span", {}, "votes")),
    h("div", { style: "min-width:0;display:grid;gap:4px" }, h("b", {}, p.title), p.body ? h("span", { class: "small" }, p.body) : null, h("span", { class: "muted small" }, `by ${p.name}`),
      h("div", { class: "row-btns" }, vote, rally, rep)));
}

function proposeForm(G: GameApi, reload: () => void) {
  const title = h("input", { maxlength: String(PROPOSAL_TITLE), placeholder: "Your idea, e.g. Street lights on the side road", autocomplete: "off", "aria-label": "Your idea" });
  const more = h("input", { maxlength: String(PROPOSAL_BODY), placeholder: "Why? (optional)", autocomplete: "off", "aria-label": "Why" });
  const err = h("div", { class: "err", role: "alert" });
  const post = h("button", { class: "btn", type: "button" }, "Post idea");
  post.addEventListener("click", async () => {
    const t = checkFreeText(title.value, PROPOSAL_TITLE), b = checkFreeText(more.value, PROPOSAL_BODY);
    if (!t.ok || !b.ok) { err.textContent = !t.ok ? t.reason : !b.ok ? b.reason : ""; return; }
    post.disabled = true;
    const r = await G.api.propose(t.value, b.value);
    post.disabled = false;
    if (!r.ok) { err.textContent = r.message; return; }
    G.track("proposal_made");
    G.toast("Idea posted. Share it so people vote!", "ok");
    title.value = more.value = "";
    reload();
  });
  return h("div", { class: "propose" }, title, more, post, err);
}
