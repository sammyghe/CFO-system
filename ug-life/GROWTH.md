# How Ug Life grows (and how Sammy steers it)

Everything below is live in the game today, not a plan, except where marked **Next**.

## 1. The loop a player lives in

```
 eat (⚡ energy) → work (deliveries, boda, shifts) → money → spend (land, kiosk, billboard, food)
        ↑                                                        │
        └──────── rent, kiosk sales, rewards, events ────────────┘
```

- **Energy** (⚡ in the wallet): every job uses some (delivery ⚡8, boda ride ⚡6, shift ⚡12–22).
  Food gives it back (mandazi ⚡8 for UGX 200 … rolex ⚡45 for UGX 2,000). It refills slowly on
  its own and fully each new day. Higher levels hold more. This is what makes cheap food matter.
- **Ways to earn** (all in **Work**, with steps): deliveries, boda rider, shop shifts (10 shops,
  better ones unlock by level), kiosk, landlord (rent), Street Snaps, goals, invites, events.
- **Ways to spend**: food, boda rides, kiosk and yard, land and buildings, billboards, top-ups.
- Every shilling earned is checked by the server, and nothing can be claimed twice.

## 2. How Sammy updates it (whenever you want)

| You want to… | Do this | Takes |
|---|---|---|
| Tell everyone something | Control Room → **Grow** → What's new | 1 min |
| Run an event (launch, meetup, promo) | Control Room → Grow → Events: place, time, reward | 2 min |
| Put a real brand on a billboard | Control Room → Grow → Brand billboards | 2 min |
| Build what players voted for | Control Room → Grow → Ideas: ask Claude to build it, then "Mark done" | a session |
| Pause something going wrong | Control Room → Today → switches (talk, uploads, sign-ups, top-ups, maintenance) | 10 s |
| Add food, shops, phrases, areas, landmarks | Ask Claude, or edit one entry (see `game/CONTENT.md`) | minutes |
| A bigger change | Ask Claude in a session: it builds, tests, opens a PR, merges and deploys | a session |

The Control Room is `https://ug-life.netlify.app/admin.html` (password: the `ADMIN_TOKEN`
setting on Netlify). The daily ops round and Monday review (scheduled tasks) already read it.

## 3. How players add to it

- **Ideas and votes** (More → Street news → Ideas): anyone posts an idea, everyone votes once,
  the most-voted get built. Rallies: players walk to the community board and hold a placard,
  so support is visible on the street. Three reports hide an idea; you can hide or mark done.
- **Street talk, voice hellos, emotes**: people meet each other.
- **Street Snaps**: real streets become art; the areas with most snaps decide where the game
  goes next.
- **Billboards**: players rent them for their kiosk or message; brands sponsor them.
- **Land**: players build up real neighbourhoods; the daily hot area moves the crowd.

## 4. Money

### Game money (works now)
Game shillings are priced like UGX so they feel real, but they can't be cashed out, sold or bet.
That keeps Ug Life a game, not gambling or a bank, under Ugandan law.

### Real money in (built, switched off until you do 3 things)
Players can top up game shillings with **MTN or Airtel mobile money** (packs UGX 1,000–20,000,
bonus on bigger packs, at most UGX 50,000 a day). Payment goes through Flutterwave's checkout;
the server credits a top-up only after Flutterwave confirms it.

To switch it on:
1. Register the business (URSB) and open a Flutterwave business account (flutterwave.com,
   Uganda, mobile money). They ask for the business documents and a bank account.
2. In Netlify → ug-life → Environment variables, add `FLW_SECRET_KEY` = the live secret key.
   Claude can add it for you through the Netlify connection once you have the key.
3. Control Room → Today → turn on **Mobile money top-ups**.

Never add cash-out or betting: that needs a gambling licence (National Lotteries and Gaming
Regulatory Board) and payment-service approval (Bank of Uganda).

### Real money from brands (works now, offline sales)
Sell billboard days to local businesses (rolex stands, salons, boda saccos, phone shops, radio
stations, events). Suggested starting price: UGX 50,000 a week for the rooftop, 20,000 for a
street billboard. Book it in the Control Room; they pay you directly (mobile money to the
business). The billboard can link to their page.

## 5. How it spreads

- **Invite links** pay both people when the friend does a real job.
- **Share links** to a place (`?at=pharmacy`) or an event (`?event=…`) open the game right there.
  Every building and event has a Share button.
- **WhatsApp preview** image and text are set.
- **Events** give people a reason to come at the same time: "Launch party at Studio 256, 8pm,
  everyone who comes gets UGX 1,500". Post the event link in WhatsApp groups and on TikTok.
- **Leaderboard** (richest, highest level, biggest landlords, best snappers, friendliest).
- **Billboards with your name on them** are screenshot-worthy.
- **Real-world events**: put a QR code to an event link on a poster at a campus or a boda stage.

## 6. How real it is right now

| Part | State |
|---|---|
| Game on any phone browser, saves on the phone and online | Live |
| Talk, voice hellos, bubbles, report and block | Live |
| Deliveries, boda, shifts, kiosk, land, rent, billboards, events | Live, server-checked |
| Ideas, votes, rallies, news | Live |
| Mobile money top-up | Built and tested with a stand-in provider; off until steps in §4 |
| Brand billboards | Live (you sell them offline, book them in the Control Room) |
| Sign in with phone number | **Next** (SMS costs money; recovery code works for now) |
| More streets (Kikoni, Kalerwe market…) reached by matatu | **Next**: the engine is ready for a second map; build the one the snaps race and votes pick |
| Real-time movement (others move live, not every few seconds) | **Next**, when there are enough players to need it |

## 7. Hosting and cost

Netlify (game, API, Postgres database, image storage) on the free plan, deployed by GitHub
Actions. A health check every 30 minutes opens a P0 issue (emails you) if the site, land,
leaderboard or talk stop answering. When daily players pass a few thousand, the Cloudflare
standby (same code) or Netlify's paid plan is the next step; see `MASTER_PLAN.md` §8.
