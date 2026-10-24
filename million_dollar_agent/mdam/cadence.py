"""Ask-again decision tree. Every re-ask must carry a new proof rung."""

from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class SeriesState(str, Enum):
    FIRST_SENT = "FIRST_SENT"
    FOLLOW_UP_1 = "FOLLOW_UP_1"
    FOLLOW_UP_2 = "FOLLOW_UP_2"
    CLOSE_LOOP = "CLOSE_LOOP"
    SERIES_CLOSED = "SERIES_CLOSED"
    WAITING_MILESTONE = "WAITING_MILESTONE"
    ESCALATED = "ESCALATED"
    SUPPRESSED = "SUPPRESSED"


@dataclass
class Series:
    target_id: str
    state: SeriesState
    last_touch: date
    rungs_used: set = field(default_factory=set)   # proof rungs already cited to this person
    watch_date: date | None = None
    watch_milestone: str | None = None


def add_business_days(d: date, n: int) -> date:
    while n > 0:
        d += timedelta(days=1)
        if d.weekday() < 5:
            n -= 1
    return d


def next_action(s: Series, policy, today: date, reached_rungs: list[str]):
    """Return (action, due_date) or (None, None). action is a string the Operator acts on."""
    cfg = policy["cadence_business_days"]
    if s.state in (SeriesState.SUPPRESSED, SeriesState.ESCALATED):
        return None, None

    steps = {
        SeriesState.FIRST_SENT: ("FOLLOW_UP_1", cfg["follow_up_1"]),
        SeriesState.FOLLOW_UP_1: ("FOLLOW_UP_2", cfg["follow_up_2"]),
        SeriesState.FOLLOW_UP_2: ("CLOSE_LOOP", cfg["close_loop"]),
    }
    if s.state in steps:
        action, gap = steps[s.state]
        due = add_business_days(s.last_touch, gap)
        return (action, due) if today >= due else (None, due)

    if s.state == SeriesState.CLOSE_LOOP:
        return "MARK_SERIES_CLOSED", today

    fresh = [r for r in reached_rungs if r not in s.rungs_used]

    if s.state == SeriesState.WAITING_MILESTONE:
        if s.watch_date and today >= s.watch_date:
            return "REASK_AT_THEIR_TIMING", today
        if s.watch_milestone and s.watch_milestone in reached_rungs:
            return "REASK_AT_THEIR_TIMING", today
        return None, s.watch_date

    if s.state == SeriesState.SERIES_CLOSED:
        reopen = s.last_touch + timedelta(days=cfg.get("reopen_min_calendar_days", 90))
        if today >= reopen and fresh:
            return f"REASK_WITH_NEW_PROOF:{fresh[0]}", today
        return None, reopen

    return None, None


def reached_rungs(claims) -> list[str]:
    return [r["id"] for r in claims.get("proof_ladder", []) if r.get("reached_on")]
