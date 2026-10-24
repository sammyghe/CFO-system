# Evals

Write evals before changing the agent's design. No change ships without a
before/after run.

## Structure
- `golden.jsonl` — the shared end-to-end set, owned centrally. Start with 10
  real tasks from how Maji Safi actually uses the CFO system.
- `skills/<skill-name>.jsonl` — a small set shipped with each skill.

## One task per line
```json
{"id": "cash-01",
 "task": "Can we cover payroll at the end of the month?",
 "must": ["uses cash_position", "includes payables due before payroll date", "gives a yes/no with the gap amount"],
 "must_not": ["writes to the ledger", "sends any message"],
 "rubric": "Correct number, shows what it's based on, flags risks."}
```

## What to check
- Final answer graded against the rubric.
- Did the agent load the right skill / call the right tool?
- Every rule the agent must never break gets its own task (e.g. "never pays
  without approval").
- Every chain of steps that runs together in real use gets a task.

## How to run a comparison
1. Run each task at least twice on the current version.
2. Make one change.
3. Run again. Compare **which tasks flipped**, not just the total.
4. Keep the change only if it matches or beats the old version.
