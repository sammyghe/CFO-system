import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getConnectionString } from "@netlify/database";
import pg from "pg";
import { handle } from "../../server/api";
import { PgDb } from "../../server/db";
import { BlobsPhotoStore } from "../../server/photostore";

// Postgres returns 64-bit integers and sums as strings; the game uses plain numbers.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

let pool: pg.Pool | null = null;

function db() {
  if (!pool) pool = new pg.Pool({ connectionString: getConnectionString(), max: 4, idleTimeoutMillis: 10_000 });
  return new PgDb(pool);
}

export default async (req: Request) => {
  let database: PgDb;
  try {
    database = db();
  } catch {
    return Response.json({ error: "The server isn't connected to its database yet." }, { status: 503 });
  }
  return handle(req, {
    db: database,
    photos: new BlobsPhotoStore(getStore({ name: "ug-life-photos", consistency: "strong" })),
    adminToken: Netlify.env.get("ADMIN_TOKEN"),
  });
};

export const config: Config = { path: "/api/*" };
