"""Illustrative model constants for the AquaGrid demonstration network.

Every value here is synthetic. They are chosen to be physically plausible for a
mid-sized Gulf coastal desalination system, not to describe any real utility.
"""

ENGINE_VERSION = "aquagrid-sim 2.0.0"

# Storage ---------------------------------------------------------------------
RESERVOIRS = {
    "RES-01": {"name": "North reservoir", "capacity_m3": 3000},
    "RES-02": {"name": "Central reservoir", "capacity_m3": 4000},
    "RES-03": {"name": "South reservoir", "capacity_m3": 3000},
}
CAPACITY_M3 = sum(r["capacity_m3"] for r in RESERVOIRS.values())  # 10,000 m3
LEVEL_AT_1300_PCT = 61.5
LEVEL_AT_1400_PCT = 62.0
SAFETY_FLOOR_PCT = 35.0          # illustrative minimum strategic reserve
OVERFLOW_LIMIT_PCT = 98.0

# Demand ----------------------------------------------------------------------
SECTOR_DEMAND = {"SEC-01": 100, "SEC-02": 120, "SEC-03": 130, "SEC-04": 110, "SEC-05": 90}
DEMAND_M3H = sum(SECTOR_DEMAND.values())  # 550 m3/h
LEAK_M3H = 65.0                            # injected Sector 4 loss

# Production ------------------------------------------------------------------
NOMINAL_PRODUCTION_M3H = 600.0   # two RO trains x 300 m3/h
MIN_PRODUCTION_M3H = 100.0       # 2 x 50 m3/h minimum stable flux
MAX_PRODUCTION_M3H = 800.0       # 2 x 400 m3/h
RECOVERY = 0.48                  # permeate / feed
NOMINAL_FEED_M3H = 1250.0

# Tariff (illustrative USD / kWh) --------------------------------------------
PEAK_TARIFF = 0.32
OFF_PEAK_TARIFF = 0.12
PEAK_START_H = 14
PEAK_END_H = 20                  # peak window 14:00-20:00

# Planning horizon: 14:00 -> 24:00, hourly steps
HORIZON_START_H = 14
HORIZON_HOURS = 10

# Hydraulics (illustrative) --------------------------------------------------
MIN_SERVICE_PRESSURE_BAR = 2.0
PLANNED_INTERRUPTION_LIMIT = 500  # connections before escalation is required


def tariff_at(hour: int) -> float:
    return PEAK_TARIFF if PEAK_START_H <= hour % 24 < PEAK_END_H else OFF_PEAK_TARIFF


def specific_energy_kwh_m3(production_m3h: float) -> float:
    """Specific energy of the whole plant (intake to product pumping).

    Fixed auxiliary loads are amortised over less water at low output (b/p) and
    membrane feed pressure rises with flux at high output (c*p). Calibrated to
    3.5 kWh/m3 at the nominal 600 m3/h.
    """
    p = max(production_m3h, 1.0)
    return 2.64 + 120.0 / p + 0.0011 * p
