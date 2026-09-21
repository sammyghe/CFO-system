# CFO-system

Two things live here:

1. **`knowledge-base/`** — the CFO knowledge base for **Maji Safi** (Safiflow Ventures Group
   Ltd, Kampala) and the Renew Capital **CFO100** programme. This is the central file system:
   one place, version-controlled, so nothing scatters across Drive.
2. Multi-agent AI CFO system using CrewAI and Google Sheets *(original repo purpose —
   unchanged, not yet built here)*.

## The knowledge base

```
knowledge-base/
  00-context/
    maji-safi.md              the company, the accounting rules that govern the model,
                              the Year-1 headline numbers, how Sammy works
    decisions-log.md          dated founder decisions — and what is explicitly NOT decided
  01-cfo100/
    curriculum-map.md         all 10 sessions from the official syllabus: objectives,
                              homework, grading weights
    materials/                (empty) where platform exports land
  02-mentality/
    cfo-role.md               Renew's six-domain CFO definition, mapped to Maji Safi
    renew-cfo-embodiment.md   how to BE the Renew CFO: mantras, the morning routine,
                              LEAD, four rooms, bad news, the phrases that build trust
    operating-rhythm.md       daily/weekly/monthly/quarterly/annual + the Monday rule
  05-finance-desk/            ← THE FINANCE DESK: intake, authority, answers
    README.md                 what it is, the four request types, the SLA
    AGENT-CONTRACT.md         the rules every AI agent follows before stating a figure
    canonical-figures.yaml    machine-readable canon — agents read this first
    answer-format.md          the LEAD answer template
    requests/FD-*.md          the answered requests
  03-diagnostics/
    maji-safi-drawbacks.md    ← 24 drawbacks, severity-ranked, every figure traceable
    cfo100-course-pitfalls.md where the COURSE itself breaks for a pre-revenue,
                              founder-run, single-site business in Kampala
models/
  MajiSafi_OneSite_Model.xlsx  the live model — 10 tabs, all formulas, scenario switch
  MajiSafi_OneSite_BLANK.xlsx  the same workbook, empty, every line item ready to fill
  build_model.py               regenerates both; edit here, not in the workbook
```

## Start here

**`knowledge-base/03-diagnostics/maji-safi-drawbacks.md`** — the honest read on Maji Safi as
it stands, written the way CFO100 teaches a CFO to read a business.

Then **`03-diagnostics/cfo100-course-pitfalls.md`** — where the course itself does not fit
this business, and what to do instead.

Then **`02-mentality/renew-cfo-embodiment.md`** — Renew's own definition of how a CFO
thinks, talks and starts the day.

## THE RULE THAT GOVERNS EVERY NUMBER

**If a figure is not on the CANONICAL FIGURES tab with status APPROVED, it does not leave the
building.** No agent, no person, no document. Requests go to `finance@maji-safi.com` and land
in the REQUEST REGISTER. See `knowledge-base/05-finance-desk/`.

## THE STANDING RULE

**Every Monday morning: roll the 13-week cash forecast forward and read the ALARM row.**
Tab `13-WEEK CASH` in `models/MajiSafi_OneSite_Model.xlsx`. Nothing else in this system
matters if that one does not happen.

## What is real and what is pending

**Real, written from source:** the drawback register, the company context, the decisions log,
the curriculum map and the CFO role map. Every figure traces to a named tab of
`majisafiyearone.xlsx` in Drive, to a Renew email in Gmail, or to the CFO100 syllabus and
Session 1 assignment supplied on 21 Sep 2026.

**Pending, with placeholder READMEs saying so:** `01-cfo100/materials/` and `04-tools/`.
Empty folders mean not built — never assume a file exists because a folder does.

**The model is verified, not assumed.** Every line reconciles to the published Year-1 figures
within 0.003%, and the balance sheet checks to zero in M1 and M12. Verified by evaluating
the workbook's formulas, not by eye.

**Not accessible from here:** the Renew CFO100 training platform
(`training.renewcapital.com`, password-protected). Session decks, recordings, the cash
checklists and forecast templates, and the final exam live there and cannot be downloaded by
this system. `01-cfo100/curriculum-map.md` lists exactly what is still missing and how to get
it across.

**Renew material marked proprietary** is summarised into this knowledge base for study; raw
Renew files are not committed here.

## Working rules

- A number without a source tab does not go in.
- An open question is flagged, not filled with an estimate.
- A decision needs a date and a name, or it is a proposal.
- The Year-1 model in Drive is read-only here. Drawbacks are recorded, not patched.
