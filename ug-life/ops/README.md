# Ug Life operations

This folder is how Ug Life runs while Sammy spends about 2 hours a week on it.
Agents read and write here; Sammy reads `queue/` and `digests/`.

```
ops/
  agents.json          kill switches, schedules, limits (Sammy only)
  runbooks/            what each agent does, step by step
  queue/approvals.md   things waiting for Sammy (P1). Agents append, Sammy decides.
  queue/p0.md          emergencies. Anything written here also pages Sammy.
  digests/             Monday digests, one file per week
  log/                 one line per agent action: date, agent, action, link
```

## Priority levels

| Level | Examples | Who acts | How fast |
|---|---|---|---|
| P0 | Safety threat or anything involving a child, money or ledger exploit, site down more than 30 min, data leak, legal notice, press | Sammy | Now. Agent writes `queue/p0.md` and alerts the private WhatsApp alert group |
| P1 | Ban appeals, refunds once money exists, creator deals, economy changes, broadcasts, production deploys | Sammy | Monday review |
| P2 | FAQs, bug reports, how-to questions, routine moderation | Agents | Within 24 hours, logged |

## Sammy's Monday (about 2 hours)

1. Read `digests/<this week>.md` (15 min).
2. Clear `queue/approvals.md`: write APPROVE or REJECT and one reason under each item (30 min).
3. Play the latest preview on the test Android and log 3 things that feel wrong as issues (30 min).
4. Do one growth move only you can make (30 min).

## The live system

See `CONTROL_ROOM.md`: the Control Room page for Sammy, and the API the agents use.
A health check runs every 30 minutes and opens a GitHub issue labelled P0 if the site is down.

## Running the agents

Each agent is a scheduled Claude Code task on this repository, using the prompt
in `runbooks/<agent>.md` under "Scheduled prompt". They are not switched on yet:
ask Claude to create the scheduled tasks when you're ready, starting with
support, moderation and data at soft launch.
