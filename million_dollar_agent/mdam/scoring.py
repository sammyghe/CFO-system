"""Lead score 0-100. A ranking, never a probability of a cheque."""

from .models import Queue, RouteClass, Target

ROUTE_RATING = {
    RouteClass.DIRECT_PUBLIC: 1.0,
    RouteClass.INTRODUCTION: 1.0,
    RouteClass.OFFICE_PUBLIC: 0.7,
    RouteClass.FORM: 0.3,
}


def score(target: Target, policy) -> int:
    weights = policy["scoring"]["weights"]
    ratings = dict(target.ratings)
    # Hook and route are rated from evidence, not from the agent's say-so.
    ratings["personal_hook"] = 1.0 if _hook_ok(target) else 0.0
    ratings["contact_route"] = ROUTE_RATING.get(target.route.route_class, 0.0) if target.route else 0.0
    total = 0.0
    for dim, w in weights.items():
        r = max(0.0, min(1.0, float(ratings.get(dim, 0.0))))
        total += w * r
    return round(total)


def queue_for(target: Target, policy) -> Queue:
    s = score(target, policy)
    cfg = policy["scoring"]
    if s >= cfg["ask_threshold"]:
        if cfg.get("require_personal_hook_for_ask") and not _hook_ok(target):
            return Queue.RESEARCH_MORE
        return Queue.ASK
    if s >= cfg["research_threshold"]:
        return Queue.RESEARCH_MORE
    return Queue.HOLD


def _hook_ok(target: Target) -> bool:
    h = target.personal_hook
    return bool(h and h.url and h.claim and not h.is_inference)
