"""The money ladder. Only a human reconciliation can make money RECEIVED."""

from dataclasses import dataclass, field

STAGES = ["ASKED", "DISCUSSED", "PROPOSED", "COMMITTED", "AVAILABLE",
          "RECEIVED", "DEPLOYED", "IMPACT_VERIFIED"]


class ReconciliationError(Exception):
    pass


@dataclass
class Case:
    case_id: str
    target_id: str
    amount_usd: float
    instrument: str | None = None
    stage: str = "ASKED"
    restricted: bool = False
    conditions: str | None = None
    reconciled_by: str | None = None
    bank_ref: str | None = None


@dataclass
class Ledger:
    goal_usd: float = 1_000_000
    cases: dict = field(default_factory=dict)

    def open(self, case: Case):
        self.cases[case.case_id] = case

    def advance(self, case_id: str, stage: str, actor: str, bank_ref: str | None = None):
        case = self.cases[case_id]
        if stage not in STAGES:
            raise ValueError(stage)
        if STAGES.index(stage) < STAGES.index(case.stage):
            raise ValueError("stages only move forward; record a lost case instead")
        if STAGES.index(stage) >= STAGES.index("RECEIVED") and case.reconciled_by is None:
            if stage != "RECEIVED":
                raise ReconciliationError("cannot deploy money that was never reconciled")
            if not actor.startswith("human:"):
                raise ReconciliationError("only a human can reconcile received cash")
            if not bank_ref:
                raise ReconciliationError("received cash needs a bank statement reference")
            case.reconciled_by, case.bank_ref = actor, bank_ref
        case.stage = stage

    def totals(self) -> dict:
        out = {s: 0.0 for s in STAGES}
        for c in self.cases.values():
            for s in STAGES[: STAGES.index(c.stage) + 1]:
                out[s] += c.amount_usd
        out["received_unrestricted"] = sum(
            c.amount_usd for c in self.cases.values()
            if c.reconciled_by and not c.restricted)
        out["to_goal"] = max(0.0, self.goal_usd - out["RECEIVED"])
        return out
