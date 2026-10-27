# Ug Life

**A Kampala street you can live on.** A phone-first web game: walk the street, do boda and delivery jobs, earn (simulated) UGX, lease a kiosk, paint your sign, buy land in real neighbourhoods, and greet your neighbours in Luganda.

▶ **Play:** [ug-life.netlify.app](https://ug-life.netlify.app) — opens from a WhatsApp or TikTok link, no app store, no download.

---

## Why it exists

Lagos Life showed that young Africans want games that look and sound like *their* city. Kampala has none. Ug Life is that game: bodas, rolex, matatus at the stage, rain, Makerere on the hill, rent day — real Kampala texture, not a generic world with a flag on it.

## What's in it today

- **One dense street** — shops, taxi stage, market, kiosks, matatus, 16 bodas, rain and night on Kampala time
- **A real life loop** — jobs → simulated UGX → lease a kiosk → upgrade it → customers come
- **Land** — cheap plots in 12 real neighbourhoods, build up, collect rent; ownership is held by the server
- **Street talk** — one-tap Luganda greetings, short messages, emotes, with scam filters, block and report
- **Street Snaps** — photograph a real street, faces and plates blurred on the phone, turned into street art
- **Civic layer** — report the pothole, neighbours add reports, a fictional ward office fixes it
- **Sounds of Kampala** — boda horns, hadada ibis, market murmur — all generated in code

The whole game is about **40 KB gzipped**, built to load on a cheap Android over 3G.

## How it's built

| | |
|---|---|
| Client | Own canvas engine in TypeScript, Vite, installable PWA |
| Server | Netlify Functions + Postgres + Blobs |
| Running cost | $0/month (free tiers) |
| Operations | Run by AI agents — support, moderation, health checks, deploys. The founder spends ~2 hours a week. |

## The operating model

Ug Life is also an experiment in **running a consumer product with agents, not staff**. One human on call, strict triage (only P0 incidents interrupt him), and agents that answer support, moderate, watch health and ship.

- [`ug-life/MASTER_PLAN.md`](ug-life/MASTER_PLAN.md) — what we build, phases and gates
- [`ug-life/AGENTS.md`](ug-life/AGENTS.md) — the agent charters
- [`ug-life/GROWTH.md`](ug-life/GROWTH.md) — how it spreads
- [`ug-life/ops/`](ug-life/ops/) — control room, runbooks, digests
- [`ug-life/game/`](ug-life/game/) — the game itself ([how to add content](ug-life/game/CONTENT.md))

## Rules we hold

- **No demo.** If something looks like it pays or saves, it really pays and saves — checked on the server, no double claims.
- **18+ at launch.** Child safety can't be carried by one person on $0, so we don't pretend.
- **Fictional council, no real officials, no real brands without permission, no real money.**

## Status

Phase 1 preview is live. Next gate: soft launch to ~100 invited testers.

---

Built in Kampala by [Sammy Ghedamu](https://github.com/sammyghe).
