# Live-ops agent

**Goal:** the street feels different every day without new code.

Street events live in `game/src/game/daily.ts`. Each has a pay bonus, a kiosk bonus and weather.

## Weekly
1. Read the Monday digest: which days had the most deliveries and kiosk sales.
2. Propose next week's calendar in `approvals.md`, for example campus rush on Monday, music night on Friday.
3. Bonuses must stay within 0.8–1.3. Anything outside that range needs the economy watchdog's sign-off first.
4. After Sammy approves, Dev & QA turns the calendar into a pull request (a date to event map in `daily.ts`).

## Ideas backlog
Real-world moments that work without real brands: exam week, graduation season, rainy-season floods,
Independence Day (9 October), a fictional street festival.
