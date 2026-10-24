// Kampala is UTC+3 all year (no daylight saving).
const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function kampalaDateKey(ts: number): string {
  return new Date(ts + KAMPALA_OFFSET_MS).toISOString().slice(0, 10);
}

export function kampalaHour(ts: number): number {
  const d = new Date(ts + KAMPALA_OFFSET_MS);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Small deterministic hash for seeding daily content. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 seeded random generator. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
