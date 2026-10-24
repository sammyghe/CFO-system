"""The 08:15 US$1M Briefing. Money first, Sammy's three moves second."""


def render(ledger, waiting_on_sammy, follow_ups_due, blocked, lessons, today) -> str:
    t = ledger.totals()
    pct = 100 * t["RECEIVED"] / ledger.goal_usd
    lines = [
        f"MAJI SAFI — US$1M BRIEFING · {today:%a %d %b %Y}",
        "",
        f"RECEIVED (reconciled): US${t['RECEIVED']:,.0f} of US${ledger.goal_usd:,.0f} ({pct:.1f}%)",
        f"Committed, not yet received: US${t['COMMITTED'] - t['RECEIVED']:,.0f}",
        f"Asked: US${t['ASKED']:,.0f} · Discussed: US${t['DISCUSSED']:,.0f} · Proposed: US${t['PROPOSED']:,.0f}",
        "",
        "1 · YOUR MOVES TODAY (max 3, oldest wait first)",
    ]
    for i, w in enumerate(sorted(waiting_on_sammy, key=lambda w: -w["hours"])[:3], 1):
        lines.append(f"  {i}. {w['who']} — {w['step']} ({w['hours']}h waiting)")
    if not waiting_on_sammy:
        lines.append("  Nothing waits on you.")
    lines += ["", f"2 · FOLLOW-UPS DUE ({len(follow_ups_due)})"]
    lines += [f"  - {f}" for f in follow_ups_due] or ["  None."]
    lines += ["", f"3 · BLOCKED BY THE GATE ({len(blocked)})"]
    lines += [f"  - {b['who']}: {'; '.join(b['reasons'])}" for b in blocked] or ["  None."]
    lines += ["", "4 · WHAT WE LEARNED"]
    lines += [f"  - {l}" for l in lessons] or ["  No mature lessons yet."]
    return "\n".join(lines)
