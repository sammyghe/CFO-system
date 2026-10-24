import { handle, type Env } from "../../server/api";

// Cloudflare Pages routes every /api/* request here.
export const onRequest: PagesFunction<Env> = (ctx) => handle(ctx.request, ctx.env);
