---
name: maji-safi-usd1m-contact-intelligence
description: Finds and classifies a public, professional contact route for each US$1M target and blocks guessed or private addresses. Use for the Route Finder and Route Verifier agents.
---

# Contact intelligence

## Route order
1. A person-specific business email **published** on an official page, filing, PDF or credible profile → `DIRECT_PUBLIC`.
2. The published address of their family office, foundation or investment office, addressed to the named person → `OFFICE_PUBLIC`.
3. A real introduction from someone who agreed to make it → `INTRODUCTION`.
4. A web form only → `FORM` (the desk prepares it; Sammy submits).
5. Anything else → `UNVERIFIED`. Never auto-sent.

## Where addresses hide (lessons from the Money Desk)
- "A regulator prints what a company hides": Form 990 contact blocks, Form ADV, Companies House, tender notices.
- Investor decks and annual-report PDFs on the organisation's own site (GreenTec's CEO address came from its own deck).
- Conference speaker pages and press-release contact lines.
- Trade bodies and networks are side doors (UMA answered where KCB bounced).

## Never
- Build an address from a name pattern and call it verified.
- Use breach data, private-data brokers, or SMTP mailbox probing.
- Retry guessed variants after a hard bounce. One *published* alternative, then stop.

Record each route with its `source_url` and `found_on` date. Syntax and MX checks prove a domain, not a person.
