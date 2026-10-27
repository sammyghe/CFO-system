// Real money in with crypto: players send USDT (TRC20, on the TRON network) to the
// game's own address. Each deposit gets a unique amount (e.g. 5.0371 USDT), so the
// server knows whose it is by reading the blockchain. No sign-up with any provider:
// all it needs is a receiving address, set in the Control Room. One way only: game
// shillings can't be cashed out, sold or bet.

/** Tether USD on TRON. */
export const USDT_TRC20 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

export interface Transfer {
  txId: string;
  /** USDT in millionths (6 decimals), so 5.0371 USDT = 5_037_100. */
  micro: number;
  at: number;
  to: string;
}

export interface ChainWatcher {
  /** Confirmed USDT transfers into `address` since `since` (ms), newest first. */
  transfersTo(address: string, since: number): Promise<Transfer[] | null>;
}

/** A TRON address: base58, starts with T, 34 characters. */
export function isTronAddress(a: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
}

interface TronGridTrc20 {
  success?: boolean;
  data?: { transaction_id?: string; token_info?: { address?: string; decimals?: number }; block_timestamp?: number; to?: string; value?: string }[];
}

/** Reads TronGrid's TRC20 history for an address. Only USDT, only confirmed, only incoming. */
export function parseTronGrid(json: TronGridTrc20, address: string): Transfer[] {
  const out: Transfer[] = [];
  for (const t of json.data ?? []) {
    if (t.token_info?.address !== USDT_TRC20 || t.to !== address || !t.transaction_id) continue;
    const decimals = t.token_info.decimals ?? 6;
    const raw = Number(t.value);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    out.push({ txId: t.transaction_id, micro: Math.round(raw * 10 ** (6 - decimals)), at: t.block_timestamp ?? 0, to: t.to });
  }
  return out;
}

export class TronUsdt implements ChainWatcher {
  private cache = new Map<string, { at: number; list: Transfer[] }>();
  constructor(private apiKey?: string, private base = "https://api.trongrid.io") {}

  async transfersTo(address: string, since: number) {
    // Many players checking at once share one call per 10 seconds.
    const hit = this.cache.get(address);
    if (hit && Date.now() - hit.at < 10_000) return hit.list.filter((t) => t.at >= since);
    const q = new URLSearchParams({ only_to: "true", only_confirmed: "true", contract_address: USDT_TRC20, limit: "200", min_timestamp: String(Math.max(0, Date.now() - 6 * 3600_000)) });
    try {
      const res = await fetch(`${this.base}/v1/accounts/${address}/transactions/trc20?${q}`, {
        headers: this.apiKey ? { "TRON-PRO-API-KEY": this.apiKey } : {},
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const list = parseTronGrid((await res.json()) as TronGridTrc20, address);
      this.cache.set(address, { at: Date.now(), list });
      return list.filter((t) => t.at >= since);
    } catch {
      return null;
    }
  }
}
