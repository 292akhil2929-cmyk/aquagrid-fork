"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type Ctx, type Operator, type SimState, type ValveRecord } from "@/lib/api";

export interface ActivityEntry { clock: string; title: string; detail: string; kind: "info" | "decision" | "rejection" | "approval" }

interface ScenarioValue {
  scene: number;
  setScene: (n: number) => void;
  state: SimState | null;
  loading: boolean;
  offline: string | null;
  ctx: Ctx;
  quarantined: string[];
  valveRecords: ValveRecord[];
  applyState: (s: SimState) => void;
  setQuarantined: (q: string[]) => void;
  addValveRecord: (r: ValveRecord) => void;
  session: { token: string; operator: Operator } | null;
  setSession: (s: { token: string; operator: Operator } | null) => void;
  activity: ActivityEntry[];
  log: (e: Omit<ActivityEntry, "clock">) => void;
  reset: () => void;
  retry: () => void;
}

const ScenarioContext = createContext<ScenarioValue | null>(null);

export function ScenarioController({ children }: { children: ReactNode }) {
  const [scene, setSceneRaw] = useState(1);
  const [quarantined, setQuarantined] = useState<string[]>([]);
  const [valveRecords, setValveRecords] = useState<ValveRecord[]>([]);
  const [state, setState] = useState<SimState | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState<string | null>(null);
  const [session, setSession] = useState<{ token: string; operator: Operator } | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [nonce, setNonce] = useState(0);
  const clockRef = useRef("13:00");

  // Decisions belong to the point in the story where they were taken: a sensor
  // quarantined at 14:09 doesn't exist when you scroll back to 13:00.
  const ctx = useMemo<Ctx>(
    () => ({ scene, quarantined: scene >= 4 ? quarantined : [], valve_records: valveRecords }),
    [scene, quarantined, valveRecords],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.state(ctx)
      .then((s) => { if (!cancelled) { setState(s); setOffline(null); clockRef.current = s.scene.clock; } })
      .catch((e: unknown) => { if (!cancelled) setOffline(e instanceof ApiError ? e.message : "The simulation engine can't be reached."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctx, nonce]);

  const log = useCallback((e: Omit<ActivityEntry, "clock">) => {
    setActivity((a) => [{ ...e, clock: clockRef.current }, ...a].slice(0, 60));
  }, []);

  const setScene = useCallback((n: number) => setSceneRaw(Math.min(7, Math.max(1, n))), []);
  const applyState = useCallback((s: SimState) => { setState(s); clockRef.current = s.scene.clock; }, []);
  const addValveRecord = useCallback((r: ValveRecord) => setValveRecords((v) => [...v.filter((x) => x.record.valve_id !== r.record.valve_id), r]), []);
  const reset = useCallback(() => {
    setQuarantined([]); setValveRecords([]); setSceneRaw(1); setActivity([]);
  }, []);
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const value: ScenarioValue = {
    scene, setScene, state, loading, offline, ctx, quarantined, valveRecords, applyState,
    setQuarantined, addValveRecord, session, setSession, activity, log, reset, retry,
  };
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario() {
  const v = useContext(ScenarioContext);
  if (!v) throw new Error("useScenario must be used inside <ScenarioController>");
  return v;
}
