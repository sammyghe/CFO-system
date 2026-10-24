"""The send gate. Every outbound email passes every check or it does not go."""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta

from .models import Draft, Queue, Target
from .scoring import queue_for

PLACEHOLDER = re.compile(r"\[[^\]\n]+\]")  # [SAMMY: ...], [Name], [verified detail]


@dataclass
class SendLog:
    """What has already gone out. Backed by the events table in production."""
    sent_keys: set = field(default_factory=set)
    sends_by_day: dict = field(default_factory=dict)       # date -> count
    last_thread_by_org: dict = field(default_factory=dict)  # org -> date
    first_send_day: date | None = None

    def record(self, draft: Draft, target: Target, on: date):
        self.sent_keys.add(draft.idempotency_key)
        self.sends_by_day[on] = self.sends_by_day.get(on, 0) + 1
        if target.organisation:
            self.last_thread_by_org[target.organisation] = on
        self.first_send_day = self.first_send_day or on


@dataclass
class Suppression:
    keys: set = field(default_factory=set)   # emails, target ids, org domains

    def add(self, *keys):
        self.keys.update(k.lower() for k in keys if k)

    def blocks(self, target: Target) -> bool:
        cands = {target.target_id}
        if target.route:
            cands.add(target.route.address)
            if "@" in target.route.address:
                cands.add(target.route.address.split("@", 1)[1])
        return any(c.lower() in self.keys for c in cands)


def business_days_between(a: date, b: date) -> int:
    days, d = 0, a
    while d < b:
        d += timedelta(days=1)
        if d.weekday() < 5:
            days += 1
    return days


def daily_cap(policy, log: SendLog, today: date) -> int:
    caps = policy["caps"]
    if log.first_send_day is None:
        return caps["calibration_daily"]
    in_calibration = business_days_between(log.first_send_day, today) < caps["calibration_business_days"]
    if in_calibration or not caps.get("ramp_approved_by"):
        return caps["calibration_daily"]
    return caps["ramp_daily"]


def check_send(draft: Draft, target: Target, policy, claims, log: SendLog,
               suppression: Suppression, today: date) -> list[str]:
    """Return a list of block reasons. Empty list = clear to send."""
    reasons = []
    auth = policy.get("authorisation") or {}

    if policy.get("kill_switch"):
        reasons.append("kill switch is on")
    if not policy.get("live_send"):
        reasons.append("live_send is off (dry run)")
    if not auth.get("authorised_by") or not auth.get("authorised_on"):
        reasons.append("policy not authorised by Sammy")
    else:
        signed = auth["authorised_on"]
        signed = signed if isinstance(signed, date) else date.fromisoformat(str(signed))
        if today > signed + timedelta(days=auth.get("expires_after_days", 90)):
            reasons.append("policy authorisation expired")
    if not (policy.get("sender") or {}).get("from_email"):
        reasons.append("no sender address set")

    if suppression.blocks(target):
        reasons.append("target is suppressed")
    if target.route is None:
        reasons.append("no contact route")
    elif target.route.route_class.value not in policy["contact_routes"]["auto_send_allowed"]:
        reasons.append(f"route class {target.route.route_class.value} not allowed for auto-send")

    if queue_for(target, policy) is not Queue.ASK:
        reasons.append("target not in ASK queue (score or personal hook)")

    claim_index = {c["id"]: c for c in claims.get("claims", [])}
    for cid in draft.claim_ids:
        c = claim_index.get(cid)
        if c is None or c.get("status") != "APPROVED":
            reasons.append(f"claim {cid} not approved")
        elif c.get("recheck_on") and _as_date(c["recheck_on"]) < today:
            reasons.append(f"claim {cid} past recheck date")

    tmpl = {t["id"]: t for t in claims.get("templates", [])}.get(draft.template_id)
    if tmpl is None:
        reasons.append(f"unknown template {draft.template_id}")
    else:
        if tmpl.get("status") != "APPROVED":
            reasons.append(f"template {draft.template_id} not approved (language review)")
        if tmpl.get("lane") != target.lane or target.lane != policy.get("lane"):
            reasons.append("lane mismatch between template, target and policy")
        if tmpl.get("variant") != target.narrative:
            reasons.append("narrative mismatch (Builder vs Impact)")

    words = len(draft.body.split())
    if words > policy["ask"]["max_words"]:
        reasons.append(f"body is {words} words, max {policy['ask']['max_words']}")
    if PLACEHOLDER.search(draft.subject) or PLACEHOLDER.search(draft.body):
        reasons.append("draft still has an unfilled [placeholder]")
    if policy["sender"]["opt_out_line"] not in draft.body:
        reasons.append("opt-out line missing")

    if draft.idempotency_key in log.sent_keys:
        reasons.append("duplicate send")
    if log.sends_by_day.get(today, 0) >= daily_cap(policy, log, today):
        reasons.append("daily cap reached")
    week_start = today - timedelta(days=today.weekday())
    week_total = sum(n for d, n in log.sends_by_day.items() if week_start <= d <= today)
    if week_total >= policy["caps"]["weekly_max"]:
        reasons.append("weekly cap reached")
    last = log.last_thread_by_org.get(target.organisation) if target.organisation else None
    if last and business_days_between(last, today) < policy["caps"]["min_days_between_threads_same_org"]:
        reasons.append("another thread with this organisation is too recent")

    return reasons


def _as_date(v):
    return v if isinstance(v, date) else date.fromisoformat(str(v))
