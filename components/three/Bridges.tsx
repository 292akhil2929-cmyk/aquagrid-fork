"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, type MutableRefObject } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useTwin } from "./twin";

/** Eases the animated explode value toward its target. */
export function ExplodeDriver() {
  const { explode, explodeTarget, reducedMotion } = useTwin();
  useFrame((_, dt) => {
    const t = explodeTarget.current;
    explode.current = reducedMotion ? t : explode.current + (t - explode.current) * Math.min(1, dt * 3.2);
    if (Math.abs(explode.current - t) < 0.0005) explode.current = t;
  });
  return null;
}

export interface ViewApi { zoom: (factor: number) => void }

/** Exposes camera zoom to DOM buttons (wheel zoom stays off so the page can scroll). */
export function ViewBridge({ apiRef }: { apiRef: MutableRefObject<ViewApi | null> }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  useEffect(() => {
    apiRef.current = {
      zoom: (factor) => {
        if (!controls) return;
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        const len = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
        offset.setLength(len);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      },
    };
  }, [camera, controls, apiRef]);
  return null;
}
