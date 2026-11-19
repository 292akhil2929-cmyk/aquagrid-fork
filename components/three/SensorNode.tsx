"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Vec3 } from "@/lib/world";
import { Asset } from "./Asset";
import { COLORS, statusColor, std, useStatus, useTwin } from "./twin";

/** Field instrument: a mast with a sensing head. Buried sensors sit in a chamber. */
export function SensorNode({ id, position, buried = false, buoy = false }: { id: string; position: Vec3; buried?: boolean; buoy?: boolean }) {
  const status = useStatus(id);
  const { reducedMotion } = useTwin();
  const head = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => ({
    mast: std(COLORS.steelDark),
    chamber: std(COLORS.concrete, { opacity: 0.9 }),
    head: std(COLORS.blue, { emissive: COLORS.blue, emissiveIntensity: 0.35, roughness: 0.35 }),
    cross: std(COLORS.grey),
  }), []);

  const color = statusColor(status);
  const alarming = status === "alarm" || status === "critical" || status === "warning";
  useFrame(({ clock }) => {
    mats.head.color.set(color);
    mats.head.emissive.set(color);
    mats.head.emissiveIntensity = alarming && !reducedMotion ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4)) : 0.35;
    if (head.current) head.current.scale.setScalar(status === "fault" || status === "flatline" ? 1.15 : 1);
  });

  return (
    <Asset id={id} position={position} ring={0.9} labelY={buried ? 2.4 : 3.2}>
      {buoy ? (
        <>
          <mesh material={mats.mast} position={[0, 0.25, 0]}><cylinderGeometry args={[0.45, 0.6, 0.5, 16]} /></mesh>
          <mesh material={mats.mast} position={[0, 1.1, 0]}><cylinderGeometry args={[0.05, 0.05, 1.4, 6]} /></mesh>
          <mesh ref={head} material={mats.head} position={[0, 1.9, 0]}><sphereGeometry args={[0.32, 18, 12]} /></mesh>
        </>
      ) : buried ? (
        <>
          <mesh material={mats.chamber} position={[0, 0.05, 0]}><boxGeometry args={[0.9, 0.5, 0.9]} /></mesh>
          <mesh material={mats.mast} position={[0, 0.65, 0]}><cylinderGeometry args={[0.05, 0.05, 0.8, 6]} /></mesh>
          <mesh ref={head} material={mats.head} position={[0, 1.15, 0]}><sphereGeometry args={[0.3, 18, 12]} /></mesh>
        </>
      ) : (
        <>
          <mesh material={mats.mast} position={[0, 0.8, 0]}><cylinderGeometry args={[0.06, 0.08, 1.6, 8]} /></mesh>
          <mesh ref={head} material={mats.head} position={[0, 1.75, 0]}><sphereGeometry args={[0.3, 18, 12]} /></mesh>
        </>
      )}
      {status === "quarantined" && (
        <mesh material={mats.cross} position={[0, buried ? 1.15 : 1.75, 0]} rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[0.48, 0.05, 6, 24]} />
        </mesh>
      )}
    </Asset>
  );
}
