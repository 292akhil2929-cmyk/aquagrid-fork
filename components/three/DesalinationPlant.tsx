"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSET_POS } from "@/lib/world";
import { Asset } from "./Asset";
import { SensorNode } from "./SensorNode";
import { COLORS, std } from "./twin";

const tmp = new THREE.Object3D();

/** A rack of horizontal membrane pressure vessels (instanced). */
export function MembraneRack({ cols = 6, rows = 4, length = 4.6 }: { cols?: number; rows?: number; length?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const mats = useMemo(() => ({
    vessel: std("#eef2f7", { roughness: 0.35, metalness: 0.05 }),
    cap: std(COLORS.blueDeep, { roughness: 0.4 }),
    frame: std(COLORS.steelDark, { metalness: 0.5, roughness: 0.5 }),
  }), []);
  const count = cols * rows;
  useLayoutEffect(() => {
    let i = 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      tmp.position.set(0, 0.55 + r * 0.62, (c - (cols - 1) / 2) * 0.62);
      tmp.rotation.set(0, 0, Math.PI / 2);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      ref.current?.setMatrixAt(i, tmp.matrix);
      tmp.scale.set(1, 1.04, 1);
      tmp.updateMatrix();
      caps.current?.setMatrixAt(i, tmp.matrix);
      i++;
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (caps.current) caps.current.instanceMatrix.needsUpdate = true;
  }, [cols, rows]);
  const h = 0.55 + rows * 0.62;
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} material={mats.vessel}>
        <cylinderGeometry args={[0.24, 0.24, length, 14]} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, count]} material={mats.cap}>
        <cylinderGeometry args={[0.26, 0.26, length * 0.08, 14]} />
      </instancedMesh>
      {[-length / 2 + 0.3, length / 2 - 0.3].map((x) => (
        <mesh key={x} material={mats.frame} position={[x, h / 2, 0]}><boxGeometry args={[0.12, h, cols * 0.62 + 0.2]} /></mesh>
      ))}
    </group>
  );
}

export function PumpSkid({ count = 3 }: { count?: number }) {
  const mats = useMemo(() => ({
    base: std(COLORS.steelDark), motor: std("#2f5fa8", { metalness: 0.35, roughness: 0.45 }), pump: std(COLORS.steel, { metalness: 0.5, roughness: 0.35 }),
  }), []);
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[0, 0, (i - (count - 1) / 2) * 1.3]}>
          <mesh material={mats.base} position={[0, 0.12, 0]}><boxGeometry args={[2.6, 0.24, 1]} /></mesh>
          <mesh material={mats.motor} position={[-0.5, 0.65, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.36, 0.36, 1.2, 18]} /></mesh>
          <mesh material={mats.pump} position={[0.7, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.42, 0.8, 18]} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function FilterBank() {
  const mats = useMemo(() => ({
    daf: std(COLORS.concrete), water: std("#6aa0c8", { roughness: 0.15, opacity: 0.9 }), tank: std("#dfe5ee", { roughness: 0.45, metalness: 0.1 }),
  }), []);
  return (
    <group>
      <mesh material={mats.daf} position={[-1.2, 0.6, -3]}><boxGeometry args={[3.2, 1.2, 4.6]} /></mesh>
      <mesh material={mats.water} position={[-1.2, 1.21, -3]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.9, 4.3]} /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={mats.tank} position={[i % 2 === 0 ? -2 : -0.3, 1.2, 1 + Math.floor(i / 2) * 2.4]}><cylinderGeometry args={[0.75, 0.75, 2.4, 24]} /></mesh>
      ))}
      <mesh material={mats.tank} position={[1.6, 0.9, 3.8]}><cylinderGeometry args={[0.45, 0.45, 1.8, 18]} /></mesh>
    </group>
  );
}

export function EnergyRecovery() {
  const m = useMemo(() => std("#d7dde8", { metalness: 0.55, roughness: 0.3 }), []);
  const band = useMemo(() => std(COLORS.yellow, { roughness: 0.5 }), []);
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[0, 0.4 + (i % 2) * 0.55, (Math.floor(i / 2) - 0.5) * 0.7]}>
          <mesh material={m} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.24, 0.24, 1.8, 16]} /></mesh>
          <mesh material={band} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.25, 0.25, 0.12, 16]} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function ProductTank() {
  const m = useMemo(() => std("#e8eef6", { roughness: 0.5 }), []);
  return <mesh material={m} position={[0, 1.2, 0]}><cylinderGeometry args={[1.1, 1.1, 2.4, 28]} /></mesh>;
}

/** The RO plant as it sits in the city twin (layer 4). */
export function DesalinationPlant() {
  const mats = useMemo(() => ({
    pad: std("#8796b0", { roughness: 0.95 }),
    canopy: std("#dce6f2", { opacity: 0.18, side: THREE.DoubleSide }),
    column: std(COLORS.steelDark),
  }), []);
  const p = (id: string) => ASSET_POS[id].p;
  return (
    <group>
      <mesh material={mats.pad} position={[-14.5, 0.04, 3]}><boxGeometry args={[19, 0.08, 19]} /></mesh>
      <Asset id="PT-01" position={p("PT-01")} ring={3.6} labelY={4}><FilterBank /></Asset>
      <Asset id="HPP-01" position={p("HPP-01")} ring={2.4} labelY={3}><PumpSkid /></Asset>
      <Asset id="RO-01" position={p("RO-01")} ring={2.8} labelY={4.4}><MembraneRack /></Asset>
      <Asset id="RO-02" position={p("RO-02")} ring={2.8} labelY={4.4}><MembraneRack /></Asset>
      <Asset id="ERD-01" position={p("ERD-01")} ring={1.6} labelY={2.6}><EnergyRecovery /></Asset>
      {/* Open-sided process hall over the membrane trains */}
      <mesh material={mats.canopy} position={[-10.5, 3.6, 1.25]}><boxGeometry args={[6.4, 0.06, 14]} /></mesh>
      {[-13.6, -7.4].flatMap((x) => [-5.6, 1.25, 8.1].map((z) => (
        <mesh key={`${x}${z}`} material={mats.column} position={[x, 1.8, z]}><boxGeometry args={[0.14, 3.6, 0.14]} /></mesh>
      )))}
      <group position={[-6.5, 0, 9]}><ProductTank /></group>
      <SensorNode id="SDI-01" position={p("SDI-01")} />
      <SensorNode id="COND-01" position={p("COND-01")} />
    </group>
  );
}
