// Street talk: one-tap Luganda and street phrases, short typed messages, emotes
// and a 4-second voice hello. Everyone near you on the street sees it as a bubble.
// Player text is always set with textContent (via h()), never as HTML.

import { h } from "./dom";
import { checkFreeText } from "../game/moderation";
import { EMOTES, PHRASES, TALK_MAX, VOICE_MAX_MS } from "../content/talk";
import type { GameApi, SheetSpec } from "./sheets";

export interface TalkEntry {
  key: string;
  /** Server message id (real players only; these can be reported). */
  talkId?: string;
  whoId: string;
  who: string;
  kind: "phrase" | "text" | "emote" | "voice" | "resident" | "system";
  text: string;
  voiceId?: string;
  at: number;
  mine: boolean;
  /** Sent to you by name. */
  toMe?: boolean;
}

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 10 ? "now" : s < 60 ? `${s}s` : `${Math.round(s / 60)}m`;
}

export function talkSheet(G: GameApi, to?: { id: string; name: string }): SheetSpec {
  let off: (() => void) | null = null;
  return {
    kind: "talk",
    eyebrow: to ? `Talking to ${to.name}` : "Everyone nearby sees this",
    title: "Street talk",
    onClose: () => off?.(),
    body: () => {
      const body = h("div", { class: "sheet-body talk" });
      const log = h("div", { class: "talk-log", role: "log", "aria-live": "polite" });
      const drawLog = () => {
        const now = G.now();
        const entries = G.talkLog().slice(-40);
        log.replaceChildren();
        if (!entries.length) log.append(h("p", { class: "muted small", style: "text-align:center" }, "Quiet street. Say “Oli otya?” and see who answers."));
        for (const e of entries) {
          const name = h("button", { class: "talk-who", type: "button" }, e.mine ? "You" : e.who);
          if (!e.mine && e.kind !== "system") name.addEventListener("click", () => G.openProfile(e.whoId));
          const line = h("div", { class: `talk-line${e.mine ? " mine" : ""}${e.toMe ? " to-me" : ""}${e.kind === "resident" ? " npc" : ""}` }, name);
          if (e.kind === "voice" && e.voiceId) {
            const play = h("button", { class: "btn small", type: "button" }, "▶ Play voice hello");
            play.addEventListener("click", () => G.playVoice(e.voiceId!));
            line.append(play);
          } else line.append(h("span", { class: "talk-text" }, e.text));
          const meta = h("span", { class: "talk-meta" }, ago(e.at, now));
          if (e.talkId && !e.mine) {
            const rep = h("button", { class: "talk-report", type: "button", "aria-label": `Report this message from ${e.who}`, title: "Report" }, "⚑");
            rep.addEventListener("click", () => G.reportTalk(e));
            meta.append(rep);
          }
          line.append(meta);
          log.append(line);
        }
        log.scrollTop = log.scrollHeight;
      };
      drawLog();
      off = G.onTalk(drawLog);

      // quick phrases
      const phrases = h("div", { class: "phrases", role: "group", "aria-label": "Quick phrases" });
      for (const p of PHRASES) {
        const b = h("button", { class: "phrase", type: "button" }, h("b", {}, p.text), p.meaning ? h("small", {}, p.meaning) : null);
        b.addEventListener("click", () => G.say("phrase", p.id, to?.id));
        phrases.append(b);
      }
      // emotes
      const emotes = h("div", { class: "emotes", role: "group", "aria-label": "Emotes" });
      for (const e of EMOTES) {
        const b = h("button", { class: "emote", type: "button", "aria-label": e.label, title: e.label }, e.icon);
        b.addEventListener("click", () => G.say("emote", e.id));
        emotes.append(b);
      }
      // typed message
      const input = h("input", { id: "talk-input", maxlength: String(TALK_MAX), placeholder: to ? `Say something to ${to.name}…` : "Say something…", autocomplete: "off", enterkeyhint: "send" });
      const err = h("div", { class: "err", role: "alert" });
      const send = h("button", { class: "btn", type: "button" }, "Send");
      const submit = () => {
        const r = checkFreeText(input.value, TALK_MAX);
        if (!r.ok) { err.textContent = r.reason; return; }
        if (!r.value) return;
        err.textContent = "";
        G.say("text", to ? `@${to.name} ${r.value}`.slice(0, TALK_MAX) : r.value, to?.id);
        input.value = "";
      };
      send.addEventListener("click", submit);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

      // voice hello: hold to record, let go to send
      const canRecord = G.online() && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
      const mic = h("button", { class: "btn block mic", type: "button", disabled: !canRecord }, "🎙  Hold to say hi with your voice");
      const micNote = h("p", { class: "muted small" }, canRecord ? `Up to ${VOICE_MAX_MS / 1000} seconds. People nearby tap your bubble to hear it. It disappears after a day.` : G.online() ? "Voice hellos need a phone browser that can record audio." : "Voice hellos need a connection.");
      if (canRecord) bindRecorder(G, mic);

      body.append(
        log,
        h("label", { class: "talk-label" }, "Tap to say"), phrases,
        h("div", { class: "talk-input" }, input, send), err,
        emotes,
        mic, micNote,
        ...(G.online() ? [] : [h("div", { class: "notice" }, "You're offline. Residents nearby still hear you; other players will when you're back online.")]),
        h("p", { class: "muted small" }, "Never share phone numbers or send money to anyone here. Tap ⚑ to report a message; two reports hide it for everyone. Block someone from their name tag."));
      return body;
    },
  };
}

function bindRecorder(G: GameApi, btn: HTMLButtonElement) {
  let rec: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let t0 = 0;
  let timer = 0;
  const label = btn.textContent!;
  const stop = () => {
    clearTimeout(timer);
    if (rec && rec.state === "recording") rec.stop();
  };
  const start = async (e: Event) => {
    e.preventDefault();
    if (rec) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      G.toast("Allow the microphone to send a voice hello.", "bad");
      return;
    }
    const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported?.(t));
    rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 24_000 });
    chunks = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => {
      const ms = performance.now() - t0;
      stream?.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: (rec?.mimeType || mimeType || "audio/webm").split(";")[0] });
      rec = null;
      btn.classList.remove("recording");
      btn.textContent = label;
      if (ms < 500) {
        G.toast("Hold the button while you talk.", "info");
        return;
      }
      void G.sendVoice(blob, Math.min(ms, VOICE_MAX_MS));
    };
    t0 = performance.now();
    rec.start();
    btn.classList.add("recording");
    btn.textContent = "● Recording… let go to send";
    timer = window.setTimeout(stop, VOICE_MAX_MS);
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointerleave", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}
