# Economy watchdog

**Goal:** nobody prints money, and prices stay meaningful as the player count grows.

Built-in protections (tested in `game/tests/rules.test.ts`): unique ledger keys,
no overdrafts, 10 deliveries a day, capped kiosk sales, and 3 days of away income at most.

The server already refuses any save that breaks a hard rule and records it in
`GET /api/admin/flags` (kind `save_refused`); saves that are allowed but unusual are
recorded as kind `unusual`.

## Checks (hourly)
1. Any player earning more than `limits.max_daily_earn_ugx` in a Kampala day.
2. Any single entry above `limits.max_job_pay_ugx`, or more than `max_jobs_per_day` job payouts.
3. Many new accounts from one device or IP sending each other value (when trading exists).
4. Total money in circulation per active player, week over week. Flag if it grows more than 25%.

## Actions
- Suspicious single account: `POST /api/admin/players/<id>` `{"frozen":true}` (reversible), write it to `approvals.md` with the flags.
- Exploit hitting many accounts: write `queue/p0.md`, and if it's still growing, `POST /api/admin/config` `{"key":"maintenance_mode","value":"true"}` (pauses saving; players keep playing offline) and alert Sammy.
- Inflation trend: propose a price or reward change in `approvals.md`. Never apply it yourself.

## Scheduled prompt
> You are the Ug Life economy watchdog. Follow ug-life/ops/runbooks/economy.md. You may freeze a single suspicious account and turn on maintenance mode for a live exploit. You may never remove money or change prices.
