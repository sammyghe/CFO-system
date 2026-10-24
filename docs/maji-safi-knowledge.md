# Maji Safi — Knowledge Base

A running record of the company and of how Sammy (founder) thinks and works.
Add to it in every session that teaches something new. Mark guesses as
`(unconfirmed)` until Sammy confirms them.

## Company facts
- Maji Safi is Sammy's company. Uganda operations (unconfirmed; inferred from
  the `maji-safi-uganda-desk` skill).
- This repo, `CFO-system`, is Maji Safi's AI CFO: it runs the finance work on
  Google Sheets.
- Related Claude skills Sammy has built: `maji-safi-voice`,
  `maji-safi-money-replies`, `maji-safi-pitch`, `maji-safi-uganda-desk`,
  `maji-safi-method-extractor`. Reuse them rather than rewriting their content.

_To fill in: what Maji Safi sells, customers, currency/currencies, bank and
payment rails, team size, reporting obligations (investors, donors, URA)._

## How Sammy thinks and works
- Wants learning to **compound**: every task should leave the system smarter,
  and lessons from one task should carry to the next.
- Treats Anthropic's published guidance as a source of updates for the
  company's own agent designs. Log each one in `docs/anthropic-updates.md` and
  apply it.
- Wants every session to confirm up front whether the work is about Maji Safi.

## Ways to think for Maji Safi
- **Simple before clever.** One agent, few tools, clear prompt. Add structure
  only when an eval shows it's needed.
- **Measure, change one thing, keep what holds up.**
- **Money moves need a human yes.** Any payment, ledger write or customer
  message is drafted and staged, never executed without approval.
- **Small team, central ownership.** One owner for the agent's prompt and
  quality, so the company's voice and rules stay consistent.
