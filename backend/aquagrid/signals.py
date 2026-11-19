"""Deterministic synthetic telemetry.

Each sensor is a pure function of the minute of day (and the simulated valve
state), so every request reproduces exactly the same readings. Noise is seeded
by sensor id and minute.
"""

import math
import random

LEAK_START_MIN = 14 * 60 + 2        # 14:02 Sector 4 harbour-branch break
P_S4B_STUCK_FROM_MIN = 13 * 60 + 53  # 13:53 transducer freezes at last value
P_S4B_STUCK_VALUE = 3.80
BLOOM_CENTRE_MIN = 14 * 60 + 9


def _noise(sensor_id, minute):
    return random.Random(f"{sensor_id}:{minute}").uniform(-1.0, 1.0)


def _sig(x):
    return 1.0 / (1.0 + math.exp(-x))


def leak_flow(minute, isolated_at=None):
    """Modelled leak outflow (m3/h) at a given minute."""
    if minute < LEAK_START_MIN:
        return 0.0
    if isolated_at is not None and minute >= isolated_at:
        return 0.0
    return 65.0 * (1.0 - math.exp(-(minute - LEAK_START_MIN) / 1.0))


def reading(sensor_id, minute, isolated_at=None):
    n = _noise(sensor_id, minute)
    leak = leak_flow(minute, isolated_at)
    leak_frac = leak / 65.0
    after_isolation = isolated_at is not None and minute >= isolated_at

    if sensor_id == "P-S3":
        return round(3.92 + 0.03 * n - 0.08 * leak_frac, 2)
    if sensor_id == "P-S4A":
        if after_isolation:
            return round(3.55 + 0.03 * n, 2)
        return round(3.80 + 0.03 * n - 2.10 * leak_frac, 2)
    if sensor_id == "P-S4B":
        if minute >= P_S4B_STUCK_FROM_MIN:
            return P_S4B_STUCK_VALUE
        return round(3.80 + 0.03 * n, 2)
    if sensor_id == "FM-S4":
        if after_isolation:
            return round(98.0 + 2.5 * n, 1)
        return round(110.0 + 2.5 * n + leak, 1)
    if sensor_id == "FM-PS":
        base = 538.0 if after_isolation else 550.0
        return round(base + 5.0 * n + leak, 1)
    if sensor_id == "CHL-01":
        return round(1.4 + 0.15 * n + 9.5 * _sig((minute - BLOOM_CENTRE_MIN) / 6.0), 2)
    if sensor_id == "TURB-01":
        return round(1.6 + 0.1 * n + 3.0 * _sig((minute - BLOOM_CENTRE_MIN) / 6.0), 2)
    if sensor_id == "SDI-01":
        return round(2.9 + 0.05 * n + 0.6 * _sig((minute - BLOOM_CENTRE_MIN - 3) / 8.0), 2)
    if sensor_id == "COND-01":
        return round(310.0 + 4.0 * n, 0)
    raise KeyError(sensor_id)


SENSOR_META = {
    "P-S3": {"unit": "bar", "label": "Sector 3 pressure", "low_alarm": 2.5},
    "P-S4A": {"unit": "bar", "label": "Sector 4 pressure A", "low_alarm": 2.5},
    "P-S4B": {"unit": "bar", "label": "Sector 4 pressure B", "low_alarm": 2.5},
    "FM-S4": {"unit": "m³/h", "label": "Sector 4 inflow"},
    "FM-PS": {"unit": "m³/h", "label": "Pumping station outflow"},
    "CHL-01": {"unit": "µg/L", "label": "Intake chlorophyll-a", "warning": 7.0},
    "TURB-01": {"unit": "NTU", "label": "Intake turbidity", "warning": 4.0},
    "SDI-01": {"unit": "SDI₁₅", "label": "RO feed silt density index", "warning": 3.0, "limit": 5.0},
    "COND-01": {"unit": "µS/cm", "label": "Product conductivity", "limit": 800.0},
}


def series(sensor_id, end_minute, length=30, isolated_at=None):
    return [
        {"t": fmt(m), "v": reading(sensor_id, m, isolated_at)}
        for m in range(end_minute - length + 1, end_minute + 1)
    ]


def fmt(minute):
    return f"{(minute // 60) % 24:02d}:{minute % 60:02d}"
