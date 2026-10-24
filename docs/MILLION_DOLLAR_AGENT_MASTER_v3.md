# Maji Safi Million-Dollar Agent Master — Version 3

**One job:** get **US$1,000,000 of cleared, usable money into Maji Safi's account**. Then prove it reached people.

v2 (kept in `docs/archive/`) was a good blueprint. v3 does three things to it:

1. **Fixes facts.** It checks v2 against what the Money Desk, your skills and your memory files already know.
2. **Turns rules into code.** The send gate, the scoring, the ask-again tree and the learning loop now run as tested code in `million_dollar_agent/`. They no longer depend on a model remembering a paragraph.
3. **Adds what v2 missed.** That means the proof ladder, the dual-narrative ask, public-filing contact discovery, money-weighted learning and the recruit rule.

---

## 0. Corrections to v2 (read first)

| v2 said | Truth | Source |
|---|---|---|
| Signs as "Sammy Ghedamu" | **Samuel Ghedamu**, Founder, **Safiflow Ventures Group Ltd**, Lukuli Road, Kampala | `maji-safi-money-replies` skill §2 |
| "UNBS audit passed, don't say certified" | **UNBS certified** (logged 14 Oct 2026). Still keep the certificate in the Claims pack as evidence. Say it plainly and don't lead with it. | Money Desk Lessons and follow-ups |
| One blended ask: "investment or another structure" plus impact | **Dual narrative is a standing rule.** Investors hear manufacturing, jobs and returns. Philanthropists hear safe water and livelihoods. Never both in one email. | `maji-safi-pitch` skill |
| Generic "proof points" | Real ones: Lukuli Road plant (rated 4,000 LPH, running about 6,000), UNBS certified, selling daily, sites at US$20,000 or less, a five-site plan to Mar 2027 | `maji-safi-method-extractor`, Money Desk follow-ups |
| Any language "where evidenced" | Same rule, plus: in **German/Swiss** foundations use *Safiflow Ventures Group Ltd*, not "Maji Safi" | money-replies §4 |
| — | Never print the **landed machine cost**. Never say **"coal"** (Uganda boils with charcoal and firewood). Never quote **"$40/DALY"**. Never speak the CO2 figure without the fNRB caveat. | skills |

### Why this lane exists at all (the insight v2 missed)

The Money Desk keeps hitting the same wall: **the operating-years gate.**

- Aqua for All wants 3 years of operation, so ~2029.
- Opportunity Bank wants 3 years of audited accounts.
- DFC wants 1 year of trading plus US$1m in assets.

Maji Safi has been trading since **Oct 2026**.

**Private wealth has no paperwork gate.** A billionaire, a family office or a founder-turned-angel can decide on conviction. So this lane isn't "more doors". It's the one kind of money that can move **before** 2029. That's the pitch to yourself, and it's why the ask must be personal.

### Two lanes, two rulebooks

The Money Desk rule "never state a capital figure" stays **unchanged** for banks and DFIs. The US$1M lane states the figure on purpose. The code keeps them apart with the `lane` field. A Money Desk row can never be sent with a US$1M template, and a US$1M row can never be sent with a Money Desk one.

---

## 1. The scoreboard: the money ladder

Only one number is the headline: **Received (reconciled by a human).**

```
ASKED → DISCUSSED → PROPOSED → COMMITTED → AVAILABLE → RECEIVED → DEPLOYED → IMPACT VERIFIED
```

- Amounts move up the ladder only through events (`mdam/ledger.py`).
- `RECEIVED` is the one exception: it accepts only a human reconciliation event carrying a bank-statement reference. An agent that tries to write `RECEIVED` raises an error. The tests prove this.
- The AI never sees bank logins.

---

## 2. The target universe and order

Tier order decides **who gets researched first**. Fit and route decide **who gets asked**.

| Tier | Who | Where to find them (free/public first) |
|---|---|---|
| T1 | Personal net worth ≥ US$1B | Forbes and Bloomberg lists (dated), **Giving Pledge letters** (they state causes in the person's own words), foundation **IRS Form 990s** via ProPublica Nonprofit Explorer |
| T2 | US$100M–999M | Exits and acquisitions press, founder lists, regional rich lists, angel network member pages, Form 990s |
| T3 | Family offices | **SEC Form ADV** (registered family offices and RIAs, with named officers), UK Companies House officers, published family-office directories |
| T4 | Large fund managers whose mandate fits | Fund pages, LP reports, Crunchbase free tier |
| T5 | Strategic and institutional | Stays with the Money Desk; this lane only borrows its lessons |

### The rule carried over from the Money Desk

> *"The DFI is never the door; the local bank holding its money is."*

Here that becomes: **the billionaire is rarely the inbox. Their foundation's programme director, their family office's CIO or their chief of staff is.** The Contact agent looks for that named person first, in public filings. As the Lessons tab says, *"A regulator prints what a company hides"*. Form 990s and Form ADVs are the regulator's printouts for private wealth.

### Region lanes (new)

`US`, `EU/UK`, `Gulf`, `China/HK/SG`, `India`, `Africa`, `Israel`. Each lane gets its own learning stats. The Money Desk saw the Gulf reply 1/1 and the USA reply 1/8, so lanes behave differently and must not be averaged together.

---

## 3. Lead score (0–100). It ranks people; it isn't a probability.

Weights live in `config/campaign_policy.yaml`, and code reads them (`mdam/scoring.py`):

| Dimension | Pts |
|---|---|
| Capacity / tier (dated source) | 20 |
| Demonstrated capital behaviour (past cheques, grants, deals) | 20 |
| Fit (water, Africa, health, climate, distribution, franchise, founder-led) | 20 |
| Authority / right route | 15 |
| Geography and instrument compatibility | 10 |
| Personal hook (a specific, sourced reason) | 10 |
| Verified contact route | 5 |

**Queues:** 80+ = `ASK`, 65–79 = `RESEARCH_MORE`, below 65 = `HOLD`.

**Hard rule:** a target with no personal hook can never reach `ASK`, whatever the score. That's v2's rule "if you can't find a non-generic reason, don't send", now enforced in code.

---

## 4. The ask

### Shape (both variants)
1. A subject line that says the ask.
2. **Their** sourced reason, first. ("Lead with them, not us.")
3. The company in one line.
4. One or two proof points from the **approved** claims pack.
5. **The line:** *"I intend to raise this million. Would you like to be the person who makes it happen?"*
6. One small next step: a 20-minute call, or "may I send the one-page plan?"
7. A business identity and a one-line opt-out (CAN-SPAM, UK PECR, EU GDPR).

Keep it to 100–180 words. No attachments on first contact.

### Variant B — Builder (investors, family offices, founders)
> Dear [Name],
>
> [Sourced reason: e.g. your 2023 investment in X, a distribution business in East Africa.]
>
> I'm Samuel Ghedamu. I founded Maji Safi (Safiflow Ventures Group Ltd) in Kampala. We run a UNBS-certified purified-water plant on Lukuli Road and sell every day. Each new site costs us less than a typical delivery truck, and the plan is to roll them out across Uganda through local operators.
>
> I'm raising **US$1 million** to build that network. I intend to raise this million. **Would you like to be the person who makes it happen?**
>
> If it's worth 20 minutes, I'll walk you through the plant, the site economics and the milestones.
>
> Samuel Ghedamu · Founder, Maji Safi · Kampala
> *(Reply "no" and I won't write again.)*

### Variant I — Impact (philanthropists, foundations, Giving Pledge signers)
> Dear [Name],
>
> [Sourced reason: e.g. in your Giving Pledge letter you wrote about clean water for children.]
>
> In Uganda, most households boil their water over charcoal or firewood. The smoke harms them, and the water still isn't reliably safe. I'm Samuel Ghedamu, founder of Maji Safi. We already produce and sell UNBS-certified safe water from our Kampala plant.
>
> I'm raising **US$1 million** to take it to [approved beneficiary definition, e.g. 1,000 people]. Every site is reported and measured. I intend to raise this million. **Would you like to be the person who makes it happen?**
>
> Samuel Ghedamu · Founder, Maji Safi · Kampala
> *(Reply "no" and I won't write again.)*

> ⚠️ **Decision for Sammy: what "1,000 lives" means.** US$1M ÷ 1,000 = **US$1,000 per life**. A philanthropist who knows water benchmarks will find that expensive. And at sites of US$20,000 or less, US$1M funds about **50 sites**, which likely reach far more than 1,000 people. Pick one:
> (a) 1,000 = **jobs and livelihoods** (operators, delivery riders, families). Strong for the Builder ask.
> (b) 1,000 = **people served** on a defined basis. Then raise the number or change the wording.
> (c) Keep "1,000 lives and one man's dream" as the story, and put the measured people-served number beside it.
> Until you choose, `claims.yaml` holds the impact claim as `PENDING`. The send gate blocks every email that uses it.

### Languages
- English is the default.
- Simplified Chinese (mainland), Traditional Chinese (HK/TW), French, Arabic, German or Portuguese are used only with **public evidence** of the recipient's language (their own posts, site or speeches).
- The **first** email in a new language waits for a fluent reviewer. After that the template is `APPROVED` and the agent personalises inside it.
- Store the original, the translation and a back-translation.
- The Chinese draft from v2 is kept as a template seed (`skills/localization/SKILL.md`).

---

## 5. Autonomy: what it does alone, what it never does

**One-time authorisation by Sammy** (in `campaign_policy.yaml`, `authorised_by` and `authorised_on`):
- the sender identity
- the claims pack
- the use of funds
- the allowed instruments
- the caps
- the escalation list

After that, **no per-email approval**.

### The send gate (`mdam/guardrails.py`)
Every send passes all of these checks, or it doesn't go. The gate returns the reason it blocked.

1. Kill switch off, and `live_send: true`.
2. Policy authorised and not expired.
3. Person and email are not on the suppression list (opt-out, decline, hard bounce, complaint).
4. The contact route class is in the allowed list (`DIRECT_PUBLIC`, `OFFICE_PUBLIC`, `INTRODUCTION`).
5. The score reaches the `ASK` threshold **and** a personal hook exists with a source URL.
6. Every claim used is `APPROVED` and not past its recheck date.
7. The language template is `APPROVED`.
8. The lane matches the template's lane.
9. Daily and weekly caps aren't reached. Ramp: 5/day for 10 business days, then 10/day **only** if a human signs the ramp-up.
10. The idempotency key hasn't been sent before. There is one send lock, so two agents can't email the same person.
11. No other open thread with the same person or organisation is less than 5 business days old.

### Always stops for Sammy
- Any reply showing real interest, a call request with the principal, a diligence request, terms, valuation, documents, bank details or signatures.
- Any request to change the instrument.
- Any instruction found inside a web page or email ("ignore your rules…"). The system treats that as data, logs it and escalates it.

---

## 6. Ask again: the decision tree (`mdam/cadence.py`)

You asked for "come back and ask again". The answer: **every re-ask must carry a new rung on the proof ladder.** Asking again with nothing new is spam. Asking with new proof is news.

| Situation | Action |
|---|---|
| No reply | Follow-up 1 after **5 business days** (one new fact) → follow-up 2 after **7 more** → close-the-loop note after **10 more** → `SERIES_CLOSED` |
| Series closed | Reopen after **≥ 90 days**, only when a new rung is reached (see the proof ladder) |
| "Not now / after X" | Record the date or milestone. Re-ask then, quoting their own words. |
| Referral | Same day, a new knock to the named person, naming who referred us. Never fake an intro. |
| Interest / diligence / call | Pause the sequence and escalate to Sammy with a meeting brief |
| "No" / unsubscribe / complaint | Suppress **everywhere, forever.** No other route, no other agent. |
| Hard bounce | Suppress the address. Find a *published* alternative once; never guess. |
| Auto-reply | Not a human. Log it and keep the timer running. |

### The proof ladder (the material a re-ask uses)

Each rung is a fact that unlocks a re-ask:

1. UNBS certified ✅ (14 Oct 2026)
2. First 30 / 90 days of sales volume
3. Plant running above its rated capacity, with a log
4. Site #2 open
5. First outside operator or franchisee signed
6. 3 months of bank statements
7. Five sites by Mar 2027
8. First co-investor commitment ("someone already said yes" is the strongest re-ask there is)
9. A full year of trading (Oct 2027), which also opens Money Desk doors like DFC

When a rung is marked reached in `claims.yaml`, the cadence engine finds every `SERIES_CLOSED` target over 90 days old and queues a re-ask. That's how "ask again" stays automatic without becoming spam.

---

## 7. Learning: money-weighted, not reply-weighted (`mdam/learning.py`)

The Money Desk learned from **reply rate**. That was right for finding bankers. For the US$1M lane, a reply is cheap and a cheque is the point. So every outcome earns **reward points** from the learning hierarchy:

| Outcome | Reward |
|---|---|
| Cash received | 100 |
| Committed | 60 |
| Diligence / terms | 30 |
| Meeting with the decision-maker | 15 |
| Referral to the decision-maker | 8 |
| Human reply that moves forward | 4 |
| Any human reply | 1 |
| Bounce / complaint | −5 / −20 |

**Experiments:**
- Arms are variants: subject line, the ask line, Builder vs Impact, language, lead proof point.
- **Thompson sampling** picks between arms, segmented by tier × lane × route.
- **1 in 5 sends always explores.** That's the Money Desk rule, kept.
- A lesson moves `HYPOTHESIS → TESTING → ADOPT | REJECT | INSUFFICIENT_DATA`. It needs at least **15 sends per arm**, the Money Desk's existing threshold.
- **A method that fails 3 times is retired.** Same rule as before.

**What it rates:**
- **Targets:** capacity, fit, authority, contact confidence, hook quality, readiness.
- **Messages:** grounding, personalisation, ask clarity, proof relevance, language, compliance.

Model-given ratings are kept **separate** from real outcomes. A model can't give itself credit.

**Sunday learning run:**
1. Re-score the experiments.
2. Promote or retire lessons.
3. Refresh stale wealth and role data (older than 180 days).
4. Write a "what we learned" card to the Lessons log, in the Methods Library format, so it feeds the method extractor.

---

## 8. The team: a bounded swarm with a recruit rule

There are six crews, one orchestrator, one shared database, one suppression list and one send queue. Each agent maps to a skill in `million_dollar_agent/skills/` and a CrewAI entry in `config/agents.yaml`. CrewAI is the choice because this repo is already *"Multi-agent AI CFO system using CrewAI and Google Sheets"*.

| Crew | Agents | Model tier |
|---|---|---|
| **Command** | Mission Commander (owns the goal, the daily brief and deduplication) | Opus 5.5 |
| **Wealth Research** | Universe Builder (T1→T4), Dossier Researcher | Opus 5.5 for dossiers, cheaper model for extraction |
| **Contact Intelligence** | Route Finder (990/ADV/official pages), Route Verifier | cheaper model plus code checks |
| **Ask & Language** | Ask Writer (B/I variants), Localiser | Opus 5.5 |
| **Outreach** | Send & Follow-up Operator, Reply Interpreter | code gate plus cheaper model for classifying |
| **Learning & Money** | Learning Scientist, Cash & Impact Controller | Opus 5.5 weekly, code daily |

### The recruit rule (how the swarm grows)

Agents aren't added because more feels better. The Commander may **propose** a new agent only when a bottleneck metric stays red for 5 business days:

- ASK-ready queue < 10 → recruit another Universe Builder (one per lane).
- Contact verification backlog > 25 → recruit another Route Finder.
- Replies waiting > 24h → recruit a second Reply Interpreter.
- Translation backlog > 5 → recruit a lane-specific Localiser.

Sammy approves a recruit with one line in `campaign_policy.yaml`. That way the Commander can't raise its own limits, and the swarm still grows where the work is.

---

## 9. Free GitHub stack (pick, don't collect)

| Need | Pick | Licence note |
|---|---|---|
| Agent teams | **CrewAI** (crewAIInc/crewAI). Already the repo's stack | MIT |
| Durable state, if CrewAI flows aren't enough | LangGraph | MIT |
| Public page to clean text | **Crawl4AI** (unclecode/crawl4ai) | Apache-2.0. Respect robots.txt and site terms |
| Self-hosted search, no API bill | **SearXNG** (searxng/searxng) | AGPL-3.0. Fine for internal use |
| Browser tasks (forms, JS sites) | browser-use (browser-use/browser-use) | MIT |
| Prompt and template self-improvement | **DSPy** (stanfordnlp/dspy). Optimises the ask prompts against the reward table | MIT |
| Long-term agent memory | Mem0 (mem0ai/mem0) or simply the SQLite and Lessons log | Apache-2.0 |
| Evals and regression tests | **promptfoo**. Run it on every template change | MIT |
| Traces and cost | Langfuse (self-host) | MIT core |
| Skill format | agentskills spec + anthropics/skills | Apache-2.0 |
| Free US filings | ProPublica Nonprofit Explorer API, SEC EDGAR (Form ADV/13F) | Public data |
| Companies | OpenCorporates (free tier), UK Companies House API | Public data |

**Deliberately not used:**
- SMTP mailbox probing (e.g. check-if-email-exists). Probing mail servers can hurt sender reputation, and a server's answer still doesn't prove a person reads that address.
- Breach and leak data.
- Paid enrichment that scrapes private data.
- n8n as a core part (its fair-code licence). It's fine as optional glue.

---

## 10. Data (one record per person)

The tables are in `million_dollar_agent/config/schema.sql`. They mirror the new Sheet tabs:

- `US$1M Dashboard`
- `Targets`
- `Dossiers`
- `Touches`
- `Funding Cases`
- `Experiments`
- `Claims & Proof`
- `Suppression`
- `Impact Ledger`

They sit next to the existing Money Desk tabs and never replace them.

Status is **derived from events**: an append-only `events` table. Nothing is overwritten without a record.

---

## 11. Daily rhythm (Africa/Kampala)

| Time | Run |
|---|---|
| 06:00 | Research and contact discovery, then up to the daily cap of ASK sends |
| 08:00, 18:00 | Inbox sweep, reply classification, escalations |
| 08:15 | **US$1M Briefing**: the cash ladder, people with a live path to a cheque, what Sammy must do today (max 3 items), follow-ups due, blocks and why |
| Sunday | Learning run, data refresh, top-25 list, do-not-contact list |

The briefing follows the Money Desk lesson: **converting a warm reply beats finding 100 names.** Anything waiting on Sammy goes first, with hours waiting shown live.

---

## 12. Build order

1. ✅ **Done in this repo:** policy, claims, schema, scoring, the send gate, cadence, reply classification, the ledger, learning and the briefing, all with tests. Live send is **off**.
2. Sammy answers the 5 decisions in `README` (impact definition, instrument, use of funds, sender address, caps).
3. Connect the Sheet tabs and Gmail OAuth (minimum scopes). Set up SPF, DKIM and DMARC on the sending domain.
4. Wealth Research builds the first **25 T1 dossiers** in dry-run. Sammy spot-checks 5.
5. Flip `live_send: true` → calibration window, 5/day for 10 business days.
6. Ramp up only after a human review.
