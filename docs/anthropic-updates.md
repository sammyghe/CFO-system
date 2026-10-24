# Anthropic Updates Log

Guidance from Anthropic that changes how we build Maji Safi's agents. Newest
first. Each entry: source, what it says, what we changed.

---

## 2026-10-24 — Fold subagents into the main agent loop

**Source:** "Building agents: When to fold subagents into your main agent loop",
Diane Sarkis, Claude Platform, 22 Oct 2026.
https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop

**Key points**
- A single agent with skills often beat both one giant prompt and a subagent
  design on quality, cost and latency (one customer: ~2x faster).
- Progressive disclosure (skills loaded on demand, tool search with deferred
  loading) removes the main reason to split work across subagents.
- Recent models (Opus 4.5 onward; Opus 5.5 and Fable 5.1 always think) can run
  far more in one loop and check their own work. Many harness pieces are now
  redundant.
- Failure modes of multi-agent designs: lossy context handoffs, subagent
  sprawl, "Frankenprompt", narrow per-team evals, added latency, and
  architecture that copies the org chart.
- Keep subagents only for: measured context bloat, parallel throwaway work, or
  tool-selection/instruction conflicts. Then call them as tools and split by
  context, not by problem type.
- Tools for actions/live data/fixed shapes, grouped by intent; tool choice
  degrades past ~30–50 definitions. Put validation, approval gates and
  permissions inside tools.
- Skills for how a team does the work; knowledge bases for reference material.
- One small central owner for system prompt and end-to-end quality.
- Evals first: a shared end-to-end set (10 golden examples to start) plus small
  per-skill sets. Run each task more than once; check which tasks flipped.
- Tools: migration kit https://github.com/anthropics/single-agent-loop-kit ;
  `/claude-api build-eval`, `prompt-audit`, `hillclimb`, `cost-optimize`;
  `/skill-creator`, `/skill-doctor`.

**What we changed**
- Adopted the single agent loop as the CFO system design
  (`docs/agent-architecture.md`), replacing the planned CrewAI multi-agent crew.
- Added an eval-first workflow (`evals/README.md`).
- Started the Maji Safi knowledge base (`docs/maji-safi-knowledge.md`).
