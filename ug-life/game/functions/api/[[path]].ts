import { handle } from "../../server/api";
import { D1PhotoStore } from "../../server/photostore";
import type { Db } from "../../server/db";
import { TronUsdt } from "../../server/crypto";

interface CfEnv {
  DB: D1Database;
  ADMIN_TOKEN?: string;
  TRONGRID_API_KEY?: string;
  /** Another TronGrid-compatible server (local tests use a stand-in). */
  TRONGRID_BASE?: string;
}

let chain: TronUsdt | null = null;

// Cloudflare Pages routes every /api/* request here.
export const onRequest: PagesFunction<CfEnv> = (ctx) => {
  const db = ctx.env.DB as unknown as Db;
  chain ??= new TronUsdt(ctx.env.TRONGRID_API_KEY, ctx.env.TRONGRID_BASE || undefined);
  return handle(ctx.request, { db, photos: new D1PhotoStore(db), adminToken: ctx.env.ADMIN_TOKEN, chain });
};
