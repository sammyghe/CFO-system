// Friends and private messages between real players, and the weekly street
// chairperson election. Message text is always set with textContent (via h()).

import { h } from "./dom";
import { checkFreeText } from "../game/moderation";
import { levelForXp } from "../game/economy";
import { CANDIDATE_MIN_LEVEL, DM_MAX, SLOGAN_MAX, type DirectMessage, type Election, type Friend } from "../content/social";
import { AREA, AREAS } from "../world/map";
import type { GameApi, SheetSpec } from "./sheets";

export function friendsSheet(G: GameApi): SheetSpec {
  let list: Friend[] | null = null;
  let loading = true;
  const spec: SheetSpec = {
    kind: "friends",
    eyebrow: "People you know",
    title: "Friends and messages",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      if (!G.online()) {
        body.append(h("div", { class: "notice" }, "Friends and messages need a connection."));
        return body;
      }
      if (loading) {
        body.append(h("p", { class: "muted" }, "Loading…"));
        return body;
      }
      const all = list ?? [];
      const incoming = all.filter((f) => f.status === "incoming");
      const friends = all.filter((f) => f.status === "friends").sort((a, b) => b.unread - a.unread || Number(b.online) - Number(a.online));
      const outgoing = all.filter((f) => f.status === "outgoing");
      if (incoming.length) {
        body.append(h("h3", { class: "go-group" }, "Friend requests"));
        for (const f of incoming) {
          const yes = h("button", { class: "btn small", type: "button" }, "Accept");
          yes.addEventListener("click", async () => {
            const r = await G.api.addFriend(f.id);
            if (r.ok) { G.toast(`You and ${f.name} are friends now!`, "ok"); G.track("friend_added"); }
            reload();
          });
          const no = h("button", { class: "btn ghost small", type: "button" }, "No thanks");
          no.addEventListener("click", async () => { await G.api.removeFriend(f.id); reload(); });
          body.append(h("div", { class: "go-row" }, h("div", { class: "go-name" }, h("b", {}, f.name), h("span", { class: "muted small" }, "wants to be friends")), h("div", { class: "go-btns" }, yes, no)));
        }
      }
      body.append(h("h3", { class: "go-group" }, `Friends (${friends.length})`));
      if (!friends.length) body.append(h("p", { class: "muted small" }, "No friends yet. Tap a player's name tag on the street, then Add friend. When they accept, you can message each other."));
      for (const f of friends) {
        const msg = h("button", { class: "btn small", type: "button" }, f.unread ? `Message (${f.unread} new)` : "Message");
        msg.addEventListener("click", () => G.openSheet(chatSheet(G, f)));
        const where = AREAS.find((a) => a.id === f.area)?.name;
        body.append(h("div", { class: "go-row" },
          h("div", { class: "go-name" }, h("b", {}, `${f.online ? "🟢 " : ""}${f.name}`), h("span", { class: "muted small" }, f.online ? `Online${where ? ` in ${where}` : ""}` : "Offline")),
          h("div", { class: "go-btns" }, msg)));
      }
      if (outgoing.length) body.append(h("p", { class: "muted small" }, `Waiting for: ${outgoing.map((f) => f.name).join(", ")}`));
      body.append(h("p", { class: "muted small" }, "Messages are private between friends, with the same filters as street talk: no phone numbers, links or money requests. Report or block anyone who bothers you."));
      return body;
    },
  };
  const reload = () => {
    void G.api.friends().then((f) => {
      list = f;
      loading = false;
      if (document.getElementById("sheet-title")?.textContent?.endsWith("Friends and messages")) G.openSheet(spec);
    });
  };
  reload();
  return spec;
}

export function chatSheet(G: GameApi, f: Friend): SheetSpec {
  let msgs: DirectMessage[] = [];
  let timer = 0;
  let since = 0;
  const me = () => G.api.playerId;
  return {
    kind: "chat",
    eyebrow: "Private message",
    title: f.name,
    onClose: () => clearInterval(timer),
    body: () => {
      const body = h("div", { class: "sheet-body talk" });
      const log = h("div", { class: "talk-log chat-log", role: "log", "aria-live": "polite" });
      const draw = () => {
        log.replaceChildren();
        if (!msgs.length) log.append(h("p", { class: "muted small", style: "text-align:center" }, `Say hi to ${f.name}!`));
        for (const m of msgs) {
          const mine = m.from === me();
          const line = h("div", { class: `talk-line${mine ? " mine" : ""}` }, h("span", { class: "talk-text" }, m.body),
            h("span", { class: "talk-meta" }, new Date(m.at).toLocaleTimeString("en-GB", { timeZone: "Africa/Kampala", hour: "2-digit", minute: "2-digit" })));
          if (!mine) {
            const rep = h("button", { class: "talk-report", type: "button", title: "Report", "aria-label": "Report this message" }, "⚑");
            rep.addEventListener("click", async () => {
              if (await G.api.reportDm(m.id)) {
                msgs = msgs.filter((x) => x.id !== m.id);
                draw();
                G.toast("Reported and hidden. Our team will look at it.", "ok");
              }
            });
            line.lastElementChild!.append(rep);
          }
          log.append(line);
        }
        log.scrollTop = log.scrollHeight;
      };
      const pull = async () => {
        const fresh = await G.api.dms(f.id, since);
        if (!fresh?.length) return;
        msgs = [...msgs, ...fresh.filter((m) => !msgs.some((x) => x.id === m.id))].slice(-80);
        since = msgs[msgs.length - 1].at;
        draw();
        G.sfx("pop");
      };
      draw();
      void pull();
      clearInterval(timer);
      timer = window.setInterval(() => void pull(), 4000);
      const input = h("input", { maxlength: String(DM_MAX), placeholder: `Message ${f.name}…`, autocomplete: "off", enterkeyhint: "send" });
      const err = h("div", { class: "err", role: "alert" });
      const send = h("button", { class: "btn", type: "button" }, "Send");
      const submit = async () => {
        const c = checkFreeText(input.value, DM_MAX);
        if (!c.ok) { err.textContent = c.reason; return; }
        if (!c.value) return;
        err.textContent = "";
        send.disabled = true;
        const r = await G.api.sendDm(f.id, c.value);
        send.disabled = false;
        if ("error" in r) { err.textContent = r.error; return; }
        input.value = "";
        msgs.push({ id: r.id, from: me() ?? "", to: f.id, body: r.body, at: r.at });
        since = r.at;
        draw();
        G.sfx("send");
        G.track("dm_sent");
      };
      send.addEventListener("click", () => void submit());
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") void submit(); });
      const block = h("button", { class: "btn danger small", type: "button" }, "Block and unfriend");
      block.addEventListener("click", async () => {
        await G.api.removeFriend(f.id);
        G.state.blocked = [...new Set([...G.state.blocked, f.id])];
        G.changed();
        G.toast(`${f.name} is blocked. You won't see them or their messages.`, "info");
        G.closeSheet();
      });
      const back = h("button", { class: "btn ghost small", type: "button" }, "← All friends");
      back.addEventListener("click", () => G.openSheet(friendsSheet(G)));
      body.append(log, h("div", { class: "talk-input" }, input, send), err, h("div", { class: "row-btns" }, back, block),
        h("p", { class: "muted small" }, "Never send money, PINs or codes to anyone. Ug Life staff will never ask."));
      return body;
    },
  };
}

export function electionSheet(G: GameApi, areaId = AREA.id): SheetSpec {
  let data: Election | null = null;
  let loading = true;
  const area = AREAS.find((a) => a.id === areaId) ?? AREA;
  const spec: SheetSpec = {
    kind: "election",
    eyebrow: `${area.name} · this week`,
    title: "Street chairperson",
    body: () => {
      const body = h("div", { class: "sheet-body" });
      const tabs = h("div", { class: "chips" }, AREAS.map((a) => {
        const b = h("button", { class: "chip", type: "button", "aria-pressed": String(a.id === area.id) }, a.name);
        b.addEventListener("click", () => G.openSheet(electionSheet(G, a.id)));
        return b;
      }));
      body.append(tabs);
      if (!G.online()) { body.append(h("div", { class: "notice" }, "The election needs a connection.")); return body; }
      if (loading || !data) { body.append(h("p", { class: "muted" }, loading ? "Loading…" : "Couldn't load.")); return body; }
      const d = data;
      body.append(h("div", { class: "notice ok" }, d.chair ? `👑 Chairperson of ${area.name}: ${d.chair.name} (${d.chair.votes} votes last week). Their name tag wears the crown this week.` : `No chairperson yet in ${area.name}. Win this week's vote to wear the 👑 next week.`));
      body.append(h("p", { class: "muted small" }, "Every week, players vote for the chairperson of each area. One vote per area. The winner's name tag gets a crown for the next week, and their slogan shows here. It's a game title: no real politics, no real officials."));
      body.append(h("h3", { class: "go-group" }, `Candidates (${d.candidates.length})`));
      if (!d.candidates.length) body.append(h("p", { class: "muted" }, "Nobody is standing yet. Be the first!"));
      for (const c of d.candidates) {
        const voted = d.myVote === c.id;
        const vote = h("button", { class: "btn small", type: "button", disabled: !!d.myVote }, voted ? "Your vote ✓" : "Vote");
        vote.addEventListener("click", async () => {
          const r = await G.api.voteChair(area.id, c.id);
          if ("error" in r) { G.toast(r.error, "bad"); return; }
          G.track("chair_voted");
          G.sfx("ok");
          data = r;
          G.openSheet(spec);
        });
        body.append(h("div", { class: "idea" }, h("div", { class: "idea-votes" }, h("b", {}, String(c.votes)), h("span", {}, "votes")),
          h("div", { style: "min-width:0;display:grid;gap:4px" }, h("b", {}, c.name), c.slogan ? h("span", { class: "small" }, `“${c.slogan}”`) : null, h("div", { class: "row-btns" }, vote))));
      }
      const lv = levelForXp(G.state.xp);
      const mine = d.candidates.some((c) => c.id === G.api.playerId);
      const slogan = h("input", { maxlength: String(SLOGAN_MAX), placeholder: "Your slogan, e.g. Street lights for every corner!", autocomplete: "off" });
      const err = h("div", { class: "err", role: "alert" });
      const run = h("button", { class: "btn", type: "button", disabled: lv < CANDIDATE_MIN_LEVEL }, lv < CANDIDATE_MIN_LEVEL ? `Stand from level ${CANDIDATE_MIN_LEVEL}` : mine ? "Update my slogan" : "Stand for chairperson");
      run.addEventListener("click", async () => {
        const c = checkFreeText(slogan.value, SLOGAN_MAX);
        if (!c.ok) { err.textContent = c.reason; return; }
        run.disabled = true;
        await G.saveNow(); // the server checks your saved level
        const r = await G.api.runForChair(area.id, c.value);
        run.disabled = false;
        if ("error" in r) { err.textContent = r.error; return; }
        G.track("chair_run");
        G.toast("You're standing! Share the link and get your friends to vote.", "ok");
        data = r;
        G.openSheet(spec);
      });
      const share = h("button", { class: "btn ghost", type: "button" }, "Share: vote for me");
      share.addEventListener("click", () => G.shareLink(`Vote for me as chairperson of ${area.name} on Ug Life!`, { vote: area.id }));
      body.append(h("div", { class: "propose" }, slogan, run, err));
      if (mine) body.append(share);
      return body;
    },
  };
  void G.api.election(area.id).then((e) => {
    data = e;
    loading = false;
    if (document.getElementById("sheet-title")?.textContent?.endsWith("Street chairperson")) G.openSheet(spec);
  });
  return spec;
}
