# Maji Safi CFO System — Agent Architecture

Status: adopted 2026-10-24. Source: Anthropic, "Building agents: When to fold
subagents into your main agent loop" (logged in `docs/anthropic-updates.md`).

## The decision

Build the CFO system as **one agent loop with skills and a few thin tools**,
not as a crew of specialist agents (bookkeeper agent, forecaster agent,
reporter agent, router on top).

Why, for us specifically:

- **Finance answers need connected context.** A cash question touches sales,
  bills, payroll and the bank at once. One agent that has seen every lookup
  connects them; specialist agents hand back lossy summaries ("telephone game").
- **We are a small team.** A multi-agent design copies the org chart (Conway's
  law). We don't have an org chart worth copying, and every extra agent is
  another prompt, owner and eval set to maintain.
- **Cheaper and faster.** Fewer nested model calls. Reported results: ~2x
  faster runtime for a single loop vs. a multi-agent harness.
- **Easier to upgrade.** Each new Claude model can take on more of the work.
  A simple loop moves to the next model cleanly; rigid pipelines block that.

## Target shape

```
            ┌──────────────────────────────────────────────┐
 user ────► │  ONE agent · one context window · one prompt │
            │  writes its plan on turn 1, revises it        │
            └───────┬───────────────────────┬──────────────┘
                    │ parallel tool calls    │ loads on demand
           ┌────────▼────────┐     ┌────────▼──────────┐
           │ 4–6 thin tools  │     │ skills (how we    │
           │ (Google Sheets, │     │ do the work)      │
           │ bank, payments) │     │ + knowledge base  │
           └─────────────────┘     └───────────────────┘
 Harness enforces: turn budget, cost budget, write gates (approval before any
 write/payment/send).
```

### 1. The loop
- One model, one context window, open-ended tool loop.
- Each turn the model emits a batch of tool calls; the harness runs them in
  parallel and returns **raw results** to the same model.
- Stops when the model answers, asks the user something, or hits a budget.
- Optional verifier check after the answer (e.g. "do the numbers tie out?").

### 2. Tools — for actions, live data, fixed-shape results
- Group by **user intent**, not one tool per API endpoint. Stay well under
  30 tool definitions; use tool search / deferred loading if we grow.
- Hard rules live **inside tools**, not in the prompt:
  - Approval gates on every write (ledger entry, payment, email to a customer).
  - Preconditions: if a step needs another's output, the tool checks and
    returns a plain instruction the model can act on.
  - Permissions: the tool checks what the caller may see/do and returns a
    readable refusal. One agent can then serve users with different access.
- Code still does the mechanical parts (payload building, parsing, currency
  formatting, entity lookup) inside the tools.

Starting tool set (proposal, to be confirmed):

| Tool | Intent | Writes? |
|---|---|---|
| `read_books` | query ledger / transactions sheet by date, account, party | no |
| `cash_position` | current balances + upcoming in/out | no |
| `record_entry` | stage a ledger entry, commit only after approval | gated |
| `receivables` | who owes us, aging, draft reminders | gated for send |
| `payables` | what we owe, due dates, stage payment run | gated for pay |

### 3. Skills — for *how we do the work*
Steps, rules and judgment calls that a specialist agent's prompt would have
held. The agent sees only a short description and loads the full skill when
needed. Candidates: month-end close, cash forecast (30/60/90), invoice chase,
investor/donor reporting, Uganda-specific compliance (ties to the
`maji-safi-uganda-desk` skill). Each skill ships with its own small eval set.

### 4. Knowledge base — for reference used only sometimes
Policies, chart of accounts, metric definitions, price lists: behind a lookup
tool or as reference files inside a skill. Don't have code paste them into the
prompt. Company context lives in `docs/maji-safi-knowledge.md`.

## When a subagent is still allowed

Only when at least one of these is measured, not assumed:
1. Context bloat causes measurable quality loss in the single loop.
2. Parallel work needs fresh, throwaway context windows (e.g. reconciling 12
   months of bank statements at once, independent research paths).
3. The single agent picks the wrong tools or the prompt has conflicting rules
   that can't be fixed by cleanup.

If allowed: call it **as a tool** (the main agent keeps the conversation),
split by context rather than by problem type, have it return a compact result
in a shared schema, and verify its conclusion against real data. A full
handoff only if it must talk to the user directly.

## Rules of ownership
- **One owner of the system prompt and end-to-end quality** (Sammy for now).
  No one adds a sentence to the prompt without review. No "Frankenprompt".
- Every new tool, skill and eval is reviewed before it ships.
- Re-audit the prompt on each model upgrade: delete rules that were written to
  work around older models' weaknesses.

## How we change things
Measure, change one thing at a time, keep what holds up.
1. Write evals first (`evals/README.md`). 10 golden tasks is enough to start.
2. Make one change.
3. Run each eval task **more than once**. Look at **which tasks flipped**, not
   just the total score.
4. Keep the change only if it matches or beats the old version.

Helpful Claude API skills: `/claude-api build-eval`, `prompt-audit`,
`hillclimb`, `cost-optimize`. Migration kit:
https://github.com/anthropics/single-agent-loop-kit
