"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LEAK_POINT } from "@/lib/world";
import { COLORS, std, useTwin } from "./twin";

const DROPS = 42;
const tmp = new THREE.Object3D();

/**
 * A localised main break: water jets from a crack on the pipe crown, falls back,
 * and saturates the surrounding bedding. The wet-soil plume grows slowly while
 * the leak is active and recedes after isolation. Nothing escapes the trench.
 */
export function LeakEffect() {
  const { state, reducedMotion } = useTwin();
  const active = !!state?.leak.active;
  const plume = useRef<THREE.Mesh>(null);
  const drops = useRef<THREE.InstancedMesh>(null);
  const amount = useRef(0);
  const seeds = useMemo(() => Array.from({ length: DROPS }, (_, i) => ({
    phase: (i * 0.618) % 1,
    angle: (i * 2.399) % (Math.PI * 2),
    speed: 1.6 + ((i * 7) % 10) / 10,
  })), []);
  const mats = useMemo(() => ({
    plume: std("#1f4f8f", { opacity: 0.42, roughness: 0.9, depthWrite: false }),
    drop: std("#9fd0ff", { emissive: COLORS.blue, emissiveIntensity: 0.6, roughness: 0.2 }),
    crack: std(COLORS.red, { emissive: COLORS.red, emissiveIntensity: 0.9 }),
  }), []);

  useFrame(({ clock }, dt) => {
    const target = active ? 1 : 0;
    amount.current += (target - amount.current) * Math.min(1, dt * (active ? 0.5 : 1.2));
    const a = reducedMotion ? target : amount.current;
    if (plume.current) {
      plume.current.scale.set(0.4 + a * 2.6, 0.3 + a * 0.9, 0.4 + a * 1.8);
      plume.current.visible = a > 0.02;
    }
    const m = drops.current;
    if (!m) return;
    m.visible = a > 0.05 && !reducedMotion;
    const t = clock.elapsedTime;
    seeds.forEach((s, i) => {
      const life = (t * 0.9 + s.phase) % 1;
      const r = life * 0.55 * s.speed;
      const y = 0.45 + life * s.speed * 1.4 - life * life * 2.6;
      tmp.position.set(Math.cos(s.angle) * r * 0.5, Math.max(-0.3, y), Math.sin(s.angle) * r * 0.5);
      tmp.scale.setScalar(0.06 + (1 - life) * 0.05);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={LEAK_POINT}>
      <mesh ref={plume} material={mats.plume}><sphereGeometry args={[1, 24, 16]} /></mesh>
      {active && <mesh material={mats.crack} position={[0, 0.3, 0]}><boxGeometry args={[0.5, 0.06, 0.12]} /></mesh>}
      <instancedMesh ref={drops} args={[undefined, undefined, DROPS]} material={mats.drop}>
        <sphereGeometry args={[1, 6, 4]} />
      </instancedMesh>
    </group>
  );
}
