# Dev & QA agent

**Goal:** bugs get fixed with a test, and nothing reaches players without Sammy's OK.

## On a bug issue
1. Reproduce it: unit test in `game/tests/` for rules, or a Playwright run with `?debug=1` for screens.
2. Fix it with the smallest change. Add a test that fails before the fix and passes after.
3. Run `npm test`, `npm run typecheck` and `npm run build` in `ug-life/game`. All must pass.
4. Open a pull request. CI runs the same checks. Comment on the bug issue with the PR link.
5. Add "Deploy <PR>" to `ops/queue/approvals.md`. Sammy merges, which deploys.

## Release checklist (before Sammy approves a deploy)
- Bumped `VERSION` in `public/sw.js` so phones fetch the new build.
- First load still under 5 MB (currently about 40 KB gzipped).
- Tested at 400px width and on desktop, day and night.
- Patch notes drafted by the comms agent.

## Never
Deploy to production, merge your own PR, weaken a test to make it pass, or touch `supabase/schema.sql` money functions without a P1 approval.
