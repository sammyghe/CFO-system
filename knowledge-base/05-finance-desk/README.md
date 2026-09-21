# THE FINANCE DESK

The CFO function's intake, authority and answer system — for humans and for AI agents.

**Address:** `finance@maji-safi.com`
**Register:** `REQUEST REGISTER` tab in `models/MajiSafi_FINANCIAL_SOURCE_OF_TRUTH.xlsx`
**Authority:** `CANONICAL FIGURES` tab in the same workbook, mirrored here as
`canonical-figures.yaml` for agents to read
**Opened:** 21 September 2026

---

## Why it exists

Maji Safi runs several autonomous agents — the Capital Brief (06:00 EAT daily), the Water
Desk, the Day Desk — alongside Sammy, Ema, Mike and Amanuel. They all produce and quote
financial figures. Until today, nobody owned those figures.

Two events on 21 September made that concrete.

**One.** The Capital Brief raised its first request to the finance function — FY2025 and
FY2026 statements for a lender, December deadline — and there was nowhere to send it. No
`finance@`, no `cfo@`. It landed at `ops@` and `ema@` by default.

**Two, and worse.** The same brief reported a **4x spread on the headline ask**: the capital
file says USD 80,000 all-in per site, the operations file says USD 20,000. Both live, both
quotable, neither owned. On the same day, eight funders were emailed and Kiva replied within
the hour.

> A company that tells two funders two different numbers has not made an error. It has no
> finance function.

## What it does

1. **Takes requests** from any human or agent, on one address, into one register.
2. **Owns the numbers.** No financial figure leaves the building unless it is on the
   canonical figures list with status APPROVED.
3. **Answers in LEAD** — the same format for a person and for a machine.
4. **Keeps the record**, so the same question is never answered two different ways.

## The four request types

| Type | Meaning | SLA |
|---|---|---|
| **figure** | What is our X? | Same day — it is a lookup against canon |
| **approval** | May I send this? | Same day |
| **document** | Produce something | 3 working days, or a committed date on day one |
| **decision** | A founder call is needed | Next 08:30 Ema sync, or the Monday cash roll |

If a deadline will be missed, the rule is Renew's: *"I don't know yet. I will have that by
Thursday at noon."* Commit to a time and deliver. Never bluff.

## How to raise a request

**Humans:** email `finance@maji-safi.com`. Say what you need and when you need it.

**Agents:** see `AGENT-CONTRACT.md`. Read `canonical-figures.yaml` first — most questions are
already answered there and need no human at all.

## Files here

| File | What it is |
|---|---|
| `AGENT-CONTRACT.md` | The rules every agent must follow before stating a financial figure |
| `canonical-figures.yaml` | Machine-readable canon. Mirrors the workbook tab exactly. |
| `answer-format.md` | The LEAD template every answer uses |
| `requests/FD-*.md` | The answered requests, in full |

## Standing in the rhythm

- **Daily:** clear the `FINANCE-DESK` label. Figures and approvals are answered same day.
- **Monday:** the 13-week cash roll, then the open register.
- **08:30 Ema sync:** anything marked `decision`.
- **Monthly, by the 15th:** the one-page LEAD summary to the readers who need it.
