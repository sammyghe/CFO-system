// The server's check on every save a phone sends. The game runs on the phone (so it
// keeps working on bad connections), and the server refuses any save whose ledger
// breaks the rules. Shared by the client tests and functions/api.

import type { LedgerEntry } from "./ledger";
import type { PlayerState } from "./state";
import { DAILY_VISIT_BONUS, JOB_MAX, KIOSK_BASE_INCOME, KIOSK_LEASE_PRICE, UPGRADES, WELCOME_GRANT, JOBS_PER_DAY } from "./economy";
import { SNAP_REWARD } from "./snaps";
import { kampalaDateKey } from "./time";

export const MAX_EVENT_BONUS = 1.3;
export const MAX_DAILY_EARN = 70_000;
const MAX_KIOSK_DAY = Math.round((KIOSK_BASE_INCOME + UPGRADES.reduce((a, u) => a + u.incomeBonus, 0)) * MAX_EVENT_BONUS);

export interface Verdict {
  ok: boolean;
  /** Breaks a hard rule: the save is refused. */
  errors: string[];
  /** Unusual but allowed: recorded for the economy watchdog. */
  warnings: string[];
}

export function validateSave(prev: PlayerState | null, next: PlayerState, now: number): Verdict {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!next || typeof next !== "object" || !next.ledger || !Array.isArray(next.ledger.entries)) {
    return { ok: false, errors: ["malformed save"], warnings };
  }
  const entries = next.ledger.entries;
  const old = prev?.ledger.entries ?? [];

  // append-only: everything the server already has must be unchanged, in order
  if (entries.length < old.length) errors.push("ledger shrank");
  for (let i = 0; i < Math.min(old.length, entries.length); i++) {
    const a = old[i], b = entries[i];
    if (a.key !== b.key || a.amount !== b.amount) {
      errors.push(`ledger entry ${i} was changed`);
      break;
    }
  }

  const seen = new Set<string>();
  const perDay = new Map<string, { jobs: number; sales: number; earned: number; snaps: number }>();
  let balance = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (typeof e.key !== "string" || !Number.isInteger(e.amount) || e.amount === 0 || typeof e.at !== "number") {
      errors.push(`entry ${i} is malformed`);
      break;
    }
    if (seen.has(e.key)) errors.push(`duplicate key ${e.key}`);
    seen.add(e.key);
    balance += e.amount;
    if (balance < 0) errors.push(`balance went negative at ${e.key}`);
    if (i >= old.length) {
      if (e.at > now + 5 * 60_000) errors.push(`entry from the future: ${e.key}`);
      const problem = checkEntry(e);
      if (problem) errors.push(problem);
    }
    const day = kampalaDateKey(e.at);
    const d = perDay.get(day) ?? { jobs: 0, sales: 0, earned: 0, snaps: 0 };
    if (e.key.startsWith("job:")) d.jobs++;
    if (e.key.startsWith("sale:")) d.sales++;
    if (e.key.startsWith("snap:")) d.snaps++;
    if (e.amount > 0) d.earned += e.amount;
    perDay.set(day, d);
  }
  for (const [day, d] of perDay) {
    if (d.jobs > JOBS_PER_DAY) errors.push(`${d.jobs} paid deliveries on ${day}`);
    if (d.sales * 500 > MAX_KIOSK_DAY) errors.push(`kiosk sales above the daily cap on ${day}`);
    if (d.snaps > 1) errors.push(`more than one paid snap on ${day}`);
    if (d.earned > MAX_DAILY_EARN) warnings.push(`earned UGX ${d.earned} on ${day}`);
  }
  if (next.xp < (prev?.xp ?? 0)) warnings.push("xp went down");
  if (next.xp > 50 * entries.length + 200) warnings.push("xp unusually high");
  return { ok: errors.length === 0, errors: [...new Set(errors)].slice(0, 10), warnings };
}

function checkEntry(e: LedgerEntry): string | null {
  const [kind] = e.key.split(":");
  const a = e.amount;
  switch (kind) {
    case "welcome": return e.key === "welcome" && a === WELCOME_GRANT ? null : "bad welcome grant";
    case "daily": return a === DAILY_VISIT_BONUS ? null : "bad daily bonus";
    case "job": return a > 0 && a <= Math.ceil(JOB_MAX * MAX_EVENT_BONUS) ? null : `job pay out of range: ${a}`;
    case "sale": return a === 500 ? null : "bad sale amount";
    case "away": return a > 0 && a <= MAX_KIOSK_DAY ? null : "kiosk away income out of range";
    case "snap": return a === SNAP_REWARD ? null : "bad snap reward";
    case "lease":
    case "renew": return a === -KIOSK_LEASE_PRICE ? null : "bad lease price";
    case "upgrade": {
      const id = e.key.split(":")[2];
      const u = UPGRADES.find((x) => x.id === id);
      return u && a === -u.price ? null : "bad upgrade price";
    }
    default: return a < 0 ? null : `unknown income: ${e.key}`;
  }
}
