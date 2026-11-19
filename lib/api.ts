// Typed client for the Python simulation engine. The backend is the only source
// of operational values; the frontend never computes or invents them.

export type Status =
  | "normal" | "watch" | "warning" | "critical" | "alarm" | "fault"
  | "flatline" | "quarantined" | "closed" | "isolated";

export interface SeriesPoint { t: string; v: number }

export interface SensorState {
  id: string; label: string; unit: string; value: number; status: Status;
  thresholds: { low_alarm?: number; warning?: number; limit?: number };
  attached_to: string | null; series: SeriesPoint[];
}

export interface Alert {
  id: string; severity: "info" | "warning" | "critical"; title: string; detail: string;
  assets: string[]; raised_at: string;
}

export interface ValveRecord {
  record: {
    valve_id: string; position: "open" | "closed"; applied_minute: number; proposal_id: string;
    approved_by: string; approver_name: string; approved_at: number; simulated: true;
  };
  signature: string;
}

export interface SimState {
  engine: string; authority: "python-backend";
  scene: { id: number; key: string; title: string; minute: number; clock: string };
  scenes: { id: number; title: string; clock: string }[];
  tariff: {
    current_usd_kwh: number; is_peak: boolean; peak_usd_kwh: number; off_peak_usd_kwh: number;
    peak_window: [string, string]; schedule: { hour: string; usd_kwh: number }[];
  };
  production: { m3h: number; feed_m3h: number; sec_kwh_m3: number; power_kw: number; cost_per_hour_usd: number };
  demand_m3h: number;
  leak: { active: boolean; modelled_loss_m3h: number; isolated: boolean; location: string | null };
  storage: {
    pct: number; volume_m3: number; capacity_m3: number; floor_pct: number;
    tanks: { id: string; name: string; capacity_m3: number; pct: number }[];
  };
  sensors: Record<string, SensorState>;
  asset_status: Record<string, Status>;
  valves: Record<string, { position: "open" | "closed" }>;
  flows: { from: string; to: string; m3h: number }[];
  alerts: Alert[];
  evidence: null | {
    flow_balance: { inflow_m3h: number; expected_demand_m3h: number; unexplained_m3h: number; imbalance: boolean };
    pressure: Record<string, number>;
    lines_of_evidence: string[]; caveat: string; most_likely_location: string;
  };
  quality_review_open: boolean;
  quarantined: string[];
  ignored_records: string[];
  proposal?: { proposed_by: string; plan_id: string; text: string };
  staged_suggestion?: { proposed_by: string; valve_id: string; action: "close" | "open"; text: string };
}

export interface Check {
  id: string; label: string; severity?: "hard" | "advisory"; passed?: boolean;
  detail?: string; result?: string; fault_indicated?: boolean;
}

export interface SensorAnalysis {
  sensor_id: string; clock: string; value: number; unit: string; checks: Check[];
  verdict: "UNRELIABLE" | "SUSPECT" | "PLAUSIBLE"; quarantine_recommended: boolean; summary: string; note: string;
}

export interface PlanRow {
  hour: string; production_m3h: number; demand_m3h: number; loss_m3h: number; net_m3h: number;
  tariff_usd_kwh: number; energy_kwh: number; cost_usd: number; level_end_pct: number;
}

export interface PlanResult {
  plan_id: string; plan_name: string; hours: string[]; production_m3h: number[]; levels_pct: number[];
  rows: PlanRow[]; min_level_pct: number; min_level_at: string; end_level_pct: number; breach_at: string | null;
  floor_pct: number; energy_kwh: number; peak_energy_kwh: number; cost_usd: number; constraints: Check[];
  verdict: "ACCEPTED" | "HOLD" | "REJECTED"; headline: string; savings_vs_baseline_usd?: number;
}

export interface Evaluation {
  authority: string; engine: string;
  assumptions: {
    capacity_m3: number; start_pct: number; demand_m3h: number; modelled_loss_m3h: number; floor_pct: number;
    peak_window: string; tariffs_usd_kwh: { peak: number; off_peak: number };
  };
  baseline: PlanResult; results: PlanResult[];
  safe_alternative: null | { peak_production_m3h: number; production_m3h: number[]; margin_pct: number; evaluation: PlanResult };
}

export interface DesalModel {
  stages: {
    id: string; asset: string; name: string; role: string; energy_share: number;
    parameters: { label: string; value: string }[];
  }[];
  operating_point: {
    production_m3h: number; feed_m3h: number; brine_m3h: number; sec_kwh_m3: number; power_kw: number;
    cost_per_hour_peak_usd: number; cost_per_hour_offpeak_usd: number; stage_power_kw: Record<string, number>;
  };
  curve: { production_m3h: number; power_kw: number; sec_kwh_m3: number }[];
  limits: { min_m3h: number; max_m3h: number; nominal_m3h: number };
  tariffs: { peak: number; off_peak: number; peak_window: string };
  note: string;
}

export interface ValveEvaluation {
  valve_id: string; action: "close" | "open"; current_position: string; target_position: string;
  checks: Check[]; verdict: "AWAITING_APPROVAL" | "REJECTED"; headline: string;
  impact: {
    isolated_nodes: string[]; connections_without_supply: number; critical_facilities_without_supply: string[];
    leak_after_m3h: number; sector4_pressure_after_bar: number | null; min_storage_pct: number;
  };
  evaluated_at: string;
}

export interface Proposal {
  id: string; valve_id: string; action: string; target_position: string; proposed_by: string;
  staged_at: number; expires_at: number; context_digest: string; scene: number;
}

export interface StageResult { evaluation: ValveEvaluation; proposal: Proposal | null; signature: string | null }

export interface Operator { sub: string; name: string; role: string; exp: number }

export interface Topology {
  layers: { layer: number; key: string; name: string }[];
  assets: { id: string; name: string; type: string; layer: number; [k: string]: unknown }[];
  edges: { from: string; to: string; nominal_m3h: number }[];
  sensor_attachment: Record<string, string>;
  controllable_valves: string[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) {
    super(message);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "The simulation engine can't be reached.");
  }
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON proxy error */ }
  if (!res.ok) {
    const message = typeof data.error === "string" ? data.error
      : res.status >= 500 ? "The simulation engine can't be reached." : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

export interface Ctx { scene: number; quarantined: string[]; valve_records: ValveRecord[] }

export const api = {
  health: () => request<{ ok: boolean; engine: string; signing_key: string }>("/api/health"),
  network: () => request<Topology>("/api/network"),
  state: (ctx: Ctx) => request<SimState>("/api/state", ctx),
  analyze: (ctx: Ctx, sensor_id: string) => request<SensorAnalysis>("/api/sensors/analyze", { ...ctx, sensor_id }),
  quarantine: (ctx: Ctx, sensor_id: string) =>
    request<{ quarantined: string[]; analysis: SensorAnalysis; state: SimState }>("/api/sensors/quarantine", { ...ctx, sensor_id }),
  evaluate: (ctx: Ctx, plans: (string | { production_m3h: number[] })[]) =>
    request<Evaluation>("/api/plans/evaluate", { ...ctx, plans }),
  desal: (production: number) => request<DesalModel>(`/api/desal?production=${encodeURIComponent(production)}`),
  login: (operator_id: string, pin: string) =>
    request<{ token: string; operator: Operator }>("/api/auth/login", { operator_id, pin }),
  stage: (ctx: Ctx, valve_id: string, action: "close" | "open", proposed_by: string) =>
    request<StageResult>("/api/valves/stage", { ...ctx, valve_id, action, proposed_by }),
  approve: (ctx: Ctx, proposal: Proposal, signature: string, token: string) =>
    request<{ record: ValveRecord["record"]; signature: string; evaluation: ValveEvaluation; operator: Operator; state: SimState }>(
      "/api/valves/approve", { ...ctx, proposal, signature, token }),
};
