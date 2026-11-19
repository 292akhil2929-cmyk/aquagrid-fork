"""Authoritative operational state for each step of the guided scenario."""

from . import config as C
from . import network, sensors, signals, security

SCENES = [
    {"id": 1, "key": "normal", "title": "Normal operations", "minute": 13 * 60},
    {"id": 2, "key": "tariff", "title": "14:00 tariff spike", "minute": 14 * 60},
    {"id": 3, "key": "leak", "title": "Sector 4 leak", "minute": 14 * 60 + 6},
    {"id": 4, "key": "flatline", "title": "Sensor flatline", "minute": 14 * 60 + 9},
    {"id": 5, "key": "bloom", "title": "Algal-bloom warning", "minute": 14 * 60 + 12},
    {"id": 6, "key": "decision", "title": "The unsafe decision", "minute": 14 * 60 + 15},
    {"id": 7, "key": "control", "title": "Human control", "minute": 14 * 60 + 20},
]
SCENE_INDEX = {s["id"]: s for s in SCENES}
DEFAULT_POSITIONS = {"V-04A": "open", "V-04B": "open"}


class Context:
    """Request context: scene, quarantined sensors and backend-signed valve records."""

    def __init__(self, scene=1, quarantined=None, valve_records=None):
        scene = int(scene or 1)
        if scene not in SCENE_INDEX:
            raise ValueError("scene must be between 1 and 7")
        self.scene = SCENE_INDEX[scene]
        self.quarantined = sorted({q for q in (quarantined or []) if q in signals.SENSOR_META})
        self.positions = dict(DEFAULT_POSITIONS)
        self.records, self.rejected_records = [], []
        self.isolated_at = None
        for item in valve_records or []:
            record, sig = (item or {}).get("record"), (item or {}).get("signature")
            if not isinstance(record, dict) or not security.verify(record, sig):
                self.rejected_records.append("Unsigned or altered valve record ignored.")
                continue
            if self.scene["id"] < int(record.get("scene", 7)):
                continue  # the action happened later in the story than the scene being viewed
            self.records.append(record)
            self.positions[record["valve_id"]] = record["position"]
            if record["valve_id"] == "V-04B" and record["position"] == "closed":
                self.isolated_at = int(record["applied_minute"])
        self.minute = self.scene["minute"]
        if self.isolated_at is not None:
            self.minute = max(self.minute, self.isolated_at + 2)

    @property
    def closed_valves(self):
        return sorted(v for v, p in self.positions.items() if p == "closed")

    def leak_now(self):
        return signals.leak_flow(self.minute, self.isolated_at)

    def planning_loss(self):
        """Loss carried into the 14:00 planning horizon."""
        if self.scene["id"] < 3 or self.isolated_at is not None:
            return 0.0
        return C.LEAK_M3H


def storage_pct(minute, isolated_at=None):
    level = C.LEVEL_AT_1300_PCT
    for m in range(13 * 60, minute):
        demand = C.DEMAND_M3H - (12 if isolated_at is not None and m >= isolated_at else 0)
        net = C.NOMINAL_PRODUCTION_M3H - demand - signals.leak_flow(m, isolated_at)
        level += net / C.CAPACITY_M3 * 100.0 / 60.0
    return level


def sensor_states(ctx):
    out = {}
    for sid, meta in signals.SENSOR_META.items():
        value = signals.reading(sid, ctx.minute, ctx.isolated_at)
        status = "normal"
        if "low_alarm" in meta and value < meta["low_alarm"]:
            status = "alarm"
        if "warning" in meta and value >= meta["warning"]:
            status = "warning"
        if sid == "FM-S4" and sensors.sector4_flow_balance(ctx.minute, ctx.isolated_at)["imbalance"]:
            status = "alarm"
        if sid in sensors.NEIGHBOURS and sensors.flatline_check(sid, ctx.minute, ctx.isolated_at)["flatline"]:
            status = "flatline"
        if sid in ctx.quarantined:
            status = "quarantined"
        out[sid] = {
            "id": sid, "label": meta["label"], "unit": meta["unit"], "value": value, "status": status,
            "thresholds": {k: meta[k] for k in ("low_alarm", "warning", "limit") if k in meta},
            "attached_to": network.SENSOR_ATTACHMENT.get(sid),
            "series": signals.series(sid, ctx.minute, 30, ctx.isolated_at),
        }
    return out


def build_state(ctx: Context):
    m, iso = ctx.minute, ctx.isolated_at
    hour = m // 60
    sens = sensor_states(ctx)
    fb = sensors.sector4_flow_balance(m, iso)
    leak = ctx.leak_now()
    bloom = sens["CHL-01"]["status"] == "warning"
    flat = sensors.flatline_check("P-S4B", m, iso)["flatline"]
    level = storage_pct(m, iso)
    is_peak = C.PEAK_START_H <= hour < C.PEAK_END_H
    prod_sec = C.specific_energy_kwh_m3(C.NOMINAL_PRODUCTION_M3H)
    power_kw = C.NOMINAL_PRODUCTION_M3H * prod_sec

    alerts = []
    if is_peak:
        alerts.append({"id": "tariff", "severity": "warning", "title": "Peak electricity tariff active",
                       "detail": f"Tariff rose from ${C.OFF_PEAK_TARIFF:.2f} to ${C.PEAK_TARIFF:.2f}/kWh at {C.PEAK_START_H}:00. "
                                 f"At 600 m³/h the plant draws ~{power_kw:,.0f} kW.",
                       "assets": ["HPP-01", "RO-01", "RO-02"], "raised_at": f"{C.PEAK_START_H:02d}:00"})
    if fb["imbalance"]:
        alerts.append({"id": "leak", "severity": "critical", "title": "Sector 4 flow imbalance",
                       "detail": f"{fb['unexplained_m3h']:.0f} m³/h enters Sector 4 that metered demand does not explain.",
                       "assets": ["SEC-04", "BR-4H", "FM-S4", "P-S4A"], "raised_at": "14:03"})
    if flat and "P-S4B" not in ctx.quarantined:
        alerts.append({"id": "flatline", "severity": "warning", "title": "P-S4B flatline detected",
                       "detail": "Pressure transducer has reported exactly 3.80 bar since 13:53.",
                       "assets": ["P-S4B"], "raised_at": "14:08"})
    if "P-S4B" in ctx.quarantined:
        alerts.append({"id": "quarantine", "severity": "info", "title": "P-S4B quarantined",
                       "detail": "Excluded from decisions until a field technician verifies the transducer.",
                       "assets": ["P-S4B"], "raised_at": signals.fmt(SCENE_INDEX[4]["minute"])})
    if bloom:
        alerts.append({"id": "bloom", "severity": "warning", "title": "Algal-bloom warning at intake",
                       "detail": "Chlorophyll-a and turbidity rising at INT-01. Water-quality assessment required.",
                       "assets": ["INT-01", "CHL-01", "TURB-01", "SDI-01"], "raised_at": "14:11"})
    if iso is not None:
        alerts.append({"id": "isolation", "severity": "info", "title": "Harbour branch isolated (simulated)",
                       "detail": "V-04B closed after operator approval. 140 connections on planned interruption.",
                       "assets": ["V-04B", "BR-4H"], "raised_at": signals.fmt(iso)})

    status = {a: "normal" for a in network.ASSET_INDEX}
    if is_peak:
        status.update({"HPP-01": "watch"})
    if fb["imbalance"]:
        status.update({"SEC-04": "critical", "BR-4H": "critical", "FM-S4": "critical", "P-S4A": "critical"})
    if bloom:
        status.update({"INT-01": "warning", "CHL-01": "warning", "TURB-01": "warning", "SDI-01": "watch", "PT-01": "watch"})
    if flat:
        status["P-S4B"] = "fault"
    if "P-S4B" in ctx.quarantined:
        status["P-S4B"] = "quarantined"
    for v, pos in ctx.positions.items():
        if pos == "closed":
            status[v] = "closed"
    for node in network.isolation_impact(ctx.closed_valves)["isolated_nodes"]:
        status[node] = "isolated"

    flows = []
    for a, b, f in network.EDGES:
        q = float(f)
        if b in ("V-04A", "SEC-04", "V-04B", "BR-4H") or a in ("V-04A", "SEC-04", "V-04B"):
            q += leak
        if a.startswith("RES-"):
            q += leak / 3
        if iso is not None and b in ("V-04B", "BR-4H"):
            q = 0.0
        if iso is not None and (b in ("V-04A", "SEC-04")):
            q -= 12
        flows.append({"from": a, "to": b, "m3h": round(q, 1)})

    evidence = None
    if fb["imbalance"] or iso is not None:
        evidence = {
            "flow_balance": fb,
            "pressure": {"P-S4A": sens["P-S4A"]["value"], "P-S4B": sens["P-S4B"]["value"], "P-S3": sens["P-S3"]["value"],
                         "baseline_bar": 3.80},
            "lines_of_evidence": [
                f"Flow balance: {fb['inflow_m3h']:.0f} m³/h entering vs {fb['expected_demand_m3h']} m³/h expected demand.",
                f"Pressure A at the Sector 4 junction fell to {sens['P-S4A']['value']} bar while Sector 3 held "
                f"{sens['P-S3']['value']} bar — the drop is local, not network-wide.",
                "Pressure B still reads 3.80 bar and contradicts the other evidence (examined in the next step).",
            ],
            "caveat": "Pressure alone does not prove a leak: demand surges, valve operations and faulty transducers "
                      "also lower readings. The case rests on flow balance and localisation agreeing.",
            "most_likely_location": "Harbour branch, downstream of V-04B (simulated injected break)",
        }

    scene_extras = {}
    if ctx.scene["id"] >= 6:
        scene_extras["proposal"] = {
            "proposed_by": "Tariff optimiser (AI agent)",
            "plan_id": "peak_throttle",
            "text": "Reduce desalination to the 100 m³/h minimum for the full 14:00–20:00 peak to avoid the $0.32/kWh tariff.",
        }
    if ctx.scene["id"] >= 7 and iso is None:
        scene_extras["staged_suggestion"] = {
            "proposed_by": "Incident assistant (AI agent)",
            "valve_id": "V-04B", "action": "close",
            "text": "Close V-04B to isolate the Harbour branch and stop the modelled 65 m³/h loss while repairs are arranged.",
        }

    return {
        "engine": C.ENGINE_VERSION,
        "authority": "python-backend",
        "scene": {**ctx.scene, "clock": signals.fmt(m)},
        "scenes": [{"id": s["id"], "title": s["title"], "clock": signals.fmt(s["minute"])} for s in SCENES],
        "tariff": {
            "current_usd_kwh": C.tariff_at(hour), "is_peak": is_peak,
            "peak_usd_kwh": C.PEAK_TARIFF, "off_peak_usd_kwh": C.OFF_PEAK_TARIFF,
            "peak_window": [f"{C.PEAK_START_H:02d}:00", f"{C.PEAK_END_H:02d}:00"],
            "schedule": [{"hour": f"{h:02d}:00", "usd_kwh": C.tariff_at(h)} for h in range(24)],
        },
        "production": {
            "m3h": C.NOMINAL_PRODUCTION_M3H, "feed_m3h": round(C.NOMINAL_PRODUCTION_M3H / C.RECOVERY),
            "sec_kwh_m3": round(prod_sec, 2), "power_kw": round(power_kw),
            "cost_per_hour_usd": round(power_kw * C.tariff_at(hour)),
        },
        "demand_m3h": C.DEMAND_M3H - (12 if iso is not None else 0),
        "leak": {"active": leak > 0.5, "modelled_loss_m3h": round(leak, 1), "isolated": iso is not None,
                 "location": "BR-4H" if (leak > 0.5 or iso is not None) else None},
        "storage": {
            "pct": round(level, 2), "volume_m3": round(level / 100 * C.CAPACITY_M3), "capacity_m3": C.CAPACITY_M3,
            "floor_pct": C.SAFETY_FLOOR_PCT,
            "tanks": [{"id": k, "name": v["name"], "capacity_m3": v["capacity_m3"], "pct": round(level, 2)}
                      for k, v in C.RESERVOIRS.items()],
        },
        "sensors": sens,
        "asset_status": status,
        "valves": {v: {"position": p} for v, p in ctx.positions.items()},
        "flows": flows,
        "alerts": alerts,
        "evidence": evidence,
        "quality_review_open": bloom,
        "quarantined": ctx.quarantined,
        "ignored_records": ctx.rejected_records,
        **scene_extras,
    }
