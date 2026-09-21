# AGENT CONTRACT — read this before stating any financial figure

**Applies to:** Maji Safi Capital Brief · Maji Safi Water Desk · Day Desk · any future agent
that writes, emails, drafts or briefs on behalf of Safiflow Ventures Group Ltd.

**Issued by:** the Finance Desk · 21 September 2026
**Authority:** granted by Sammy Ghedamu, founder, 21 September 2026

---

## The rule

> **If a figure is not in `canonical-figures.yaml` with `status: APPROVED`, you may not put
> it in anything that leaves the building.**

"Leaves the building" means: any email to a person outside Safiflow, any document, deck,
application, leave-behind, form or public post. Internal briefs to Sammy are exempt — but
must mark the figure with its real status.

This is not advisory. It was made hard authority on 21 September 2026, after a 4x spread on
the headline ask sat live in two files during a week when eight funders were emailed.

---

## What to do, in order

**1. Look it up.** Read `canonical-figures.yaml`. Most questions end here.

**2. Check the status.**

| Status | What you may do |
|---|---|
| `APPROVED` | Use it. Quote the value and the as-of date. |
| `DISPUTED` | **Do not use it anywhere, internal or external.** Two sources disagree and the Finance Desk has not ruled. Say "not yet established" and raise a request. |
| `UNVERIFIED` | Do not use externally. Internally, mark it `[UNVERIFIED]` exactly as the capital brief already does for unknown costs. |
| `EMBARGOED` | Do not use it, and do not use anything derived from it. There is a specific reason recorded in the `reason` field. |
| absent | Treat as `UNVERIFIED`. Raise a request. |

**3. If you cannot proceed, raise a request — do not guess.**

Email `finance@maji-safi.com`:

```
FINANCE DESK REQUEST
From:      <agent name>
Type:      figure | approval | document | decision
Needed by: <date, or "no deadline">
Request:   <one sentence>
Context:   <why, and what is blocked without it>
```

**4. Say so in your brief.** If a figure was withheld, name it. A brief that quietly omits a
blocked number teaches Sammy nothing. A brief that says *"per-site cost is DISPUTED and
embargoed from outbound until the Finance Desk rules"* teaches him exactly where the gap is.

---

## Worked example — what should have happened

On 21 September the Capital Brief reported:

> *"the capital file says USD 80,000 all-in, the operations file says … about USD 20,000 …
> A 4x spread on the headline ask. … It stays out of every document until you pick."*

The instinct was right. Under this contract it becomes automatic:

- `cost_per_site_usd` → `status: DISPUTED` → not usable, internally or externally
- The brief still reports the conflict, because reporting a conflict is not quoting a figure
- A request is raised, and it becomes **FD-002**
- No funder hears a per-site number until the Finance Desk rules

The same logic embargoes every impact claim built on UNBS certification until the certificate
is verified as filed.

---

## What the Finance Desk owes you in return

- Canon kept current, with an `as_of` date on every figure
- Same-day answers on figures and approvals
- A committed date on anything longer, and delivery on it
- A reason recorded against every `DISPUTED` or `EMBARGOED` entry, so you know *why*, not
  just that you are blocked

## Where canon lives

`knowledge-base/05-finance-desk/canonical-figures.yaml` in the CFO-system repo, mirroring the
`CANONICAL FIGURES` tab of `models/MajiSafi_FINANCIAL_SOURCE_OF_TRUTH.xlsx`. The workbook tab
is authoritative; the YAML is the machine-readable copy. If they ever disagree, the workbook
wins and the YAML is a bug.

## One thing the Finance Desk will not do

It will not invent a number to unblock you. If the honest answer is "we do not know yet",
that is the answer, and it goes in the brief in those words. The capital desk already models
this well: *"APPLY — nothing. There is no open window we are eligible for this week, and I
would rather tell you that than invent one."*
