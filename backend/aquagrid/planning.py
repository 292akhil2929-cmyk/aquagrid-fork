"""Reservoir projection and production-plan safety evaluation.

next_volume = volume + production - demand - modelled_loss   (hourly)
"""

from . import config as C

PLAN_LIBRARY = {
    "baseline": {
        "name": "Baseline operation",
        "summary": "Hold both RO trains at the nominal 600 m³/h through the evening.",
    },
    "peak_throttle": {
        "name": "Proposed peak-tariff throttling",
        "summary": "Cut production to the 100 m³/h minimum for the whole 14:00–20:00 peak, recover at 600 m³/h.",
    },
    "shift": {
        "name": "Shift to off-peak",
        "summary": "Run 400 m³/h through the peak, then 800 m³/h once the tariff falls.",
    },
}


def plan_production(plan_id):
    hours = [C.HORIZON_START_H + i for i in range(C.HORIZON_HOURS)]
    peak = [C.PEAK_START_H <= h < C.PEAK_END_H for h in hours]
    if plan_id == "baseline":
        return [C.NOMINAL_PRODUCTION_M3H] * C.HORIZON_HOURS
    if plan_id == "peak_throttle":
        return [C.MIN_PRODUCTION_M3H if p else C.NOMINAL_PRODUCTION_M3H for p in peak]
    if plan_id == "shift":
        return [400.0 if p else C.MAX_PRODUCTION_M3H for p in peak]
    raise KeyError(plan_id)


def project(production, start_pct, loss_m3h, demand_m3h=C.DEMAND_M3H):
    levels = [start_pct]
    rows = []
    for i, prod in enumerate(production):
        hour = C.HORIZON_START_H + i
        net = prod - demand_m3h - loss_m3h
        nxt = levels[-1] + net / C.CAPACITY_M3 * 100.0
        levels.append(nxt)
        sec = C.specific_energy_kwh_m3(prod)
        energy = prod * sec
        tariff = C.tariff_at(hour)
        rows.append({
            "hour": f"{hour % 24:02d}:00",
            "production_m3h": prod,
            "demand_m3h": demand_m3h,
            "loss_m3h": loss_m3h,
            "net_m3h": round(net, 1),
            "tariff_usd_kwh": tariff,
            "energy_kwh": round(energy, 1),
            "cost_usd": round(energy * tariff, 2),
            "level_end_pct": round(nxt, 2),
        })
    return levels, rows


def evaluate(production, *, start_pct, loss_m3h, quality_review_open, plan_id="custom", baseline=None):
    if len(production) != C.HORIZON_HOURS:
        raise ValueError(f"production must contain {C.HORIZON_HOURS} hourly values")
    production = [float(p) for p in production]
    levels, rows = project(production, start_pct, loss_m3h)
    min_level = min(levels)
    min_idx = levels.index(min_level)
    cost = sum(r["cost_usd"] for r in rows)
    energy = sum(r["energy_kwh"] for r in rows)
    peak_energy = sum(r["energy_kwh"] for r in rows if r["tariff_usd_kwh"] == C.PEAK_TARIFF)

    constraints = [
        {
            "id": "reserve_floor",
            "label": f"Combined storage stays at or above the {C.SAFETY_FLOOR_PCT:.0f}% safety floor",
            "severity": "hard",
            "passed": min_level >= C.SAFETY_FLOOR_PCT,
            "detail": f"Minimum projected storage {min_level:.1f}% at {fmt_hour(min_idx)}.",
        },
        {
            "id": "plant_turndown",
            "label": f"Production within RO operating envelope ({C.MIN_PRODUCTION_M3H:.0f}–{C.MAX_PRODUCTION_M3H:.0f} m³/h)",
            "severity": "hard",
            "passed": all(C.MIN_PRODUCTION_M3H <= p <= C.MAX_PRODUCTION_M3H for p in production),
            "detail": f"Range requested {min(production):.0f}–{max(production):.0f} m³/h.",
        },
        {
            "id": "overflow",
            "label": f"Storage stays below the {C.OVERFLOW_LIMIT_PCT:.0f}% overflow limit",
            "severity": "hard",
            "passed": max(levels) <= C.OVERFLOW_LIMIT_PCT,
            "detail": f"Maximum projected storage {max(levels):.1f}%.",
        },
    ]
    changes_production = any(abs(p - C.NOMINAL_PRODUCTION_M3H) > 1e-6 for p in production)
    if quality_review_open:
        constraints.append({
            "id": "quality_review",
            "label": "No open intake water-quality review",
            "severity": "advisory",
            "passed": not changes_production,
            "detail": ("An intake-quality warning is under assessment. Production changes need a human "
                       "water-quality review before they are scheduled." if changes_production
                       else "Warning open, but this plan does not change production."),
        })

    hard_fail = [c for c in constraints if c["severity"] == "hard" and not c["passed"]]
    soft_fail = [c for c in constraints if c["severity"] == "advisory" and not c["passed"]]
    if hard_fail:
        verdict, headline = "REJECTED", "SAFETY CONSTRAINT VIOLATED"
    elif soft_fail:
        verdict, headline = "HOLD", "HUMAN REVIEW REQUIRED"
    else:
        verdict, headline = "ACCEPTED", "WITHIN SAFETY CONSTRAINTS"

    breach_hour = next((fmt_hour(i) for i, lv in enumerate(levels) if lv < C.SAFETY_FLOOR_PCT), None)
    result = {
        "plan_id": plan_id,
        "plan_name": PLAN_LIBRARY.get(plan_id, {}).get("name", "Custom schedule"),
        "hours": [fmt_hour(i) for i in range(C.HORIZON_HOURS + 1)],
        "production_m3h": production,
        "levels_pct": [round(v, 2) for v in levels],
        "rows": rows,
        "min_level_pct": round(min_level, 2),
        "min_level_at": fmt_hour(min_idx),
        "end_level_pct": round(levels[-1], 2),
        "breach_at": breach_hour,
        "floor_pct": C.SAFETY_FLOOR_PCT,
        "energy_kwh": round(energy, 0),
        "peak_energy_kwh": round(peak_energy, 0),
        "cost_usd": round(cost, 0),
        "constraints": constraints,
        "verdict": verdict,
        "headline": headline,
    }
    if baseline is not None:
        result["savings_vs_baseline_usd"] = round(baseline["cost_usd"] - cost, 0)
    return result


def safe_alternative(*, start_pct, loss_m3h, margin_pct=2.0):
    """Lowest constant peak-window production that keeps the floor + margin,
    recovering at full capacity off-peak."""
    lo, hi = C.MIN_PRODUCTION_M3H, C.NOMINAL_PRODUCTION_M3H
    hours = [C.HORIZON_START_H + i for i in range(C.HORIZON_HOURS)]

    def schedule(p):
        return [p if C.PEAK_START_H <= h < C.PEAK_END_H else C.MAX_PRODUCTION_M3H for h in hours]

    def ok(p):
        levels, _ = project(schedule(p), start_pct, loss_m3h)
        return min(levels) >= C.SAFETY_FLOOR_PCT + margin_pct and max(levels) <= C.OVERFLOW_LIMIT_PCT

    if not ok(hi):
        return None
    for _ in range(40):
        mid = (lo + hi) / 2
        if ok(mid):
            hi = mid
        else:
            lo = mid
    peak = float(int(hi + 9.999) // 10 * 10)  # round up to the next 10 m3/h
    return {"peak_production_m3h": peak, "production_m3h": schedule(peak), "margin_pct": margin_pct}


def fmt_hour(i):
    return f"{(C.HORIZON_START_H + i) % 24:02d}:00"
