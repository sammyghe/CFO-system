import { describe, expect, it } from "vitest";
import { kuwahara, pixelateCircle, toonify, type Img } from "../src/snaps/toon";

function photo(w = 80, h = 60): Img {
  // left half "wall" (orange), right half "road" (grey), with sensor noise
  const data = new Uint8ClampedArray(w * h * 4);
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 40;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const base = x < w / 2 ? [200, 110, 60] : [90, 92, 98];
      data[i] = base[0] + rnd(); data[i + 1] = base[1] + rnd(); data[i + 2] = base[2] + rnd(); data[i + 3] = 255;
    }
  return { width: w, height: h, data };
}

function colors(img: Img) {
  const set = new Set<number>();
  for (let i = 0; i < img.data.length; i += 4) set.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
  return set.size;
}

describe("street photo to art", () => {
  it("keeps the size and flattens noise into fewer colours", () => {
    const src = photo();
    const out = toonify(src, { realism: 0 });
    expect(out.width).toBe(80);
    expect(out.height).toBe(60);
    expect(colors(out)).toBeLessThan(colors(src) / 10);
  });

  it("draws an ink line where the wall meets the road", () => {
    const out = toonify(photo());
    const lumAt = (x: number, y: number) => {
      const i = (y * 80 + x) * 4;
      return 0.299 * out.data[i] + 0.587 * out.data[i + 1] + 0.114 * out.data[i + 2];
    };
    const edge = Math.min(lumAt(39, 30), lumAt(40, 30));
    expect(edge).toBeLessThan(lumAt(10, 30) * 0.7);
    expect(edge).toBeLessThan(lumAt(70, 30) * 0.9);
  });

  it("smoothing keeps the edge sharp", () => {
    const k = kuwahara(photo(), 3);
    expect(k.data[(30 * 80 + 36) * 4]).toBeGreaterThan(150); // still orange just left of the edge
    expect(k.data[(30 * 80 + 43) * 4]).toBeLessThan(120); // still grey just right
  });

  it("privacy blur makes each block one colour", () => {
    const img = photo();
    pixelateCircle(img, 20, 20, 15, 10);
    const i1 = (20 * 80 + 20) * 4, i2 = (21 * 80 + 22) * 4;
    expect(img.data[i1]).toBe(img.data[i2]);
  });
});
