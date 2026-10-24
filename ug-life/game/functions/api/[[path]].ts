import { handle } from "../../server/api";
import { D1PhotoStore } from "../../server/photostore";
import type { Db } from "../../server/db";

interface CfEnv {
  DB: D1Database;
  ADMIN_TOKEN?: string;
}

// Cloudflare Pages routes every /api/* request here.
export const onRequest: PagesFunction<CfEnv> = (ctx) => {
  const db = ctx.env.DB as unknown as Db;
  return handle(ctx.request, { db, photos: new D1PhotoStore(db), adminToken: ctx.env.ADMIN_TOKEN });
};
