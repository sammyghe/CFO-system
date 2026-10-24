// One small database interface so the same API runs on Cloudflare D1 (SQLite)
// or on Netlify Database (Postgres). SQL in api.ts sticks to the common subset
// and uses "?" placeholders; the Postgres adapter rewrites them to $1, $2, ...

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface Db {
  prepare(sql: string): Stmt;
  batch(statements: Stmt[]): Promise<unknown>;
}

/** Minimal shape of a node-postgres Pool / PoolClient. */
interface PgQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
interface PgPool extends PgQueryable {
  connect(): Promise<PgQueryable & { release(): void }>;
}

export function toPositional(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

class PgStmt implements Stmt {
  constructor(private q: PgQueryable, readonly sql: string, readonly params: unknown[] = []) {}
  bind(...values: unknown[]): Stmt {
    return new PgStmt(this.q, this.sql, values);
  }
  async first<T>() {
    const r = await this.q.query(toPositional(this.sql), this.params);
    return (r.rows[0] as T) ?? null;
  }
  async all<T>() {
    const r = await this.q.query(toPositional(this.sql), this.params);
    return { results: r.rows as T[] };
  }
  async run() {
    return this.q.query(toPositional(this.sql), this.params);
  }
}

export class PgDb implements Db {
  constructor(private pool: PgPool) {}
  prepare(sql: string): Stmt {
    return new PgStmt(this.pool, sql);
  }
  async batch(statements: Stmt[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const s of statements as PgStmt[]) await client.query(toPositional(s.sql), s.params);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
