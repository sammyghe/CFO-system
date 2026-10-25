// Sounds of the street, made in code with Web Audio (no files to download, so it
// costs nothing on slow data): boda engines and horns, matatu hoots, birds and the
// hadada ibis by day, crickets at night, rain, the market murmur, music from
// Studio 256, and the game's own clicks and coins. Voices (conductors, vendors,
// residents) use the phone's built-in speech, so they cost nothing either.

export type Sfx = "tap" | "coin" | "pop" | "send" | "horn" | "hoot" | "kick" | "sizzle" | "ok" | "bad" | "whoosh";

export interface Ambience {
  night: boolean;
  rain: boolean;
  /** 0..1: how many bodas are moving near the camera. */
  bodas: number;
  /** 0..1: matatus near the camera. */
  matatus: number;
  /** 0..1: how close the camera is to Studio 256 times how loud the music is today. */
  music: number;
  /** 0..1: people around. */
  crowd: number;
  /** You are on a boda; speed 0..1. */
  riding: number;
}

const PENTA = [0, 2, 4, 7, 9];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private ambBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private loops: { murmur: GainNode; rain: GainNode; engine: GainNode; engineOsc: OscillatorNode; crickets: GainNode } | null = null;
  private next = { bird: 0, ibis: 0, horn: 0, hoot: 0 };
  private music = { step: 0, nextAt: 0 };
  private voice: SpeechSynthesisVoice | null = null;
  enabled = true;
  musicOn = true;
  voicesOn = true;
  /** Fewer background layers on slow phones. */
  lite = false;

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  /** Browsers only allow sound after a tap; call this from the first one. */
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.build();
      void this.ctx?.resume();
    } catch {
      this.ctx = null;
    }
    this.pickVoice();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (on) this.unlock();
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (!on && "speechSynthesis" in window) speechSynthesis.cancel();
  }

  suspend(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  }

  private build() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = this.gain(0.8, this.master);
    this.ambBus = this.gain(0.9, this.master);
    this.musicBus = this.gain(0, this.master);
    // two seconds of brown-ish noise for murmur, rain, sizzle and shakers
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      d[i] = white * 0.55 + last * 3;
    }
    this.buildLoops();
  }

  private gain(v: number, to: AudioNode | AudioParam) {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    if (to instanceof AudioParam) g.connect(to);
    else g.connect(to);
    return g;
  }

  private noiseSrc(loop = true) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    s.playbackRate.value = 0.9 + Math.random() * 0.2;
    return s;
  }

  private buildLoops() {
    const ctx = this.ctx!;
    // market murmur: low noise through a voice-band filter, slowly swelling
    const murmur = this.gain(0, this.ambBus);
    const mf = ctx.createBiquadFilter();
    mf.type = "bandpass"; mf.frequency.value = 420; mf.Q.value = 0.8;
    const mn = this.noiseSrc();
    mn.connect(mf).connect(murmur);
    mn.start();
    // rain on iron roofs
    const rain = this.gain(0, this.ambBus);
    const rh = ctx.createBiquadFilter();
    rh.type = "highpass"; rh.frequency.value = 1200;
    const rn = this.noiseSrc();
    rn.playbackRate.value = 1.6;
    rn.connect(rh).connect(rain);
    rn.start();
    // boda engines: a low sawtooth chopped at the firing rate ("putt-putt-putt")
    const engine = this.gain(0, this.ambBus);
    const el = ctx.createBiquadFilter();
    el.type = "lowpass"; el.frequency.value = 520;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = "square"; lfo.frequency.value = 11;
    const lfoAmt = this.gain(0.5, chop.gain);
    lfo.connect(lfoAmt);
    const osc = ctx.createOscillator();
    osc.type = "sawtooth"; osc.frequency.value = 42;
    osc.connect(chop).connect(el).connect(engine);
    osc.start(); lfo.start();
    // crickets: a high tone trilling fast, pulsing slowly
    const crickets = this.gain(0, this.ambBus);
    const tone = ctx.createOscillator();
    tone.frequency.value = 4400;
    const trill = ctx.createGain();
    trill.gain.value = 0;
    const tl = ctx.createOscillator();
    tl.type = "square"; tl.frequency.value = 28;
    tl.connect(this.gain(0.5, trill.gain));
    tone.connect(trill).connect(crickets);
    tone.start(); tl.start();
    this.loops = { murmur, rain, engine, engineOsc: osc, crickets };
  }

  /** Called every frame with what's around the camera. */
  update(a: Ambience) {
    const ctx = this.ctx;
    if (!ctx || !this.loops || !this.enabled || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const L = this.loops;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.4);
    set(L.murmur, (this.lite ? 0.02 : 0.035) * (0.4 + a.crowd) * (a.rain ? 0.6 : 1) * (a.night ? 0.6 : 1));
    set(L.rain, a.rain ? 0.09 : 0);
    set(L.engine, Math.min(0.11, a.bodas * 0.05 + a.riding * 0.08));
    L.engineOsc.frequency.setTargetAtTime(42 + a.riding * 24, t, 0.3);
    set(L.crickets, a.night && !a.rain && !this.lite ? 0.008 : 0);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? a.music * 0.22 : 0, t, 0.6);

    const now = performance.now();
    if (!a.night && !a.rain && now > this.next.bird) {
      this.next.bird = now + 3500 + Math.random() * 8000;
      if (!this.lite) this.bird();
    }
    if (!a.night && now > this.next.ibis) {
      this.next.ibis = now + 35_000 + Math.random() * 60_000;
      if (this.next.ibis - now < 120_000 && Math.random() < 0.7) this.ibis();
    }
    if (a.bodas > 0.15 && now > this.next.horn) {
      this.next.horn = now + 5000 + Math.random() * 11000;
      this.horn(0.025 + a.bodas * 0.03);
    }
    if (a.matatus > 0.2 && now > this.next.hoot) {
      this.next.hoot = now + 14000 + Math.random() * 20000;
      this.hoot(0.03 * a.matatus);
    }
    if (a.music > 0.02 && this.musicOn) this.runMusic();
  }

  // ---------- one-shots ----------

  sfx(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || ctx.state !== "running") return;
    const t = ctx.currentTime;
    switch (name) {
      case "tap": return this.blip(t, 900, 0.03, 0.04, "sine");
      case "pop": this.blip(t, 520, 0.06, 0.06, "sine", 980); return;
      case "send": this.blip(t, 660, 0.05, 0.05, "triangle", 1180); return;
      case "coin":
        this.blip(t, 1320, 0.08, 0.07, "square");
        this.blip(t + 0.08, 1980, 0.18, 0.06, "square");
        return;
      case "ok":
        this.blip(t, 660, 0.09, 0.06, "triangle");
        this.blip(t + 0.09, 990, 0.16, 0.06, "triangle");
        return;
      case "bad": this.blip(t, 220, 0.18, 0.06, "sawtooth", 160); return;
      case "horn": return this.horn(0.08);
      case "hoot": return this.hoot(0.08);
      case "whoosh": return this.noiseHit(t, 0.35, 0.05, 900, 3000);
      case "sizzle":
        this.noiseHit(t, 1.4, 0.06, 3500, 9000);
        for (let i = 0; i < 6; i++) this.noiseHit(t + Math.random() * 1.2, 0.03, 0.08, 2000, 8000);
        return;
      case "kick": {
        // kick-start and rev
        this.noiseHit(t, 0.12, 0.08, 200, 1200);
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = "lowpass"; f.frequency.value = 700;
        o.frequency.setValueAtTime(40, t + 0.1);
        o.frequency.exponentialRampToValueAtTime(110, t + 0.5);
        o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
        g.gain.setValueAtTime(0, t + 0.1);
        g.gain.linearRampToValueAtTime(0.12, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        o.connect(f).connect(g).connect(this.sfxBus);
        o.start(t + 0.1); o.stop(t + 1.25);
        return;
      }
    }
  }

  private blip(t: number, freq: number, dur: number, vol: number, type: OscillatorType, to?: number, bus?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseHit(t: number, dur: number, vol: number, lo: number, hi: number, bus?: AudioNode) {
    const ctx = this.ctx!;
    const s = this.noiseSrc(false);
    const f1 = ctx.createBiquadFilter();
    f1.type = "highpass"; f1.frequency.value = lo;
    const f2 = ctx.createBiquadFilter();
    f2.type = "lowpass"; f2.frequency.value = hi;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f1).connect(f2).connect(g).connect(bus ?? this.sfxBus);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  /** Small boda horn: two quick bright beeps. */
  private horn(vol: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = 480 + Math.random() * 120;
    for (const dt of [0, 0.17]) {
      this.blip(t + dt, f, 0.12, vol, "square", undefined, this.ambBus);
      this.blip(t + dt, f * 1.26, 0.12, vol * 0.6, "square", undefined, this.ambBus);
    }
  }

  /** Matatu: a deeper two-tone hoot. */
  private hoot(vol: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 1400;
    f.connect(this.ambBus);
    for (const [freq, at, dur] of [[330, 0, 0.32], [415, 0, 0.32], [330, 0.42, 0.5], [415, 0.42, 0.5]] as const) this.blip(t + at, freq, dur, vol, "sawtooth", undefined, f);
  }

  private bird() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const base = 2600 + Math.random() * 1600;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.blip(t + i * 0.13, base * (1 + Math.random() * 0.15), 0.09, 0.014, "sine", base * 1.35, this.ambBus);
  }

  /** The hadada ibis, Kampala's loudest morning call: "haa-haa-haa". */
  private ibis() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = 2.5;
    const g = this.gain(1, this.ambBus);
    f.connect(g);
    for (let i = 0; i < 3; i++) this.blip(t + i * 0.32, 760 - i * 60, 0.26, 0.05, "sawtooth", 520 - i * 50, f);
  }

  // ---------- Studio 256 ----------

  /** A short afrobeat-style loop: kick, shaker, bass and a marimba-like melody. */
  private runMusic() {
    const ctx = this.ctx!;
    const step = 60 / 112 / 4; // sixteenth notes at 112 bpm
    if (this.music.nextAt < ctx.currentTime) this.music.nextAt = ctx.currentTime + 0.05;
    while (this.music.nextAt < ctx.currentTime + 0.25) {
      const t = this.music.nextAt;
      const s = this.music.step % 32;
      const bar = Math.floor(this.music.step / 16) % 4;
      if (s % 4 === 0 || s === 10 || s === 26) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(130, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(g).connect(this.musicBus);
        o.start(t); o.stop(t + 0.22);
      }
      if (!this.lite) this.noiseHit(t, 0.04, s % 2 ? 0.05 : 0.09, 6000, 12000, this.musicBus);
      const root = [45, 45, 41, 43][bar];
      if ([0, 3, 6, 8, 11, 14].includes(s % 16)) this.blip(t, 440 * 2 ** ((root - 69) / 12), 0.22, 0.28, "triangle", undefined, this.musicBus);
      if ([2, 5, 7, 10, 13, 15].includes(s % 16) && (s + bar) % 3 !== 0) {
        const n = 69 + PENTA[(s * 3 + bar * 2) % 5] + (s % 7 === 0 ? 12 : 0) + (root - 45);
        this.blip(t, 440 * 2 ** ((n - 69) / 12), 0.28, 0.16, "sine", undefined, this.musicBus);
        this.blip(t, 440 * 2 ** ((n - 57) / 12), 0.12, 0.05, "sine", undefined, this.musicBus);
      }
      this.music.step++;
      this.music.nextAt += step;
    }
  }

  // ---------- voices ----------

  private pickVoice() {
    if (!("speechSynthesis" in window) || this.voice) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      // an East or West African English voice if the phone has one, then any English
      this.voice = vs.find((v) => /en[-_](UG|KE|TZ|NG|ZA|GH)/i.test(v.lang)) ?? vs.find((v) => /^en[-_]GB/i.test(v.lang)) ?? vs.find((v) => /^en/i.test(v.lang)) ?? null;
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  }

  /** Speaks a line aloud with the phone's own voice. Pitch varies by speaker. */
  speak(text: string, who = "", volume = 1) {
    if (!this.enabled || !this.voicesOn || !("speechSynthesis" in window) || document.hidden) return;
    if (speechSynthesis.pending || speechSynthesis.speaking) {
      // never build a queue of old lines
      if (who !== "you") return;
      speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s!?,.'-]/gu, ""));
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? "en-GB";
    let h = 0;
    for (const c of who) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    u.pitch = 0.8 + (h % 9) / 16;
    u.rate = 1.02 + (h % 5) / 40;
    u.volume = Math.max(0, Math.min(1, volume));
    speechSynthesis.speak(u);
  }

  /** Plays a voice hello from the server. */
  async playUrl(url: string): Promise<boolean> {
    try {
      const a = new Audio(url);
      a.volume = 1;
      await a.play();
      return true;
    } catch {
      return false;
    }
  }
}

export const sound = new Sound();
