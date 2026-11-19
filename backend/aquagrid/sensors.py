"""Sensor-fault diagnostics: flatline detection with independent cross-checks."""

from statistics import pvariance

from . import signals
from .config import SECTOR_DEMAND

FLATLINE_WINDOW = 15            # samples (1 per minute)
FLATLINE_VARIANCE = 1e-6
NEIGHBOUR_TOLERANCE_BAR = 0.4

NEIGHBOURS = {
    "P-S4B": ["P-S4A", "P-S3"],
    "P-S4A": ["P-S4B", "P-S3"],
    "P-S3": ["P-S4A"],
}


def run_length(values):
    """Number of trailing samples identical to the final sample."""
    last, n = values[-1], 0
    for v in reversed(values):
        if v != last:
            break
        n += 1
    return n


def flatline_check(sensor_id, minute, isolated_at=None):
    window = [signals.reading(sensor_id, m, isolated_at) for m in range(minute - FLATLINE_WINDOW + 1, minute + 1)]
    var = pvariance(window)
    run = run_length([signals.reading(sensor_id, m, isolated_at) for m in range(minute - 59, minute + 1)])
    return {
        "variance": var,
        "identical_samples": run,
        "flatline": var < FLATLINE_VARIANCE and run >= FLATLINE_WINDOW,
    }


def sector4_flow_balance(minute, isolated_at=None):
    inflow = signals.reading("FM-S4", minute, isolated_at)
    expected = SECTOR_DEMAND["SEC-04"] - (12 if isolated_at is not None and minute >= isolated_at else 0)
    excess = round(inflow - expected, 1)
    return {"inflow_m3h": inflow, "expected_demand_m3h": expected, "unexplained_m3h": excess,
            "imbalance": excess > 20.0}


def analyze(sensor_id, minute, isolated_at=None):
    if sensor_id not in signals.SENSOR_META:
        raise KeyError(sensor_id)
    value = signals.reading(sensor_id, minute, isolated_at)
    flat = flatline_check(sensor_id, minute, isolated_at)
    checks = [{
        "id": "flatline",
        "label": f"Signal variance over last {FLATLINE_WINDOW} samples",
        "result": f"{flat['variance']:.2e} · {flat['identical_samples']} identical samples",
        "fault_indicated": flat["flatline"],
    }]

    disagreements = 0
    for nb in NEIGHBOURS.get(sensor_id, []):
        nb_value = signals.reading(nb, minute, isolated_at)
        diff = round(abs(value - nb_value), 2)
        # Sector 3 is upstream on a different branch: compare against a wider band.
        tol = NEIGHBOUR_TOLERANCE_BAR if nb.startswith("P-S4") else 1.0
        disagree = diff > tol
        disagreements += disagree
        checks.append({
            "id": f"neighbour:{nb}",
            "label": f"Cross-check against {nb} ({signals.SENSOR_META[nb]['label']})",
            "result": f"{value} vs {nb_value} {signals.SENSOR_META[nb]['unit']} (Δ {diff}, tolerance {tol})",
            "fault_indicated": disagree,
        })

    if sensor_id.startswith("P-S4"):
        fb = sector4_flow_balance(minute, isolated_at)
        reading_says_normal = value >= signals.SENSOR_META[sensor_id]["low_alarm"]
        contradicts = fb["imbalance"] and reading_says_normal
        checks.append({
            "id": "flow-balance",
            "label": "Sector 4 flow balance (inflow vs expected demand)",
            "result": f"{fb['inflow_m3h']} in vs {fb['expected_demand_m3h']} expected → {fb['unexplained_m3h']} m³/h unexplained",
            "fault_indicated": contradicts,
        })

    faults = [c for c in checks if c["fault_indicated"]]
    unreliable = flat["flatline"] and len(faults) >= 2
    if unreliable:
        verdict = "UNRELIABLE"
        summary = (f"{sensor_id} has reported exactly {value} for {flat['identical_samples']} minutes while independent "
                   "measurements moved. Its readings should not be used for decisions until a field check.")
    elif flat["flatline"]:
        verdict = "SUSPECT"
        summary = f"{sensor_id} is flat, but independent measurements do not yet contradict it."
    else:
        verdict = "PLAUSIBLE"
        summary = f"{sensor_id} shows normal variation and agrees with independent measurements."
    return {
        "sensor_id": sensor_id,
        "clock": signals.fmt(minute),
        "value": value,
        "unit": signals.SENSOR_META[sensor_id]["unit"],
        "checks": checks,
        "verdict": verdict,
        "quarantine_recommended": unreliable,
        "summary": summary,
        "note": "A flatline marks an unreliable channel. It is not, by itself, evidence about the network or the water.",
    }
