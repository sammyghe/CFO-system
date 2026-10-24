# Ug Life: the game

A Kampala street you can live on. Phone-first web app (PWA), isometric 2.5D,
everything drawn in code so the whole game is about 40 KB gzipped.

## What's in this build (Phase 1 preview)

- One Wandegeya-style street: shops with hand-painted signs, taxi stage, market, kiosks,
  matatus that stop at the stage, bodas, rain, night with Kampala time (UTC+3)
- Ug Tag: name, status, look, up to 3 socials (shown as unverified), ghost mode
- Life loop: deliveries → simulated UGX → lease a kiosk → paint it → upgrades → customers
- Civic: report the pothole, neighbours add reports, a fictional ward office fixes it
- Daily street event, street goals, share card for WhatsApp Status, help + FAQ, settings
- 18+ gate, scam and abuse filters, block and report

Progress saves on the phone (localStorage). Online accounts use `supabase/schema.sql`
when switched on.

## Commands

```
npm install
npm run dev          # local dev server, open on your phone over Wi-Fi
npm test             # game rules: ledger, jobs, kiosk, civic, moderation
npm run build        # production build in dist/ (PWA)
npm run build:single # one self-contained HTML file in dist-single/ (for preview links)
```

Add `?debug=1` to the URL to expose `window.ug` for automated play tests.

## Deploy for free (Cloudflare Pages)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → connect this GitHub repo.
2. Root directory `ug-life/game`, build command `npm run build`, output `dist`.
3. Set `VITE_PUBLIC_URL` to the final link so share cards show it.
4. Every merge to the main branch deploys. Pull requests get preview links.

## Code map

| Folder | What |
|---|---|
| `src/game/` | Rules with no drawing: ledger, economy, actions, civic, moderation, daily events |
| `src/world/` | Map, isometric projection, art, simulation (people, traffic), renderer |
| `src/ui/` | HUD, panels, share card |
| `src/content/` | Residents and FAQ (the support agent uses the FAQ too) |
| `src/backend/` | Where saves go: local now, Supabase later |
| `supabase/` | Database schema with the server-side money rules |
| `tests/` | Rule tests |
