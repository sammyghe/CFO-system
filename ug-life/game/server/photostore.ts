/// <reference types="@cloudflare/workers-types" />
// Where photo bytes live. D1 now (free, no card needed). When R2 is enabled on the
// account, add an R2PhotoStore with the same three methods and switch in api.ts.

export interface PhotoStore {
  put(id: string, mime: string, data: ArrayBuffer): Promise<void>;
  get(id: string): Promise<{ mime: string; data: ArrayBuffer } | null>;
  delete(id: string): Promise<void>;
}

export class D1PhotoStore implements PhotoStore {
  constructor(private db: D1Database) {}

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
