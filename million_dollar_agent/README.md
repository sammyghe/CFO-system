# Maji Safi — Million-Dollar Agent Master (v3)

An autonomous, self-learning agent team with one job: **US$1,000,000 reconciled in Maji Safi's account.**
Design: [`docs/MILLION_DOLLAR_AGENT_MASTER_v3.md`](../docs/MILLION_DOLLAR_AGENT_MASTER_v3.md).

## What's here

| Path | What it does |
|---|---|
| `config/campaign_policy.yaml` | Sammy's one-time authorisation: sender, caps, thresholds, rewards, escalation. Agents read it and never write it. |
| `config/claims.yaml` | Claims & Proof pack, proof ladder, template approval status |
| `config/schema.sql` | Tables mirroring the new Sheet tabs (targets, evidence, routes, events, suppression, ledger…) |
| `config/agents.yaml`, `config/tasks.yaml` | The CrewAI team and its Kampala-time schedule |
| `mdam/scoring.py` | 0–100 lead score. No sourced personal hook → never ASK |
| `mdam/guardrails.py` | **The send gate**: kill switch, authorisation, suppression, route class, claims, templates, lane, narrative, placeholders, opt-out, caps, duplicates |
| `mdam/cadence.py` | Ask-again tree: 5/7/10 business days → closed → re-ask after 90 days, only with a new proof rung |
| `mdam/replies.py` | Rule-based reply classifier (opt-out, decline, diligence, meeting, referral, later, injection…) |
| `mdam/learning.py` | Money-weighted Thompson sampling, 1-in-5 explore, adopt at 15 sends, retire after 3 failures |
| `mdam/ledger.py` | Asked → … → Received. Only `human:` plus a bank reference can mark cash received |
| `mdam/briefing.py` | The 08:15 US$1M briefing |
| `skills/*/SKILL.md` | One skill per crew (portable Agent Skills format) |

## Run the tests

```bash
pip install pyyaml pytest
cd million_dollar_agent && python -m pytest -q
```

## Status: dry run

`live_send: false` and no authorisation. The gate blocks every send until Sammy fills in:

1. `authorisation.authorised_by` and `authorised_on`
2. `sender.from_email`: own domain with SPF, DKIM and DMARC
3. `ask.allowed_instruments`
4. Claims set to `APPROVED` in `claims.yaml`, including the meaning of `impact_1000`
5. Then flip `live_send: true` → calibration at 5/day for 10 business days

## Next build steps
1. Google Sheets adapter: write the new tabs from `schema.sql`.
2. Gmail adapter (OAuth, minimum scopes: `gmail.send`, `gmail.readonly`, `gmail.labels`).
3. CrewAI runner wiring `agents.yaml` to the skills and the `mdam` gate.
4. promptfoo eval set from real Money Desk replies, before the model classifier replaces `replies.py`.
5. First 25 T1 dossiers in dry run, then Sammy spot-checks 5.
