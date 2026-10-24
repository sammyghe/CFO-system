// The player's own snaps live on the phone (IndexedDB), so they work offline and
// nothing leaves the phone until the player chooses to share.

import type { SnapMeta } from "../game/snaps";

export interface SnapRecord extends SnapMeta {
  blob: Blob;
  serverId?: string;
}

const DB = "uglife";
const STORE = "snaps";
const memory = new Map<string, SnapRecord>();

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSnap(s: SnapRecord): Promise<void> {
  memory.set(s.id, s);
  await tx("readwrite", (st) => st.put(s));
}

export async function listSnaps(): Promise<SnapRecord[]> {
  const all = (await tx<SnapRecord[]>("readonly", (st) => st.getAll())) ?? [];
  const byId = new Map(all.map((s) => [s.id, s]));
  for (const [k, v] of memory) if (!byId.has(k)) byId.set(k, v);
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteSnap(id: string): Promise<void> {
  memory.delete(id);
  await tx("readwrite", (st) => st.delete(id));
}
