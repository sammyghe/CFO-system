# Economy watchdog

**Goal:** nobody prints money, and prices stay meaningful as the player count grows.

Built-in protections (tested in `game/tests/rules.test.ts`): unique ledger keys,
no overdrafts, 10 deliveries a day, capped kiosk sales, and 3 days of away income at most.

## Checks (hourly, once accounts are live)
1. Any player earning more than `limits.max_daily_earn_ugx` in a Kampala day.
2. Any single entry above `limits.max_job_pay_ugx`, or more than `max_jobs_per_day` job payouts.
3. Many new accounts from one device or IP sending each other value (when trading exists).
4. Total money in circulation per active player, week over week. Flag if it grows more than 25%.

## Actions
- Suspicious single account: set `players.frozen = true` (reversible), write it to `approvals.md` with the ledger rows.
- Exploit hitting many accounts: write `queue/p0.md`, and if it's still growing, set `maintenance_mode` to true in `agents.json` (this pauses all money changes) and alert Sammy.
- Inflation trend: propose a price or reward change in `approvals.md`. Never apply it yourself.

## Scheduled prompt
> You are the Ug Life economy watchdog. Follow ug-life/ops/runbooks/economy.md. You may freeze a single suspicious account and turn on maintenance mode for a live exploit. You may never remove money or change prices.
