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

- Street Snaps: photograph a real street, blur faces and plates, the phone turns it into
  street art (`src/snaps/toon.ts`, no AI service, no cost), share it for review, approved snaps
  go on the community board and the rooftop billboard; areas race to be built next
- Online: anonymous accounts with a recovery code, saves checked against the money rules on
  the server (`src/game/validate.ts`), real players visible on the street, support tickets with
  replies, reports, daily event counts, and the Control Room (`/admin.html`)

The game is local-first: it plays fully offline, and syncs when there's signal. If the
server is down or over its free limit, nobody loses progress.

## Commands

```
npm install
npm run dev          # local dev server, open on your phone over Wi-Fi
npm test             # game rules: ledger, jobs, kiosk, civic, moderation
npm run build        # production build in dist/ (PWA)
npm run build:single # one self-contained HTML file in dist-single/ (for preview links)
```

Add `?debug=1` to the URL to expose `window.ug` for automated play tests.

## Hosting (Cloudflare, free tier)

| Piece | Service | Free allowance | When it grows |
|---|---|---|---|
| Game files | Cloudflare Pages CDN | Unlimited requests and bandwidth | Never needs upgrading |
| API (`functions/api`) | Pages Functions | 100,000 requests a day (roughly 5,000 daily players) | Workers Paid, $5/month, 10M requests |
| Database + photos | D1 `ug-life-db` | 5 GB, 5M reads and 100k writes a day | Workers Paid raises it; photos can move to R2 |

Deploys are automatic (`.github/workflows/ug-life-deploy.yml`): every push builds, tests and
deploys; `main` is the live site, other branches get preview links. It needs two repository
secrets: `CLOUDFLARE_API_TOKEN` and `UGLIFE_ADMIN_TOKEN`. A health check
(`ug-life-health.yml`) opens a P0 GitHub issue if the site or API stops answering.

## Running the whole thing locally

```
npm run build
npm run db:local                       # local copy of the database
echo 'ADMIN_TOKEN="any-long-test-password"' > .dev.vars
npm run serve:local                    # game + API + Control Room on http://localhost:8788
```

## Code map

| Folder | What |
|---|---|
| `src/game/` | Rules with no drawing: ledger, economy, actions, civic, moderation, daily events |
| `src/world/` | Map, isometric projection, art, simulation (people, traffic), renderer |
| `src/ui/` | HUD, panels, share card |
| `src/content/` | Residents and FAQ (the support agent uses the FAQ too) |
| `src/backend/` | Saves on the phone |
| `src/net/` | Talking to the server; everything works offline if it fails |
| `src/snaps/` | Photo to street art, privacy blur, the snaps panels, on-phone album |
| `src/admin/` | The Control Room page |
| `server/`, `functions/` | The API (Cloudflare Pages Functions) |
| `migrations/` | Database schema |
| `tests/` | Rules, server save checks, photo filter |
