"use client";

import { createContext, useContext, type MutableRefObject } from "react";
import * as THREE from "three";
import type { SimState, Status } from "@/lib/api";

export interface TwinApi {
  /** Animated explode amount 0..1 (mutated every frame). */
  explode: MutableRefObject<number>;
  /** Target explode amount 0..1 (mutated by scroll / buttons). */
  explodeTarget: MutableRefObject<number>;
  focusLayer: number | null;
  selected: string | null;
  hovered: string | null;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  state: SimState | null;
  reducedMotion: boolean;
  showLabels: boolean;
  /** Valve with a staged proposal awaiting human approval. */
  lockedValve: string | null;
  selectLayer: (layer: number) => void;
}

export const TwinContext = createContext<TwinApi | null>(null);
export function useTwin() {
  const t = useContext(TwinContext);
  if (!t) throw new Error("useTwin outside TwinContext");
  return t;
}

export const COLORS = {
  navy: "#111b3a",
  navy2: "#1b2c54",
  navy3: "#293f71",
  blue: "#6fa8ea",
  blueDeep: "#2e72b8",
  yellow: "#f2ea1e",
  white: "#f4f7fb",
  concrete: "#c9d3e1",
  steel: "#9fb0c8",
  steelDark: "#5d6f8f",
  amber: "#e8892b",
  red: "#d33a3f",
  grey: "#7f8aa3",
  sea: "#315b8b",
};

export function statusColor(status: Status | undefined): string {
  switch (status) {
    case "critical": case "alarm": return COLORS.red;
    case "warning": case "flatline": case "fault": case "watch": return COLORS.amber;
    case "quarantined": case "isolated": return COLORS.grey;
    case "closed": return COLORS.yellow;
    default: return COLORS.blue;
  }
}

export function useStatus(id: string): Status | undefined {
  return useTwin().state?.asset_status[id];
}

/** Material that remembers its base opacity so layers can fade without losing it. */
export function std(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08, transparent: true, ...opts });
  m.userData.baseOpacity = opts.opacity ?? 1;
  return m;
}

/** Applies a fade multiplier to every material below `root`. */
export function applyFade(root: THREE.Object3D, fade: number) {
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      const base = (m.userData.baseOpacity as number | undefined) ?? 1;
      const sm = m as THREE.ShaderMaterial;
      if (sm.uniforms?.uOpacity) sm.uniforms.uOpacity.value = base * fade;
      else m.opacity = base * fade;
      m.depthWrite = fade > 0.95 && base > 0.95;
    }
  });
}
