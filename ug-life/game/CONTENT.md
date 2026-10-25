# Adding things to Ug Life

Most new content is one entry in one file. No art files: everything is drawn in code, so a new
item shows up in the game as soon as its entry exists. After any change run `npm test` and
`npm run build`, then ship as usual (PR to `main`, then the Netlify deploy workflow).

The server checks every save against the money rules in `src/game/validate.ts`. Most of its
limits are read from these same content files, so stay inside the notes below and nothing else
needs changing.

## Quick map

| To add | Edit | One entry looks like |
|---|---|---|
| A food cart | `src/content/catalog.ts` → `VENDORS` | id, seller, price, boost, tile |
| Something to build in a kiosk yard | `src/content/catalog.ts` → `YARD_ITEMS` | id, name, price, income bonus, look |
| A Kampala landmark | `src/content/landmarks.ts` → `LANDMARKS` | id, name, facts, where on the hills |
| A street character | `src/content/residents.ts` → `NAMED` | name, role, bio, look, start tile |
| A daily street event | `src/game/daily.ts` → `STREET_EVENTS` | title, blurb, pay and kiosk bonus |
| A shop or building | `src/world/map.ts` → `BUILDINGS` | position, size, colours, sign, door |
| A help answer | `src/content/faq.ts` | question, answer (the support agent reads it too) |
| Boda prices | `src/content/catalog.ts` → `BODA` | rent, fare, pay per ride, rides a day |
| A cheap snack | `src/content/catalog.ts` → `SNACKS` | name, price, boost, icon, which carts sell it |
| A talk phrase | `src/content/talk.ts` → `PHRASES` | text, English meaning, resident replies |
| An emote | `src/content/talk.ts` → `EMOTES` | id, label, emoji |
| A resident's street lines | `src/content/talk.ts` → `RESIDENT_LINES` | resident id → lines they call out |
| A street shout (spoken) | `src/content/talk.ts` → `STREET_SHOUTS` | tile, text, who |
| A land area | `src/content/land.ts` → `LAND_AREAS` | name, blurb, first plot price, number of plots |
| A building level on land | `src/content/land.ts` → `LAND_LEVELS` | name, cost, rent a day |

## Food carts (`VENDORS`)

```ts
{
  id: "chips", seller: "Jjuuko", name: "Chips Corner", product: "Chips and chicken",
  blurb: "Hot chips in a paper bag. Good after a long ride.",
  price: 3_000, boostPct: 15, boostMinutes: 25,
  at: { x: 22, y: 12 },     // tile the cart stands on (pavement, not the road)
  stand: { x: 22, y: 11 },  // tile the player walks to
  cart: "rolex",            // which cart drawing to use: rolex, maize or fruit
},
```

Then add a cart prop in `src/world/map.ts` → `PROPS`: `{ kind: "cart", vendor: "chips", x: 22, y: 12, blocks: true }`.

The server's pay ceiling follows the biggest `boostPct` in this list, so it updates by itself.
Keep boosts modest (20% or less) so riding and deliveries stay balanced.

## Yard items (`YARD_ITEMS`)

```ts
{ id: "umbrella", name: "Big umbrella", price: 4_000, blurb: "Shade for customers.", incomeBonus: 300 },
```

Then give it a look: add `case "umbrella":` in `src/world/streetart.ts` → `drawYardItem`
(a few `poly` calls; copy the `chairs` case to start). Without a case it is bought but not drawn.
The server's kiosk ceiling follows the biggest `incomeBonus` automatically; keep bonuses small
(a few hundred UGX) so kiosks don't outearn work.

## Landmarks (`LANDMARKS`)

```ts
{
  id: "kasubi", name: "Kasubi Tombs", where: "Kasubi Hill",
  facts: "Two or three short sentences. Only facts that are widely known and safe to state.",
  place: { kind: "skyline", at: 420, hill: 0 },  // at: 0..1000 along the hills; hill 0 = far, 1 = near
  draw: "namirembe",                              // reuse a drawing, or add one in drawSkylineLandmark
},
```

Every landmark pays `LANDMARK_REWARD` (300) once; the server knows each id, so new ids need no
server change. Keep `at` at least ~80 away from other landmarks on the same hill.

## Snacks (`SNACKS`)

```ts
{ id: "rolexegg", name: "Extra egg", price: 300, boostPct: 3, boostMinutes: 10, icon: "🥚", soldAt: ["rolex"] },
```

`soldAt` lists vendor ids from `VENDORS`, or `"chapati"` for Mama Rose's shop. Keep boosts below
the biggest cart boost (20%) and prices low: snacks are the cheap, everyday thing to buy.

## Talk phrases (`PHRASES`)

```ts
{ id: "nkwagala", text: "Nkwagala!", meaning: "I like you!", replies: ["Eh, webale!"] },
```

The server accepts any phrase id in this list. Only add phrases that are friendly and can't be
used to scam (no numbers, no money talk). Residents nearby answer with one of `replies`.

## Land (`LAND_AREAS`, `LAND_LEVELS`)

```ts
{ id: "kasubi", name: "Kasubi", blurb: "Short and true.", basePrice: 5_000, plots: 14 },
```

Each plot sold in an area makes the next 12% dearer; the hot area (one a day, picked from the
date) costs ×1.5 and pays ×2 rent. The server sets every price and checks rent against
`LAND_LEVELS`, so changing a level's `rent` changes what saves are allowed: never lower one that
players already own (their saved rent would then look too high), only raise.

## Residents (`NAMED`)

Fictional characters only, never real people. `start` must be a pavement tile (row 4 or 11–12).
Socials must be made-up handles. Passers-by are generated by `passersBy()` in `catalog.ts`.

## Street events (`STREET_EVENTS`)

One is picked per day from the date. Keep `jobBonus` and `kioskBonus` at **1.3 or less**
(`MAX_EVENT_BONUS` in `validate.ts`): above that the server refuses honest saves.

## Buildings (`BUILDINGS`)

The street is 40 tiles wide (`MAP_W`). Buildings sit on rows 0–3 with the door on row 4.
Leave no overlap with another building. A new building becomes a delivery and boda
destination automatically (it joins `PLACES`).

## Checking your change

```
npm test           # rules + server checks (Postgres tests need no setup)
npm run build
npm run serve:local  # play it at http://localhost:8788
```
