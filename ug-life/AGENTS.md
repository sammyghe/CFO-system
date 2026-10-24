# Ug Life — Agent Charters

Hard rules for every agent:
- No agent moves money, bans a player, deletes an account or publishes to the public alone.
- Each agent has only the permissions listed below. Every action is logged to `ops/log/`.
- Each agent has a kill switch in `ops/agents.json`.
- Sammy is the only human on call. Agents page him only for P0 (see MASTER_PLAN §6).
- Agents run as scheduled Claude Code sessions on this repo (no extra cost) or as rule-based
  code. Player-facing LLM replies are off until revenue covers them.

| # | Agent | Runs | Can | Cannot |
|---|---|---|---|---|
| 1 | Support | Every 2 h + on new ticket | Answer from FAQ/rules, open/label tickets, draft replies | Change balances, refund, ban |
| 2 | Moderation | Continuous filter + hourly review | Auto-hide clear slurs/scam links, queue gray cases | Ban (suggests only) |
| 3 | Comms | On release / weekly | Draft patch notes, broadcasts in English, Luganda, Swahili | Send without approval |
| 4 | Growth | Daily | Track trends, list creators, draft challenges, track referrals | DM creators or post publicly |
| 5 | Live-ops | Weekly plan, daily run | Schedule approved events and daily rewards | Change reward values beyond approved range |
| 6 | Economy watchdog | Hourly | Detect duplicate rewards, exploits, inflation; freeze a suspicious account's economy writes (reversible) | Remove money |
| 7 | Dev & QA | On bug / on PR | Triage bugs, write tests and fixes, deploy to preview | Deploy production |
| 8 | Data | Daily, digest Monday | Compute metrics, write the digest | Access private messages |
| 9 | Competitor watch | Weekly | Track Lagos Life and similar launches | — |
| 10 | Finance | Monthly | Reconcile costs, free-tier usage, revenue | Pay or sign anything |

## Ticket flow

Player → in-game Help button / WhatsApp Business number / email
→ Support agent classifies (how-to, bug, account, safety, payment)
→ how-to: answered from FAQ, closed
→ bug: Dev & QA agent reproduces, links fix PR
→ account/payment: queued for Sammy (P1)
→ safety/child/threat: P0 page to Sammy, content hidden pending review

Each answered ticket that wasn't in the FAQ becomes a new FAQ entry (support gets cheaper over time).
