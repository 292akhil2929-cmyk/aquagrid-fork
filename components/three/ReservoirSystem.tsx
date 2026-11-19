"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ASSET_POS } from "@/lib/world";
import { Asset } from "./Asset";
import { COLORS, std, useTwin } from "./twin";

const RADII: Record<string, number> = { "RES-01": 3.6, "RES-02": 4.2, "RES-03": 3.6 };
export const TANK_HEIGHT = 5;

interface TankProps {
  radius: number;
  height?: number;
  /** Storage fraction 0..1 to display (backend value). */
  level: number;
  floor?: number;
  reducedMotion?: boolean;
  showFloor?: boolean;
  floorColor?: string;
}

/** Cut-away concrete tank: transparent shell, water body, 35% reserve floor ring. */
export function Tank({ radius, height = TANK_HEIGHT, level, floor = 0.35, reducedMotion, showFloor = true, floorColor = COLORS.red }: TankProps) {
  const water = useRef<THREE.Mesh>(null);
  const surface = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => ({
    shell: std(COLORS.concrete, { opacity: 0.2, side: THREE.DoubleSide, roughness: 0.3 }),
    rim: std(COLORS.concrete, { roughness: 0.6 }),
    base: std("#8fa0b9"),
    water: std(COLORS.blue, { opacity: 0.78, roughness: 0.15, metalness: 0.05, emissive: COLORS.blueDeep, emissiveIntensity: 0.15 }),
    surface: std("#9fcaf2", { opacity: 0.9, roughness: 0.1 }),
    floor: std(floorColor, { emissive: floorColor, emissiveIntensity: 0.5 }),
  }), [floorColor]);

  useFrame((_, dt) => {
    if (!water.current || !surface.current) return;
    const cur = water.current.userData.level ?? level;
    const next = reducedMotion ? level : cur + (level - cur) * Math.min(1, dt * 2.5);
    water.current.userData.level = next;
    const h = Math.max(0.001, next * (height - 0.2));
    water.current.scale.y = h;
    water.current.position.y = 0.1 + h / 2;
    surface.current.position.y = 0.1 + h + 0.005;
  });

  return (
    <group>
      <mesh material={mats.base} position={[0, 0.05, 0]}><cylinderGeometry args={[radius + 0.25, radius + 0.35, 0.1, 48]} /></mesh>
      <mesh material={mats.shell} position={[0, height / 2, 0]}><cylinderGeometry args={[radius, radius, height, 48, 1, true]} /></mesh>
      <mesh material={mats.rim} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, 0.1, 8, 48]} /></mesh>
      <mesh ref={water} material={mats.water}><cylinderGeometry args={[radius - 0.12, radius - 0.12, 1, 48]} /></mesh>
      <mesh ref={surface} material={mats.surface} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[radius - 0.12, 48]} /></mesh>
      {showFloor && (
        <mesh material={mats.floor} position={[0, 0.1 + floor * (height - 0.2), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius + 0.04, 0.06, 6, 64]} />
        </mesh>
      )}
    </group>
  );
}

export function ReservoirSystem() {
  const { state, reducedMotion } = useTwin();
  return (
    <group>
      {(["RES-01", "RES-02", "RES-03"] as const).map((id) => {
        const tank = state?.storage.tanks.find((t) => t.id === id);
        return (
          <Asset key={id} id={id} position={ASSET_POS[id].p} ring={RADII[id] + 0.6} labelY={TANK_HEIGHT + 1.8}>
            <Tank radius={RADII[id]} level={(tank?.pct ?? 0) / 100} floor={(state?.storage.floor_pct ?? 35) / 100} reducedMotion={reducedMotion} />
          </Asset>
        );
      })}
    </group>
  );
}
