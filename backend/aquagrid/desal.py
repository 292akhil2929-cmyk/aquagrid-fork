"""Simplified seawater reverse-osmosis process and energy model (illustrative)."""

from . import config as C

STAGES = [
    {
        "id": "intake", "asset": "INT-01", "name": "Seawater intake",
        "role": "Draws seawater from 9 m depth, 600 m offshore, through velocity-capped screens that limit marine-life entrainment.",
        "parameters": [("Feed salinity", "42,000 mg/L TDS"), ("Intake velocity", "< 0.15 m/s"), ("Screens", "Travelling band, 3 mm")],
        "energy_share": 0.07,
    },
    {
        "id": "pretreatment", "asset": "PT-01", "name": "Pretreatment",
        "role": "Dissolved-air flotation removes algae and oils; dual-media and 5 µm cartridge filters protect the membranes from fouling.",
        "parameters": [("Process", "DAF → dual-media → cartridge"), ("Target SDI₁₅", "< 3.0"), ("Coagulant", "Ferric chloride")],
        "energy_share": 0.09,
    },
    {
        "id": "hp_pumps", "asset": "HPP-01", "name": "High-pressure pumps",
        "role": "Raise pretreated feed above the osmotic pressure of Gulf seawater so fresh water can be forced through the membranes.",
        "parameters": [("Discharge pressure", "~64 bar"), ("Pump efficiency", "~85%"), ("Drive", "Variable speed")],
        "energy_share": 0.62,
    },
    {
        "id": "membranes", "asset": "RO-01", "name": "Membrane pressure vessels",
        "role": "Spiral-wound polyamide membranes reject ~99.7% of dissolved salt. About 48% of the feed becomes permeate.",
        "parameters": [("Vessels", "2 trains × 24"), ("Elements / vessel", "7"), ("Recovery", f"{C.RECOVERY:.0%}")],
        "energy_share": 0.0,
    },
    {
        "id": "erd", "asset": "ERD-01", "name": "Energy recovery",
        "role": "Isobaric pressure exchangers transfer the pressure left in the brine back to incoming feed, cutting pump energy by roughly half.",
        "parameters": [("Transfer efficiency", "~96%"), ("Brine to outfall", "~52% of feed"), ("Booster pump", "Makes up ΔP")],
        "energy_share": 0.04,
    },
    {
        "id": "output", "asset": "COND-01", "name": "Treated-water output",
        "role": "Permeate is remineralised and disinfected, checked for conductivity, then pumped to strategic storage.",
        "parameters": [("Product TDS", "< 200 mg/L"), ("Post-treatment", "Lime / CO₂, chlorination"), ("Delivery", "To RES-01…03")],
        "energy_share": 0.18,
    },
]


def operating_point(production_m3h):
    p = float(production_m3h)
    sec = C.specific_energy_kwh_m3(p)
    power = p * sec
    feed = p / C.RECOVERY
    return {
        "production_m3h": round(p, 1),
        "feed_m3h": round(feed, 0),
        "brine_m3h": round(feed - p, 0),
        "sec_kwh_m3": round(sec, 3),
        "power_kw": round(power, 0),
        "cost_per_hour_peak_usd": round(power * C.PEAK_TARIFF, 0),
        "cost_per_hour_offpeak_usd": round(power * C.OFF_PEAK_TARIFF, 0),
        "stage_power_kw": {s["id"]: round(power * s["energy_share"], 0) for s in STAGES},
    }


def model(production_m3h=C.NOMINAL_PRODUCTION_M3H):
    p = min(max(float(production_m3h), C.MIN_PRODUCTION_M3H), C.MAX_PRODUCTION_M3H)
    curve = [operating_point(x) for x in range(int(C.MIN_PRODUCTION_M3H), int(C.MAX_PRODUCTION_M3H) + 1, 25)]
    return {
        "stages": [{**s, "parameters": [{"label": a, "value": b} for a, b in s["parameters"]]} for s in STAGES],
        "operating_point": operating_point(p),
        "curve": [{"production_m3h": c["production_m3h"], "power_kw": c["power_kw"], "sec_kwh_m3": c["sec_kwh_m3"]} for c in curve],
        "limits": {"min_m3h": C.MIN_PRODUCTION_M3H, "max_m3h": C.MAX_PRODUCTION_M3H, "nominal_m3h": C.NOMINAL_PRODUCTION_M3H},
        "tariffs": {"peak": C.PEAK_TARIFF, "off_peak": C.OFF_PEAK_TARIFF,
                    "peak_window": f"{C.PEAK_START_H:02d}:00–{C.PEAK_END_H:02d}:00"},
        "note": "Specific energy = fixed auxiliary load amortised over output + flux-dependent feed pressure; "
                "calibrated to 3.5 kWh/m³ at 600 m³/h. Illustrative, not plant data.",
    }
