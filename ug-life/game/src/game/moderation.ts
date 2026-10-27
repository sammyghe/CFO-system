// First-line text checks. Runs on the device for instant feedback; the server
// repeats them. Gray cases go to the moderation agent's queue, not to a ban.

const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "fag", "whore", "slut", "rape", "porn", "nude",
  "kill yourself", "kys", "admin", "moderator", "official support", "ug life support",
];

const SCAM_PATTERNS = [
  /send\s+(me\s+)?money/i,
  /(send|give|lend|loan|top\s*up)\s+(me\s+)?(some\s+|a\s+little\s+)?(mobile\s*money|money|cash|airtime|momo)/i,
  /\b(momo|airtel\s*money|mtn\s*money)\b.*\b(number|send|pay)/i,
  /mobile\s*money\s*(number|no)/i,
  /\bpin\b/i,
  /double\s+your/i,
  /free\s+(airtime|data|cash)/i,
  /whats\s*app\s*me/i,
];

const URL_LIKE = /(https?:\/\/|www\.|\.(com|ug|ke|net|org|io|app|link|ly)\b)/i;
const PHONE_LIKE = /(\+?256|\+?254|\b0)[\s-]?\d{2,3}[\s-]?\d{3}[\s-]?\d{3}/;

export type CheckResult = { ok: true; value: string } | { ok: false; reason: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[^a-z ]/g, "");
}

function containsBlocked(s: string): boolean {
  const n = normalize(s);
  const squashed = n.replace(/ /g, "");
  return BLOCKED_WORDS.some((w) => n.includes(w) || squashed.includes(w.replace(/ /g, "")));
}

export function checkDisplayName(raw: string): CheckResult {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 2) return { ok: false, reason: "Use at least 2 characters." };
  if (value.length > 20) return { ok: false, reason: "Keep it to 20 characters or fewer." };
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(value)) return { ok: false, reason: "Use letters, numbers, spaces, dots, dashes or underscores." };
  if (URL_LIKE.test(value) || PHONE_LIKE.test(value)) return { ok: false, reason: "Names can't contain links or phone numbers." };
  if (containsBlocked(value) || SCAM_PATTERNS.some((p) => p.test(value))) return { ok: false, reason: "That name isn't allowed. Try another." };
  return { ok: true, value };
}

export function checkFreeText(raw: string, max: number): CheckResult {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length > max) return { ok: false, reason: `Keep it to ${max} characters or fewer.` };
  if (URL_LIKE.test(value)) return { ok: false, reason: "Add links in the socials section instead." };
  if (PHONE_LIKE.test(value)) return { ok: false, reason: "Don't post phone numbers. Scammers collect them." };
  if (containsBlocked(value)) return { ok: false, reason: "That text isn't allowed." };
  if (SCAM_PATTERNS.some((p) => p.test(value))) return { ok: false, reason: "That looks like a scam message, so it can't be posted." };
  return { ok: true, value };
}

export type Platform = "tiktok" | "instagram" | "x" | "youtube" | "facebook";

export const PLATFORMS: { id: Platform; label: string; short: string }[] = [
  { id: "tiktok", label: "TikTok", short: "Tk" },
  { id: "instagram", label: "Instagram", short: "Ig" },
  { id: "x", label: "X", short: "X" },
  { id: "youtube", label: "YouTube", short: "Yt" },
  { id: "facebook", label: "Facebook", short: "Fb" },
];

export function checkHandle(platform: Platform, raw: string): CheckResult {
  const value = raw.trim().replace(/^@/, "");
  const rules: Record<Platform, RegExp> = {
    tiktok: /^[A-Za-z0-9_.]{2,24}$/,
    instagram: /^[A-Za-z0-9_.]{1,30}$/,
    x: /^[A-Za-z0-9_]{1,15}$/,
    youtube: /^[A-Za-z0-9_.-]{3,30}$/,
    facebook: /^[A-Za-z0-9.]{5,50}$/,
  };
  if (!rules[platform].test(value)) return { ok: false, reason: "That doesn't look like a valid handle." };
  return { ok: true, value };
}

/** We build the link ourselves, so players can never inject an arbitrary URL. */
export function profileUrl(platform: Platform, handle: string): string {
  const h = encodeURIComponent(handle);
  switch (platform) {
    case "tiktok": return `https://www.tiktok.com/@${h}`;
    case "instagram": return `https://www.instagram.com/${h}`;
    case "x": return `https://x.com/${h}`;
    case "youtube": return `https://www.youtube.com/@${h}`;
    case "facebook": return `https://www.facebook.com/${h}`;
  }
}
