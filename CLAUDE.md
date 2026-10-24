# CFO-system: Maji Safi's AI CFO

- At the start of each session, confirm whether the work is about Maji Safi.
- Read `docs/maji-safi-knowledge.md` for context on the company and on how
  Sammy works. Add new learnings to it before the session ends.
- Design rules are in `docs/agent-architecture.md`: one agent loop with skills
  and thin tools, approval gates inside tools, evals before changes. Propose a
  subagent only when one of that doc's three conditions is measured.
- When Sammy shares new Anthropic guidance, add it to
  `docs/anthropic-updates.md` (source, key points, what we changed) and update
  the architecture doc if it changes a rule.
