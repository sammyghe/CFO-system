// Turns a street photo into "real but illustrated" art, entirely on the phone:
// 1. Kuwahara smoothing (painterly, keeps edges sharp)
// 2. A small colour palette learnt from the photo (k-means), blended back with detail
// 3. A little more colour, then ink lines along strong edges
// No uploads, no AI service, no cost per photo.

export interface Img {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ToonOptions {
  /** Kuwahara radius for the first pass. */
  radius?: number;
  /** Palette size. */
  colors?: number;
  /** 0 = flat poster colours, 1 = keep all photo detail. */
  realism?: number;
  /** Fraction of pixels that become ink lines (0.04 - 0.15). */
  ink?: number;
  saturation?: number;
}

const DEFAULTS: Required<ToonOptions> = { radius: 3, colors: 12, realism: 0.35, ink: 0.08, saturation: 1.18 };

export function toonify(src: Img, options: ToonOptions = {}): Img {
  const o = { ...DEFAULTS, ...options };
  let img = kuwahara(src, o.radius);
  img = kuwahara(img, Math.max(1, o.radius - 1));
  const detail = img;
  const palette = kmeansPalette(img, o.colors);
  const out = new Uint8ClampedArray(img.data.length);
  const d = detail.data;
  for (let i = 0; i < d.length; i += 4) {
    const c = nearest(palette, d[i], d[i + 1], d[i + 2]);
    let r = palette[c * 3] * (1 - o.realism) + d[i] * o.realism;
    let g = palette[c * 3 + 1] * (1 - o.realism) + d[i + 1] * o.realism;
    let b = palette[c * 3 + 2] * (1 - o.realism) + d[i + 2] * o.realism;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * o.saturation;
    g = gray + (g - gray) * o.saturation;
    b = gray + (b - gray) * o.saturation;
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  inkEdges(detail, out, o.ink);
  return { width: src.width, height: src.height, data: out };
}

/** Kuwahara filter with summed-area tables: constant time per pixel whatever the radius. */
export function kuwahara(src: Img, r: number): Img {
  const { width: w, height: h, data } = src;
  const W = w + 1;
  const sR = new Float64Array(W * (h + 1));
  const sG = new Float64Array(W * (h + 1));
  const sB = new Float64Array(W * (h + 1));
  const sL = new Float64Array(W * (h + 1));
  const sL2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rr = 0, gg = 0, bb = 0, ll = 0, l2 = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const L = 0.299 * R + 0.587 * G + 0.114 * B;
      rr += R; gg += G; bb += B; ll += L; l2 += L * L;
      const j = (y + 1) * W + x + 1, k = y * W + x + 1;
      sR[j] = sR[k] + rr; sG[j] = sG[k] + gg; sB[j] = sB[k] + bb; sL[j] = sL[k] + ll; sL2[j] = sL2[k] + l2;
    }
  }
  const sum = (s: Float64Array, x0: number, y0: number, x1: number, y1: number) =>
    s[(y1 + 1) * W + x1 + 1] - s[y0 * W + x1 + 1] - s[(y1 + 1) * W + x0] + s[y0 * W + x0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = Infinity, br = 0, bg = 0, bb = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = Math.max(0, q & 1 ? x : x - r), x1 = Math.min(w - 1, q & 1 ? x + r : x);
        const y0 = Math.max(0, q & 2 ? y : y - r), y1 = Math.min(h - 1, q & 2 ? y + r : y);
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const mL = sum(sL, x0, y0, x1, y1) / n;
        const v = sum(sL2, x0, y0, x1, y1) / n - mL * mL;
        if (v < best) {
          best = v;
          br = sum(sR, x0, y0, x1, y1) / n;
          bg = sum(sG, x0, y0, x1, y1) / n;
          bb = sum(sB, x0, y0, x1, y1) / n;
        }
      }
      const i = (y * w + x) * 4;
      out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/** k-means on a deterministic sample of pixels. Returns [r,g,b, r,g,b, ...]. */
export function kmeansPalette(img: Img, k: number): Float64Array {
  const d = img.data;
  const total = d.length / 4;
  const step = Math.max(1, Math.floor(total / 4000));
  const sample: number[] = [];
  for (let p = 0; p < total; p += step) sample.push(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
  const n = sample.length / 3;
  const pal = new Float64Array(k * 3);
  // spread the starting colours across the brightness range so dark and bright areas both get one
  const order = [...Array(n).keys()].sort((a, b) => lum(sample, a) - lum(sample, b));
  for (let c = 0; c < k; c++) {
    const s = order[Math.min(n - 1, Math.floor(((c + 0.5) / k) * n))];
    pal[c * 3] = sample[s * 3]; pal[c * 3 + 1] = sample[s * 3 + 1]; pal[c * 3 + 2] = sample[s * 3 + 2];
  }
  const acc = new Float64Array(k * 4);
  for (let iter = 0; iter < 8; iter++) {
    acc.fill(0);
    for (let s = 0; s < n; s++) {
      const c = nearest(pal, sample[s * 3], sample[s * 3 + 1], sample[s * 3 + 2]);
      acc[c * 4] += sample[s * 3]; acc[c * 4 + 1] += sample[s * 3 + 1]; acc[c * 4 + 2] += sample[s * 3 + 2]; acc[c * 4 + 3]++;
    }
    for (let c = 0; c < k; c++) {
      const cnt = acc[c * 4 + 3];
      if (cnt) { pal[c * 3] = acc[c * 4] / cnt; pal[c * 3 + 1] = acc[c * 4 + 1] / cnt; pal[c * 3 + 2] = acc[c * 4 + 2] / cnt; }
    }
  }
  return pal;
}

function lum(s: number[], i: number) {
  return 0.299 * s[i * 3] + 0.587 * s[i * 3 + 1] + 0.114 * s[i * 3 + 2];
}

function nearest(pal: Float64Array, r: number, g: number, b: number): number {
  let best = 0, bd = Infinity;
  for (let c = 0; c < pal.length / 3; c++) {
    const dr = pal[c * 3] - r, dg = pal[c * 3 + 1] - g, db = pal[c * 3 + 2] - b;
    const dist = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (dist < bd) { bd = dist; best = c; }
  }
  return best;
}

/** Darkens the strongest edges (top `fraction` of Sobel magnitudes) into ink lines. */
function inkEdges(src: Img, out: Uint8ClampedArray, fraction: number) {
  const { width: w, height: h, data } = src;
  const L = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) L[p] = 0.299 * data[p * 4] + 0.587 * data[p * 4 + 1] + 0.114 * data[p * 4 + 2];
  const mag = new Float32Array(w * h);
  const hist = new Uint32Array(256);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const gx = L[p - w + 1] + 2 * L[p + 1] + L[p + w + 1] - L[p - w - 1] - 2 * L[p - 1] - L[p + w - 1];
      const gy = L[p + w - 1] + 2 * L[p + w] + L[p + w + 1] - L[p - w - 1] - 2 * L[p - w] - L[p - w + 1];
      const m = Math.min(255, Math.hypot(gx, gy) / 4);
      mag[p] = m;
      hist[m | 0]++;
    }
  // threshold at the requested percentile
  let count = 0, threshold = 255;
  const target = w * h * fraction;
  for (let v = 255; v >= 0; v--) {
    count += hist[v];
    if (count >= target) { threshold = Math.max(v, 12); break; }
  }
  for (let p = 0; p < w * h; p++) {
    if (mag[p] < threshold) continue;
    const strength = Math.min(1, (mag[p] - threshold) / 40 + 0.55);
    const i = p * 4;
    out[i] = out[i] * (1 - strength) + 22 * strength;
    out[i + 1] = out[i + 1] * (1 - strength) + 26 * strength;
    out[i + 2] = out[i + 2] * (1 - strength) + 38 * strength;
  }
}

/** Privacy blur: pixelates a circle so faces and number plates can't be read. */
export function pixelateCircle(img: Img, cx: number, cy: number, radius: number, block = 14) {
  const { width: w, height: h, data } = img;
  const x0 = Math.max(0, Math.floor((cx - radius) / block) * block);
  const y0 = Math.max(0, Math.floor((cy - radius) / block) * block);
  for (let by = y0; by < Math.min(h, cy + radius); by += block)
    for (let bx = x0; bx < Math.min(w, cx + radius); bx += block) {
      const mx = bx + block / 2, my = by + block / 2;
      if ((mx - cx) ** 2 + (my - cy) ** 2 > radius * radius) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = by; y < Math.min(h, by + block); y++)
        for (let x = bx; x < Math.min(w, bx + block); x++) {
          const i = (y * w + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      for (let y = by; y < Math.min(h, by + block); y++)
        for (let x = bx; x < Math.min(w, bx + block); x++) {
          const i = (y * w + x) * 4;
          data[i] = r / n; data[i + 1] = g / n; data[i + 2] = b / n;
        }
    }
}
