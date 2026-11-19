"""Human-in-the-loop valve control for the *simulated* network.

There is no actuator binding anywhere in this codebase. A valve change only ever
updates a backend-signed simulation record after an authenticated
Control-Room Operator approves a staged, re-validated proposal.
"""

import hashlib
import time
import uuid

from . import config as C
from . import network, planning, security, sensors, signals
from .scenario import Context

PROPOSAL_TTL_S = 10 * 60
SECTOR4_PRESSURE_AFTER = {  # illustrative steady-state pressure at P-S4A
    frozenset(): None,
    frozenset({"V-04B"}): 3.55,
    frozenset({"V-04A"}): 0.0,
    frozenset({"V-04A", "V-04B"}): 0.0,
}


class ControlError(Exception):
    def __init__(self, message, status=409, evaluation=None):
        super().__init__(message)
        self.status = status
        self.evaluation = evaluation


def context_digest(ctx: Context):
    raw = f"{ctx.scene['id']}|{','.join(ctx.quarantined)}|{','.join(ctx.closed_valves)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def evaluate_valve_action(valve_id, action, ctx: Context):
    if valve_id not in network.CONTROLLABLE_VALVES:
        raise ControlError(f"{valve_id} is not a controllable valve in the simulation.", 400)
    if action not in ("close", "open"):
        raise ControlError("Action must be 'close' or 'open'.", 400)
    current = ctx.positions.get(valve_id, "open")
    target = "closed" if action == "close" else "open"
    if current == target:
        raise ControlError(f"{valve_id} is already {current}.", 409)

    closed_after = set(ctx.closed_valves)
    closed_after.symmetric_difference_update({valve_id})
    impact = network.isolation_impact(closed_after)
    fb = sensors.sector4_flow_balance(ctx.minute, ctx.isolated_at)
    incident_confirmed = fb["imbalance"]
    leak_after = 0.0 if "V-04B" in closed_after or "V-04A" in closed_after else ctx.leak_now()
    pressure_after = SECTOR4_PRESSURE_AFTER.get(frozenset(closed_after & {"V-04A", "V-04B"}))
    loss_after = 0.0 if leak_after == 0 else C.LEAK_M3H
    levels, _ = planning.project(planning.plan_production("baseline"), C.LEVEL_AT_1400_PCT, loss_after)

    checks = [
        {"id": "simulation_only", "severity": "hard", "passed": True,
         "label": "Target is the simulated valve model only",
         "detail": "No industrial actuator, PLC or SCADA endpoint is bound to this action."},
        {"id": "incident_evidence", "severity": "hard", "passed": incident_confirmed or action == "open",
         "label": "Action is justified by confirmed incident evidence",
         "detail": (f"Flow balance shows {fb['unexplained_m3h']:.0f} m³/h unexplained in Sector 4."
                    if incident_confirmed else "No confirmed incident — isolating customers is not justified.")},
        {"id": "critical_supply", "severity": "hard",
         "passed": not impact["critical_facilities_without_supply"],
         "label": "No critical facility loses supply",
         "detail": (", ".join(impact["critical_facilities_without_supply"]) + " would lose supply."
                    if impact["critical_facilities_without_supply"] else "Hospital and critical consumers stay connected.")},
        {"id": "interruption_size", "severity": "hard",
         "passed": impact["connections_without_supply"] <= C.PLANNED_INTERRUPTION_LIMIT,
         "label": f"Planned interruption ≤ {C.PLANNED_INTERRUPTION_LIMIT} connections",
         "detail": f"{impact['connections_without_supply']:,} connections without supply "
                   f"({', '.join(impact['isolated_nodes']) or 'none'})."},
        {"id": "service_pressure", "severity": "hard",
         "passed": pressure_after is None or pressure_after >= C.MIN_SERVICE_PRESSURE_BAR,
         "label": f"Remaining Sector 4 pressure ≥ {C.MIN_SERVICE_PRESSURE_BAR} bar",
         "detail": ("Unchanged." if pressure_after is None else f"Projected {pressure_after:.2f} bar at P-S4A.")},
        {"id": "reserve_floor", "severity": "hard", "passed": min(levels) >= C.SAFETY_FLOOR_PCT,
         "label": f"Storage projection stays above {C.SAFETY_FLOOR_PCT:.0f}%",
         "detail": f"Minimum {min(levels):.1f}% with baseline production and {loss_after:.0f} m³/h loss."},
    ]
    passed = all(c["passed"] for c in checks if c["severity"] == "hard")
    return {
        "valve_id": valve_id, "action": action, "current_position": current, "target_position": target,
        "checks": checks,
        "verdict": "AWAITING_APPROVAL" if passed else "REJECTED",
        "headline": "LOCKED — OPERATOR APPROVAL REQUIRED" if passed else "SAFETY CONSTRAINT VIOLATED",
        "impact": {**impact, "leak_after_m3h": leak_after, "sector4_pressure_after_bar": pressure_after,
                   "min_storage_pct": round(min(levels), 2)},
        "evaluated_at": signals.fmt(ctx.minute),
    }


def stage(valve_id, action, ctx: Context, proposed_by="Operator request", now=None):
    now = int(now or time.time())
    evaluation = evaluate_valve_action(valve_id, action, ctx)
    result = {"evaluation": evaluation, "proposal": None, "signature": None}
    if evaluation["verdict"] == "REJECTED":
        return result
    proposal = {
        "id": "PRP-" + uuid.uuid4().hex[:8].upper(),
        "valve_id": valve_id, "action": action, "target_position": evaluation["target_position"],
        "proposed_by": proposed_by, "staged_at": now, "expires_at": now + PROPOSAL_TTL_S,
        "context_digest": context_digest(ctx), "scene": ctx.scene["id"],
    }
    result.update(proposal=proposal, signature=security.sign(proposal))
    return result


def approve(proposal, signature, token, ctx: Context, now=None):
    now = int(now or time.time())
    operator = security.require_approver(token, now)
    if not isinstance(proposal, dict) or not security.verify(proposal, signature):
        raise ControlError("Proposal signature is invalid. Stage the action again.", 400)
    if proposal["expires_at"] < now:
        raise ControlError("Proposal expired before approval. Stage it again.", 409)
    # Revalidate against the state *now*, not the state when the AI staged it.
    evaluation = evaluate_valve_action(proposal["valve_id"], proposal["action"], ctx)
    if evaluation["verdict"] == "REJECTED":
        raise ControlError("Revalidation failed: the network changed and the action is no longer safe.", 409, evaluation)
    record = {
        "valve_id": proposal["valve_id"], "position": proposal["target_position"],
        "applied_minute": ctx.minute + 1, "proposal_id": proposal["id"], "scene": ctx.scene["id"],
        "approved_by": operator["sub"], "approver_name": operator["name"], "approved_at": now,
        "simulated": True,
    }
    return {"record": record, "signature": security.sign(record), "evaluation": evaluation, "operator": operator}
