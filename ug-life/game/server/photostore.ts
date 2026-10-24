// Where photo bytes live: Netlify Blobs on Netlify, D1 on Cloudflare (until R2 is
// enabled there). Each store has the same three methods.
import type { Db } from "./db";

export interface PhotoStore {
  put(id: string, mime: string, data: ArrayBuffer): Promise<void>;
  get(id: string): Promise<{ mime: string; data: ArrayBuffer } | null>;
  delete(id: string): Promise<void>;
}

export class D1PhotoStore implements PhotoStore {
  constructor(private db: Db) {}

  async put(id: string, mime: string, data: ArrayBuffer) {
    await this.db.prepare("INSERT INTO photo_blobs (id, mime, data) VALUES (?, ?, ?)").bind(id, mime, data).run();
  }

  async get(id: string) {
    const row = await this.db.prepare("SELECT mime, data FROM photo_blobs WHERE id = ?").bind(id).first<{ mime: string; data: ArrayBuffer | number[] }>();
    if (!row) return null;
    const data = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
    return { mime: row.mime, data };
  }

  async delete(id: string) {
    await this.db.prepare("DELETE FROM photo_blobs WHERE id = ?").bind(id).run();
  }
}

/** Netlify Blobs, structurally typed so this file doesn't import the Netlify SDK. */
interface BlobStore {
  set(key: string, data: ArrayBuffer, opts?: { metadata?: Record<string, unknown> }): Promise<unknown>;
  getWithMetadata(key: string, opts: { type: "arrayBuffer" }): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown> } | null>;
  delete(key: string): Promise<void>;
}

export class BlobsPhotoStore implements PhotoStore {
  constructor(private store: BlobStore) {}

  async put(id: string, mime: string, data: ArrayBuffer) {
    await this.store.set(id, data, { metadata: { mime } });
  }

  async get(id: string) {
    const r = await this.store.getWithMetadata(id, { type: "arrayBuffer" });
    return r ? { mime: String(r.metadata.mime ?? "image/jpeg"), data: r.data } : null;
  }

  async delete(id: string) {
    await this.store.delete(id);
  }
}
