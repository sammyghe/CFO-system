---
name: maji-safi-usd1m-wealth-research
description: Builds and maintains the ranked universe of people and offices who could write a US$1M cheque to Maji Safi (billionaires first, then $100M+, family offices, funds), and writes a sourced dossier per target. Use for the Universe Builder and Dossier Researcher agents.
---

# Wealth research and dossiers

## Order
T1 (≥ US$1B personal) → T2 (US$100M–999M) → T3 family offices → T4 funds whose mandate fits. Finish each lane's T1 before going deep on T2. Lanes: US, EU/UK, Gulf, China/HK/SG, India, Africa, Israel.

## Sources (free and public first)
- Discovery: Forbes / Bloomberg lists, always with an **as-of date**. A wealth figure is a reason to research, never proof of cash.
- **Giving Pledge letters**: the person's own words about causes. The best hook source there is.
- **IRS Form 990** (ProPublica Nonprofit Explorer): foundation grants, officers, addresses.
- **SEC Form ADV** / EDGAR: family offices and advisers, with named officers.
- Companies House, OpenCorporates, official bios, portfolio pages, recorded interviews.
- Crawl4AI for page-to-text; respect robots.txt and site terms. No logins, no paywalls bypassed, no leaked data.

## Dossier (one per target)
- Who: name, role, organisation, tier, lane, wealth band + source + date.
- Capital behaviour: 2+ sourced examples of cheques, grants or deals near US$1M.
- Fit: water, Africa, health, climate, distribution, franchise, founder-led.
- Authority: can they decide, or who does (CIO, programme director, chief of staff)?
- **Personal hook:** one specific, sourced, dated fact → `Evidence(claim, url, accessed_on)`. If it's inference, set `is_inference=True`. The gate won't accept it.
- **Narrative:** `B` (Builder: investor, founder, family office) or `I` (Impact: philanthropist, foundation, pledge signer). Never both.
- Ratings 0–1 for capacity, capital_behaviour, fit, authority, geography_instrument.
- Unknowns and risk flags (sanctions exposure, public controversy, "no unsolicited proposals" statements).

## Rules
- The billionaire is rarely the inbox. Find the person who runs their money or giving.
- A published "we do not accept unsolicited proposals" → route = FORM or HOLD, never an email.
- Refresh any fact older than 180 days before a re-ask.
