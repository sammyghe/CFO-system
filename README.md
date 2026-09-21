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
  03-diagnostics/
    maji-safi-drawbacks.md    ← 20 drawbacks, severity-ranked, every figure traceable
  04-tools/                   (empty) 13-week cash forecast, scenario model
```

## Start here

**`knowledge-base/03-diagnostics/maji-safi-drawbacks.md`** — the honest read on Maji Safi as
it stands, written the way CFO100 teaches a CFO to read a business. Everything else gets
built from it.

## What is real and what is pending

**Real, written from source:** the drawback register, the company context, the decisions log,
the curriculum map and the CFO role map. Every figure traces to a named tab of
`majisafiyearone.xlsx` in Drive, to a Renew email in Gmail, or to the CFO100 syllabus and
Session 1 assignment supplied on 21 Sep 2026.

**Pending, with placeholder READMEs saying so:** `01-cfo100/materials/`, `02-mentality/`,
`04-tools/`. Empty folders mean not built — never assume a file exists because a folder does.

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
