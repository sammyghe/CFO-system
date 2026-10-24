# UG LIFE — Master Plan v0.4

Side project. Separate from Maji Safi in money, time, brand and accounts.
This file merges: Kampala Life GDD v1.0, Ug Life brief v0.2 addendum, Operating Model v0.3,
and the founder constraints set on 2026-10-24. Where they conflict, this file wins.

## 0. Founder constraints (binding)

| Constraint | Value | Consequence |
|---|---|---|
| Founder time once live | ~2 hours / week | Agents run daily operations; founder only approves and tests |
| Budget before revenue | $0 / month unless absolutely needed | Free tiers only; first paid line items listed in §8 |
| Human on call | Sammy only | Strict triage: only P0 events interrupt him (§6) |
| First platform | Web link (PWA) | Opens from WhatsApp/TikTok links, no store review, add-to-home-screen |

## 1. What we build first

- **Name:** Ug Life (v0.2 overrides "Kampala Life"). Name clearance at URSB before spending on brand.
- **Format:** isometric 2.5D (Habbo-style, realistic Kampala look), not full 3D. Phone-first.
  Built so a 3D client can be added later on the same server and data.
- **Audience:** 18+ at launch. The GDD's "broad audience incl. children" is deferred: child
  privacy, moderation and parental controls cannot be carried by one person on $0.
- **World:** one street block of one neighborhood, done properly.
- **First life loop:** arrive → make Ug Tag → walk the street → do a paid task (delivery/kiosk shift)
  → earn simulated UGX → lease a kiosk → customise sign → share your tag/shop card to WhatsApp → return
  tomorrow for the daily event.
- **Ug Tag:** floating name tag + profile card with verified socials (sign-in verified), privacy
  toggles, ghost mode, block/report.
- **Civic layer:** one fictional pothole issue with a report → fix flow. Fictional council only.
- **Out of scope for v1:** real money, betting, real brands without permission, real officials,
  Nairobi, voice chat, user-uploaded code, drivable vehicles, large multiplayer.

## 2. Phases and gates

| Phase | What | Gate to move on |
|---|---|---|
| 0 Research | Research list (§9), Lagos Life teardown, Kampala photo pack, name check | Sammy approves plan |
| 1 Build | One street, Ug Tag, life loop, ledger, support + moderation agents switched on | Full day loop works on a cheap Android over 3G/4G; first load ≤ 5 MB |
| 2 Soft launch | ~100 invited testers | D1 ≥ 30%, D7 ≥ 10%, 0 open P0, support answers < 24 h (starting targets) |
| 3 Viral launch | Creators, campuses, WhatsApp Status, weekly challenge | Rate limits + queue tested at 10× soft-launch load |
| 4 Scale | Events, shops, creator tools, revenue, then Nairobi | Revenue covers running costs |

## 3. Tech stack ($0)

- Client: own lightweight canvas engine in TypeScript (no Phaser), Vite, PWA (service worker,
  offline shell, install prompt). Whole game ~40 KB gzipped, far under the 5 MB budget.
- Art: drawn in code for now (no downloads). Next: Sammy's own Kampala street photos as reference,
  then CC0 packs or a freelance artist once there's revenue. Every asset logged with its source and licence.
- Hosting (live): Netlify `ug-life` (https://ug-life.netlify.app): CDN, Functions for the API,
  Netlify Database (Postgres) and Blobs for snap images. Chosen because it could be deployed
  without Sammy creating keys. Standby: the same API on Cloudflare Pages + D1 `ug-life-db`
  (created, in the Maji Safi Cloudflare account, named separately) for when traffic outgrows
  Netlify's free plan.
- Accounts: anonymous, with a recovery code. No phone number or email collected.
- Money safety: the game runs on the phone; every save is checked on the server against the
  rules (append-only ledger, price and pay limits, daily caps). Breaking saves are refused and flagged.
- Presence: real players shown where they last saved (refreshed every 30 s). True real-time
  multiplayer (Durable Objects) when player numbers justify it.
- Monitoring: GitHub Action health check every 30 min opens a P0 issue; own daily event counts.
- Ops brain: this GitHub repo. Agents read/write `ops/` (tickets, digests, decisions).

## 4. The company on paper (Google-style functions, one human)

| Function | Owner | Sammy's role |
|---|---|---|
| Product | Sammy + Dev agent | Approves scope at gates |
| Engineering / QA | Dev & QA agent | Approves production deploys |
| Live ops | Live-ops agent | Approves the weekly event calendar |
| Support | Support agent | Handles P0 only |
| Trust & safety | Moderation agent | Final say on bans |
| Growth | Growth agent | Approves outbound posts and creator deals |
| Comms | Comms agent | Approves broadcasts |
| Data | Data agent | Reads Monday digest |
| Economy | Economy watchdog | Approves economy changes |
| Finance & legal | Finance agent | Signs anything with money or law |
| Competitor watch | Competitor agent | Reads monthly note |

Full agent charters: `AGENTS.md`.

## 5. Sammy's 2 hours a week

1. Monday, 15 min: read the digest (players, retention, tickets, incidents, money).
2. 30 min: clear the approval queue (deploys, broadcasts, bans, economy changes, creator deals).
3. 30 min: play the latest build on the cheap Android. File 3 things that feel wrong.
4. 30 min: one growth action only Sammy can do (a creator call, a campus visit, shop owner).
5. 15 min: buffer.

## 6. Escalation

- **P0 — interrupts Sammy now (WhatsApp/push):** safety threat or child report, money/ledger exploit,
  site down > 30 min, data leak, legal notice, press.
- **P1 — weekly queue:** ban appeals, refunds (once money exists), creator deals, economy tweaks,
  broadcast approvals.
- **P2 — agents handle and log:** FAQs, bug reports, how-to questions, routine moderation.

Kill switches: every agent has an on/off flag in `ops/agents.json`; "maintenance mode" flag stops
new sign-ups and economy writes.

## 7. Growth loops

1. Ug Tag card → WhatsApp Status / TikTok (every card carries the join link).
2. Daily street event with a shareable result (Wordle-style).
3. Referral: invite → both get a cosmetic (never cash).
4. Real shop owners claim their in-game kiosk and bring their customers.
5. Weekly Kampala challenge + creator spotlight.
6. Campus ambassadors (Makerere, Kyambogo, MUBS, UCU) paid in status/cosmetics first.

## 8. Where $0 ends (first paid items, in order)

1. Domain (~$10–15/yr) — needed for trust and links. Only cost before launch.
2. URSB trademark fee — before the viral launch.
3. Player-facing AI chat replies (LLM tokens) — turn on when revenue ≥ cost; until then FAQ bot +
   WhatsApp Business app quick replies + agents that run inside Sammy's existing Claude plan.
4. Supabase/hosting upgrade — only when free limits are hit (free Supabase projects pause when idle).
5. Freelance artist — first revenue goes here.

## 9. Research list (Phase 0)

1. Uganda game/app revenue benchmarks, ad CPMs, spend per user.
2. Mobile money for in-app purchases: providers, fees, licensing.
3. TikTok, Meta, X, YouTube sign-in/embed rules, costs, app review.
4. URSB trademark process and clearance for "Ug Life".
5. Company structure, equity, option pool (separate from Maji Safi).
6. African game/consumer app funding comparables (Lagos Life reportedly $500k pre-seed ~ $10M).
7. Kampala creator/influencer pricing.
8. Uganda Data Protection and Privacy Act 2019 duties for profiles and social links.
9. Lagos Life teardown: onboarding, loops, monetisation, support handling at 2M players.

Unverified claims in earlier drafts (Lagos Life numbers, platform API rules) must be checked
against current sources before anyone relies on them.

## 10. Build status (2026-10-24)

Phase 1 preview built in `game/` (see `game/README.md`): one Wandegeya-style street, Ug Tag,
delivery → kiosk loop with a tested ledger, fictional pothole fix, daily street events,
day/night on Kampala time, share card, help/FAQ, 18+ gate, scam filters. Saves on the phone.
Operations system in `ops/`: kill switches, runbooks, approval and P0 queues.
Phase 1.5 (same day): Street Snaps (photo to street art on the phone, privacy blur,
community board, billboard, neighbourhood race), online accounts and save checks, real players
on the street, support tickets with replies, Control Room, deploy pipeline, health check.
Live on Netlify (2026-10-24). Cloudflare standby ready.
Not done yet: real-time multiplayer, social sign-in verification, Luganda/Swahili UI.

## 11. Open decisions for Sammy

See the "Your calls" section of the published plan.
