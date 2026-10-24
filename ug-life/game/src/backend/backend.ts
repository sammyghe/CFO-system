import { SAVE_VERSION, newPlayer, type PlayerState } from "../game/state";

/**
 * Where player data lives. This build ships LocalBackend (the phone's storage).
 * The online backend (Supabase, see supabase/schema.sql) implements the same
 * interface and runs the money rules on the server.
 */
export interface Backend {
  readonly kind: "local" | "online";
  load(): PlayerState | null;
  save(state: PlayerState): void;
  reset(): void;
}

const KEY = "uglife.save.v1";

export class LocalBackend implements Backend {
  readonly kind = "local" as const;

  load(): PlayerState | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as PlayerState;
      if (!data || data.version !== SAVE_VERSION || !data.ledger) return null;
      // fill fields added after the save was written
      return { ...newPlayer(data.createdAt ?? Date.now(), data.id), ...data };
    } catch {
      return null;
    }
  }

  save(state: PlayerState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // storage full or blocked (private mode): the game keeps running, progress just isn't kept
    }
  }

  reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

export function newPlayerId(): string {
  try {
    return "p-" + crypto.randomUUID();
  } catch {
    return "p-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
