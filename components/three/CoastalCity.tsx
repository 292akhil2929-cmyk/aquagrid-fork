"use client";

import { useMemo } from "react";
import { ASSET_POS, BRANCH_RECT, PIPE_DEPTH } from "@/lib/world";
import { Asset } from "./Asset";
import { DesalinationPlant } from "./DesalinationPlant";
import { DistributionSector, Hospital } from "./DistributionSector";
import { Ground, LayerGroup, LayerPlate, Risers, Sea } from "./ExplodedLayers";
import { IsolationValve } from "./IsolationValve";
import { LeakEffect } from "./LeakEffect";
import { PipelineNetwork } from "./PipelineNetwork";
import { ReservoirSystem } from "./ReservoirSystem";
import { SensorNode } from "./SensorNode";
import { COLORS, std, useTwin } from "./twin";

function IntakeWorks() {
  const mats = useMemo(() => ({
    cap: std("#b8c3d4", { roughness: 0.6 }),
    house: std("#e3e9f2", { roughness: 0.8 }),
    roof: std("#9aa9c0"),
    screen: std(COLORS.steelDark, { metalness: 0.5 }),
  }), []);
  return (
    <group>
      <Asset id="INT-01" position={ASSET_POS["INT-01"].p} ring={2} labelY={3.4}>
        <mesh material={mats.cap} position={[0, 0.3, 0]}><cylinderGeometry args={[0.9, 1.1, 0.6, 24]} /></mesh>
        <mesh material={mats.cap} position={[0, 0.9, 0]}><cylinderGeometry args={[0.35, 0.35, 0.9, 16]} /></mesh>
        <mesh material={mats.cap} position={[0, 1.45, 0]}><cylinderGeometry args={[1.7, 1.7, 0.18, 32]} /></mesh>
      </Asset>
      <Asset id="IPS-01" position={ASSET_POS["IPS-01"].p} ring={3} labelY={4.4}>
        <mesh material={mats.house} position={[0, 1.3, 0]}><boxGeometry args={[4, 2.6, 3.4]} /></mesh>
        <mesh material={mats.roof} position={[0, 2.65, 0]}><boxGeometry args={[4.2, 0.12, 3.6]} /></mesh>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} material={mats.screen} position={[-2.2, 0.9, i * 0.95]}><boxGeometry args={[0.12, 1.8, 0.8]} /></mesh>
        ))}
      </Asset>
      <SensorNode id="CHL-01" position={[ASSET_POS["CHL-01"].p[0], -0.25, ASSET_POS["CHL-01"].p[2]]} buoy />
      <SensorNode id="TURB-01" position={ASSET_POS["TURB-01"].p} />
    </group>
  );
}

function PumpingStation() {
  const mats = useMemo(() => ({ hall: std("#e6ecf4"), roof: std("#9aa9c0"), surge: std("#d5dce7", { metalness: 0.3 }) }), []);
  return (
    <Asset id="PS-01" position={ASSET_POS["PS-01"].p} ring={3} labelY={4.2}>
      <mesh material={mats.hall} position={[0, 1.2, 0]}><boxGeometry args={[3.6, 2.4, 3]} /></mesh>
      <mesh material={mats.roof} position={[0, 2.45, 0]}><boxGeometry args={[3.8, 0.12, 3.2]} /></mesh>
      <mesh material={mats.surge} position={[2.6, 1.3, -0.9]}><cylinderGeometry args={[0.5, 0.5, 2.6, 18]} /></mesh>
    </Asset>
  );
}

function HarbourBranch() {
  const { state } = useTwin();
  const st = state?.asset_status["BR-4H"];
  const mat = useMemo(() => std(COLORS.red, { opacity: 0.0 }), []);
  mat.color.set(st === "isolated" ? COLORS.grey : COLORS.red);
  mat.userData.baseOpacity = st === "critical" ? 0.22 : st === "isolated" ? 0.3 : 0.0;
  mat.opacity = mat.userData.baseOpacity;
  const [x0, x1, z0, z1] = BRANCH_RECT;
  const c = ASSET_POS["BR-4H"].p;
  return (
    <Asset id="BR-4H" position={c} ring={2.2} labelY={3}>
      <mesh material={mat} position={[(x0 + x1) / 2 - c[0], 0.05, (z0 + z1) / 2 - c[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[x1 - x0, z1 - z0]} />
      </mesh>
    </Asset>
  );
}

/** The whole digital twin, organised as five explodable layers. */
export function CoastalCity() {
  const { lockedValve } = useTwin();
  const p = (id: string) => ASSET_POS[id].p;
  return (
    <group>
      <LayerGroup layer={1}>
        <Ground />
        {["SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05"].map((id) => <DistributionSector key={id} id={id} />)}
        <Hospital />
        <HarbourBranch />
      </LayerGroup>
      <LayerGroup layer={2}>
        <PumpingStation />
        <PipelineNetwork layer={2} />
        <IsolationValve id="V-04A" position={p("V-04A")} locked={lockedValve === "V-04A"} />
        <IsolationValve id="V-04B" position={p("V-04B")} locked={lockedValve === "V-04B"} />
        <SensorNode id="FM-PS" position={p("FM-PS")} buried />
        <SensorNode id="FM-S4" position={p("FM-S4")} buried />
        <SensorNode id="P-S3" position={p("P-S3")} buried />
        <SensorNode id="P-S4A" position={p("P-S4A")} buried />
        <SensorNode id="P-S4B" position={p("P-S4B")} buried />
        <LeakEffect />
      </LayerGroup>
      <LayerGroup layer={3}>
        <ReservoirSystem />
        <PipelineNetwork layer={3} />
      </LayerGroup>
      <LayerGroup layer={4}>
        <DesalinationPlant />
        <PipelineNetwork layer={4} />
      </LayerGroup>
      <LayerGroup layer={5}>
        <Sea />
        <IntakeWorks />
        <PipelineNetwork layer={5} />
      </LayerGroup>
      {[2, 3, 4, 5].map((l) => <LayerPlate key={l} layer={l} />)}
      <LayerPlate layer={1} />
      <Risers />
    </group>
  );
}

export { PIPE_DEPTH };
