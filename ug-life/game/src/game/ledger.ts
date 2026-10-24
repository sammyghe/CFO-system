// Append-only money ledger. Every change has a unique key so a repeated
// request (double tap, retry, replayed network call) can never pay twice.
// The Supabase function `post_ledger` in supabase/schema.sql mirrors these rules.

export interface LedgerEntry {
  key: string;
  amount: number;
  reason: string;
  at: number;
}

export interface Ledger {
  entries: LedgerEntry[];
}

export type LedgerError = "duplicate" | "insufficient" | "invalid";

export type LedgerResult =
  | { ok: true; balance: number; entry: LedgerEntry }
  | { ok: false; error: LedgerError; balance: number };

export function emptyLedger(): Ledger {
  return { entries: [] };
}

export function balanceOf(ledger: Ledger): number {
  let total = 0;
  for (const e of ledger.entries) total += e.amount;
  return total;
}

export function hasKey(ledger: Ledger, key: string): boolean {
  return ledger.entries.some((e) => e.key === key);
}

export function post(ledger: Ledger, key: string, amount: number, reason: string, at: number): LedgerResult {
  const balance = balanceOf(ledger);
  if (!key || !Number.isInteger(amount) || amount === 0) return { ok: false, error: "invalid", balance };
  if (hasKey(ledger, key)) return { ok: false, error: "duplicate", balance };
  if (balance + amount < 0) return { ok: false, error: "insufficient", balance };
  const entry: LedgerEntry = { key, amount, reason, at };
  ledger.entries.push(entry);
  return { ok: true, balance: balance + amount, entry };
}
