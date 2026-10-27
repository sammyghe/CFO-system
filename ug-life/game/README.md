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
- Street life: 16 bodas on the road; take one anywhere for a fare, or rent one for the day
  and carry passengers who wave you down (up to 15 paid rides a day). Musa's rolex, roasted
  maize and fruit carts give a pay boost. Build chairs, lights, crates and more in your kiosk
  yard; everyone sees it and some items bring extra customers
- Kampala landmarks on the hills (Makerere, the National Mosque, Namirembe, Rubaga, the Bahá'í
  temple, the city centre, Mulago) plus the Makerere gate: tap to discover, each pays once
- Shared street: one owner per kiosk plot, held by the server; everyone sees each other's
  kiosks and yards. Invite links pay UGX 3,000 to the inviter once the friend does a real job,
  and UGX 2,000 to the friend. Goals pay out when claimed
- Street talk: one-tap Luganda and street phrases ("Oli otya?", "Gyebale ko!"), short typed
  messages, emotes (wave, dance…) and 4-second voice hellos, shown as bubbles to everyone nearby.
  Residents answer. Scam and phone-number filter, report (two reports hide a message), block,
  and a `talk_enabled` kill switch
- Sounds of Kampala, all made in code (`src/audio/sound.ts`, nothing to download): boda engines
  and horns, matatu hoots, birds and the hadada ibis, crickets, rain, market murmur, afrobeat from
  Studio 256, and conductors and vendors calling out with the phone's own voice
- Mobile-first bottom bar (Go, Boda, Jobs, Talk, More); Go lists every place with Walk and Boda;
  a far tap offers a boda; lite mode for slow phones (turns on by itself)
- Kampala land: cheap plots in 12 real neighbourhoods, build up to apartments, daily rent, one hot
  area a day, server-held ownership and prices; cheap snacks from UGX 200; leaderboard
- Four areas of Kampala: Wandegeya, Makerere University (clock tower, library, Lumumba Hall,
  Freedom Square), Owino Market (stalls, mivumba, fabric) and Kabalagala (club, pork joint,
  lounge, gym). Travel by matatu, boda or on foot; each area has its own people, shifts, carts,
  billboards and weekly chairperson (`src/world/areas.ts`, how to add one in `CONTENT.md`)
- Needs like Lagos Life (food, clean, fun, friends), rooms to rent by the week, washrooms and
  venues; friends and private messages between players; befriend, treat and date characters;
  Nepo or Hustler start; sound settings (all, volume, street, effects, music, voices)
- Wallet: add real money as game shillings with crypto (USDT on TRON, unique amount per player,
  read from the blockchain, credited once; `server/crypto.ts`) or mobile money (Flutterwave).
  One way only. Load protection: server-paced polling, CDN-cached public reads, Busy day lever
- Energy (food gives it, work uses it), shop shifts at 25 shops, a Work screen listing every way
  to earn and spend with steps; billboards (player rentals, brand ads from the Control Room);
  ideas, votes and rallies; What's new and live events with rewards; share links to places and
  events; mobile money top-ups (built, off until a Flutterwave key is set). See `../GROWTH.md`
- Online: anonymous accounts with a recovery code, saves checked against the money rules on
  the server (`src/game/validate.ts`), real players visible on the street, support tickets with
  replies, reports, daily event counts, and the Control Room (`/admin.html`)

The game is local-first: it plays fully offline, and syncs when there's signal. If the
server is down or over its free limit, nobody loses progress.

## Adding content

New carts, yard items, landmarks, residents, events and buildings are one entry each. See
[CONTENT.md](CONTENT.md).

## Commands

```
npm install
npm run dev          # local dev server, open on your phone over Wi-Fi
npm test             # game rules: ledger, jobs, kiosk, civic, moderation
npm run build        # production build in dist/ (PWA)
npm run build:single # one self-contained HTML file in dist-single/ (for preview links)
```

Add `?debug=1` to the URL to expose `window.ug` for automated play tests.

## Hosting

**Live: https://ug-life.netlify.app** (Netlify: CDN + Functions + Netlify Database (Postgres) + Blobs
for snap images). Deployed by `.github/workflows/ug-life-netlify.yml`, started by Claude through
the Netlify connection; Netlify applies `netlify/database/migrations` on each deploy.

The same API also runs on Cloudflare (standby, for when traffic outgrows Netlify's free plan):

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
| `src/content/` | Catalog (bodas, food, yard items), landmarks, residents, FAQ (the support agent uses the FAQ too) |
| `src/backend/` | Saves on the phone |
| `src/net/` | Talking to the server; everything works offline if it fails |
| `src/snaps/` | Photo to street art, privacy blur, the snaps panels, on-phone album |
| `src/admin/` | The Control Room page |
| `server/`, `functions/` | The API (Cloudflare Pages Functions) |
| `migrations/` | Database schema |
| `tests/` | Rules, server save checks, photo filter |
