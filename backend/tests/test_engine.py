import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from aquagrid import config as C  # noqa: E402
from aquagrid import control, planning, scenario, security, sensors  # noqa: E402
from aquagrid.api import handle  # noqa: E402


def call(method, path, body=None):
    status, payload = handle(method, path, json.dumps(body or {}).encode())
    return status, payload


class ReserveModel(unittest.TestCase):
    def test_hourly_balance_matches_documented_formula(self):
        levels, rows = planning.project([600] * 10, 62.0, 65.0)
        self.assertAlmostEqual(levels[1], 62.0 + (600 - 550 - 65) / 100, places=6)
        self.assertAlmostEqual(levels[-1], 62.0 - 0.15 * 10, places=6)

    def test_specific_energy_calibrated_to_nominal(self):
        self.assertAlmostEqual(C.specific_energy_kwh_m3(600), 3.5, places=2)
        self.assertGreater(C.specific_energy_kwh_m3(100), C.specific_energy_kwh_m3(600))

    def test_peak_throttle_breaches_floor_and_is_rejected(self):
        r = planning.evaluate(planning.plan_production("peak_throttle"), start_pct=62.0, loss_m3h=65.0,
                              quality_review_open=False, plan_id="peak_throttle")
        self.assertEqual(r["verdict"], "REJECTED")
        self.assertEqual(r["headline"], "SAFETY CONSTRAINT VIOLATED")
        self.assertLess(r["min_level_pct"], C.SAFETY_FLOOR_PCT)
        self.assertAlmostEqual(r["min_level_pct"], 30.5, places=1)  # 62 - 6h*5.15 - 4h*0.15

    def test_baseline_passes(self):
        r = planning.evaluate(planning.plan_production("baseline"), start_pct=62.0, loss_m3h=65.0,
                              quality_review_open=False)
        self.assertEqual(r["verdict"], "ACCEPTED")

    def test_quality_review_holds_production_change(self):
        r = planning.evaluate(planning.plan_production("shift"), start_pct=62.0, loss_m3h=65.0,
                              quality_review_open=True)
        self.assertEqual(r["verdict"], "HOLD")

    def test_safe_alternative_keeps_margin(self):
        alt = planning.safe_alternative(start_pct=62.0, loss_m3h=65.0)
        r = planning.evaluate(alt["production_m3h"], start_pct=62.0, loss_m3h=65.0, quality_review_open=False)
        self.assertGreaterEqual(r["min_level_pct"], 37.0)
        self.assertLess(alt["peak_production_m3h"], 600)


class Diagnostics(unittest.TestCase):
    def test_flatline_detected_only_from_scene_4(self):
        self.assertFalse(sensors.flatline_check("P-S4B", scenario.SCENE_INDEX[3]["minute"])["flatline"])
        self.assertTrue(sensors.flatline_check("P-S4B", scenario.SCENE_INDEX[4]["minute"])["flatline"])

    def test_cross_check_marks_p_s4b_unreliable(self):
        a = sensors.analyze("P-S4B", scenario.SCENE_INDEX[4]["minute"])
        self.assertEqual(a["verdict"], "UNRELIABLE")
        self.assertTrue(a["quarantine_recommended"])

    def test_healthy_sensor_cannot_be_quarantined(self):
        status, body = call("POST", "/api/sensors/quarantine", {"scene": 4, "sensor_id": "P-S4A"})
        self.assertEqual(status, 409)

    def test_bloom_warning_raised_at_scene_5_not_before(self):
        s4 = scenario.build_state(scenario.Context(4))
        s5 = scenario.build_state(scenario.Context(5))
        self.assertFalse(s4["quality_review_open"])
        self.assertTrue(s5["quality_review_open"])

    def test_leak_evidence_is_not_pressure_alone(self):
        s = scenario.build_state(scenario.Context(3))
        self.assertTrue(s["leak"]["active"])
        self.assertIn("Pressure alone does not prove a leak", s["evidence"]["caveat"])


class HumanControl(unittest.TestCase):
    def setUp(self):
        self.ctx = scenario.Context(7)

    def test_closing_sector_inlet_is_rejected(self):
        r = control.stage("V-04A", "close", self.ctx)
        self.assertEqual(r["evaluation"]["verdict"], "REJECTED")
        self.assertIsNone(r["proposal"])

    def test_isolation_requires_operator_approval(self):
        staged = control.stage("V-04B", "close", self.ctx)
        self.assertEqual(staged["evaluation"]["verdict"], "AWAITING_APPROVAL")
        analyst = security.login("AN-02", "1357")["token"]
        with self.assertRaises(security.AuthError) as err:
            control.approve(staged["proposal"], staged["signature"], analyst, self.ctx)
        self.assertEqual(err.exception.status, 403)
        operator = security.login("CR-07", "2468")["token"]
        result = control.approve(staged["proposal"], staged["signature"], operator, self.ctx)
        self.assertEqual(result["record"]["position"], "closed")
        after = scenario.Context(7, [], [{"record": result["record"], "signature": result["signature"]}])
        state = scenario.build_state(after)
        self.assertFalse(state["leak"]["active"])
        self.assertEqual(state["valves"]["V-04B"]["position"], "closed")

    def test_tampered_proposal_rejected(self):
        staged = control.stage("V-04B", "close", self.ctx)
        staged["proposal"]["valve_id"] = "V-04A"
        token = security.login("CR-07", "2468")["token"]
        with self.assertRaises(control.ControlError):
            control.approve(staged["proposal"], staged["signature"], token, self.ctx)

    def test_forged_valve_record_ignored(self):
        forged = {"record": {"valve_id": "V-04B", "position": "closed", "applied_minute": 860}, "signature": "00"}
        ctx = scenario.Context(7, [], [forged])
        self.assertEqual(ctx.positions["V-04B"], "open")
        self.assertTrue(ctx.rejected_records)

    def test_wrong_pin(self):
        status, _ = call("POST", "/api/auth/login", {"operator_id": "CR-07", "pin": "0000"})
        self.assertEqual(status, 401)


class Api(unittest.TestCase):
    def test_all_scenes_build(self):
        for i in range(1, 8):
            status, body = call("POST", "/api/state", {"scene": i})
            self.assertEqual(status, 200, body)
            self.assertEqual(body["authority"], "python-backend")

    def test_evaluate_endpoint(self):
        status, body = call("POST", "/api/plans/evaluate", {"scene": 6, "plans": ["baseline", "peak_throttle"]})
        self.assertEqual(status, 200)
        self.assertEqual(body["results"][0]["verdict"], "ACCEPTED")
        self.assertEqual(body["results"][1]["verdict"], "REJECTED")

    def test_desal(self):
        status, body = call("GET", "/api/desal?production=400")
        self.assertEqual(status, 200)
        self.assertEqual(len(body["stages"]), 6)

    def test_unknown_route(self):
        self.assertEqual(call("GET", "/api/nope")[0], 404)


if __name__ == "__main__":
    unittest.main()
