// Spatial layout of the digital twin. 1 world unit ≈ 10 m.
// This file holds geometry only — every operational value comes from the backend.

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export const LAYERS = [
  { id: 1, key: "city", name: "City and consumers", short: "City",
    role: "Five districts draw 550 m³/h. Sector 4, the Harbour district, holds Al Noor Hospital and the branch where the incident happens.",
    assets: ["SEC-01", "SEC-02", "SEC-03", "SEC-04", "SEC-05", "BR-4H"] },
  { id: 2, key: "distribution", name: "Distribution network", short: "Distribution",
    role: "A pumping station lifts stored water into trunk mains. Valves set the boundaries of each sector; meters and pressure sensors watch them.",
    assets: ["PS-01", "V-04A", "V-04B", "FM-S4", "FM-PS", "P-S3", "P-S4A", "P-S4B"] },
  { id: 3, key: "storage", name: "Reservoir storage", short: "Storage",
    role: "Three reservoirs hold 10,000 m³. Storage decouples production from demand, but it must never fall below the 35% strategic reserve.",
    assets: ["RES-01", "RES-02", "RES-03"] },
  { id: 4, key: "desalination", name: "Desalination production", short: "Desalination",
    role: "Two reverse-osmosis trains turn 1,250 m³/h of seawater into 600 m³/h of fresh water — the city's largest electricity load.",
    assets: ["PT-01", "HPP-01", "RO-01", "RO-02", "ERD-01", "SDI-01", "COND-01"] },
  { id: 5, key: "intake", name: "Coastal seawater intake", short: "Intake",
    role: "An offshore intake draws seawater 600 m from shore. What happens in the Gulf — blooms, turbidity, temperature — arrives here first.",
    assets: ["INT-01", "IPS-01", "CHL-01", "TURB-01"] },
] as const;

/** Vertical offset of each layer when fully exploded. */
export const EXPLODE_OFFSET: Record<number, number> = { 1: 28, 2: 14, 3: 0, 4: -14, 5: -28 };
/** Underground depth of the distribution pipes when collapsed. */
export const PIPE_DEPTH = -1.1;

export const ASSET_POS: Record<string, { layer: number; p: Vec3 }> = {
  "INT-01": { layer: 5, p: [-42, -1.9, 4] },
  "IPS-01": { layer: 5, p: [-27, 0, 4] },
  "CHL-01": { layer: 5, p: [-40.5, 0, 1.5] },
  "TURB-01": { layer: 5, p: [-29, 0, 6.5] },
  "PT-01": { layer: 4, p: [-20, 0, 4] },
  "SDI-01": { layer: 4, p: [-17.5, 0, 8.5] },
  "HPP-01": { layer: 4, p: [-16, 0, 1.5] },
  "RO-01": { layer: 4, p: [-10.5, 0, -3.5] },
  "RO-02": { layer: 4, p: [-10.5, 0, 6] },
  "ERD-01": { layer: 4, p: [-14.5, 0, 10.5] },
  "COND-01": { layer: 4, p: [-6.5, 0, 2] },
  "RES-01": { layer: 3, p: [-1, 0, -14] },
  "RES-02": { layer: 3, p: [2, 0, 0] },
  "RES-03": { layer: 3, p: [-1, 0, 14] },
  "PS-01": { layer: 2, p: [9, 0, 0] },
  "FM-PS": { layer: 2, p: [11.5, PIPE_DEPTH, 0] },
  "V-04A": { layer: 2, p: [21, PIPE_DEPTH, 11] },
  "FM-S4": { layer: 2, p: [24.5, PIPE_DEPTH, 11] },
  "P-S3": { layer: 2, p: [27, PIPE_DEPTH, 0] },
  "P-S4A": { layer: 2, p: [29, PIPE_DEPTH, 15] },
  "V-04B": { layer: 2, p: [34, PIPE_DEPTH, 17] },
  "P-S4B": { layer: 2, p: [38.5, PIPE_DEPTH, 17] },
  "SEC-01": { layer: 1, p: [22, 0, -15] },
  "SEC-02": { layer: 1, p: [38, 0, -9] },
  "SEC-03": { layer: 1, p: [24, 0, 1] },
  "SEC-04": { layer: 1, p: [33, 0, 16] },
  "SEC-05": { layer: 1, p: [16, 0, 16] },
  "BR-4H": { layer: 1, p: [40, 0, 20.5] },
};

/** District footprints [xMin, xMax, zMin, zMax] and character. */
export const SECTORS: Record<string, { rect: [number, number, number, number]; towers: number; seed: number }> = {
  "SEC-01": { rect: [14, 30, -23, -8], towers: 0.08, seed: 11 },
  "SEC-02": { rect: [32, 45, -23, 6], towers: 0.12, seed: 23 },
  "SEC-03": { rect: [16, 30, -5, 7], towers: 0.42, seed: 37 },
  "SEC-04": { rect: [24, 45, 9, 24], towers: 0.1, seed: 41 },
  "SEC-05": { rect: [9, 22, 9, 24], towers: 0.04, seed: 53 },
};
export const HOSPITAL: Vec3 = [27.5, 0, 12.5];
export const BRANCH_RECT: [number, number, number, number] = [36, 45, 18, 24];

const D = PIPE_DEPTH;
/** Pipe routes keyed by backend edge "FROM>TO". Points are layer-local. */
export const PIPES: Record<string, { layer: number; pts: Vec3[]; r: number }> = {
  "INT-01>IPS-01": { layer: 5, r: 0.55, pts: [[-42, -1.6, 4], [-30, -1.6, 4], [-28.5, 0.4, 4]] },
  "IPS-01>PT-01": { layer: 5, r: 0.5, pts: [[-25.5, 0.4, 4], [-23, 0.4, 4]] },
  "PT-01>HPP-01": { layer: 4, r: 0.4, pts: [[-23, 0.4, 4], [-17.5, 0.4, 4], [-17.5, 0.4, 1.5]] },
  "HPP-01>RO-01": { layer: 4, r: 0.32, pts: [[-15, 0.4, 1.5], [-14, 0.4, 1.5], [-14, 0.4, -3.5], [-13, 0.4, -3.5]] },
  "HPP-01>RO-02": { layer: 4, r: 0.32, pts: [[-15, 0.4, 1.5], [-14, 0.4, 1.5], [-14, 0.4, 6], [-13, 0.4, 6]] },
  "RO-01>RES-01": { layer: 4, r: 0.32, pts: [[-8, 0.4, -3.5], [-6.5, 0.4, -3.5], [-6.5, 0.4, 2]] },
  "RO-01>RES-02": { layer: 3, r: 0.4, pts: [[-6.5, 0.3, 2], [-3.5, 0.3, 2], [-3.5, 0.3, 0], [-2.2, 0.3, 0]] },
  "RO-02>RES-02": { layer: 4, r: 0.32, pts: [[-8, 0.4, 6], [-6.5, 0.4, 6], [-6.5, 0.4, 2]] },
  "RO-02>RES-03": { layer: 3, r: 0.4, pts: [[-3.5, 0.3, 2], [-3.5, 0.3, 14], [-4.6, 0.3, 14]] },
  "RES-01>PS-01": { layer: 2, r: 0.5, pts: [[-1, D, -14], [5, D, -14], [5, D, -0.6], [8, D, -0.6]] },
  "RES-02>PS-01": { layer: 2, r: 0.55, pts: [[2, D, 0], [8, D, 0]] },
  "RES-03>PS-01": { layer: 2, r: 0.5, pts: [[-1, D, 14], [5, D, 14], [5, D, 0.6], [8, D, 0.6]] },
  "PS-01>SEC-01": { layer: 2, r: 0.42, pts: [[10, D, -0.6], [13.4, D, -0.6], [13.4, D, -15], [22, D, -15]] },
  "PS-01>SEC-02": { layer: 2, r: 0.42, pts: [[10, D, -1.2], [14.6, D, -1.2], [14.6, D, -7], [38, D, -7], [38, D, -9]] },
  "PS-01>SEC-03": { layer: 2, r: 0.42, pts: [[10, D, 0], [24, D, 0], [24, D, 1]] },
  "PS-01>V-04A": { layer: 2, r: 0.42, pts: [[10, D, 0.6], [14.6, D, 0.6], [14.6, D, 11], [20.2, D, 11]] },
  "V-04A>SEC-04": { layer: 2, r: 0.42, pts: [[21.8, D, 11], [29, D, 11], [29, D, 16], [33, D, 16]] },
  "SEC-04>V-04B": { layer: 2, r: 0.28, pts: [[29, D, 16], [29, D, 17], [33.3, D, 17]] },
  "V-04B>BR-4H": { layer: 2, r: 0.28, pts: [[34.7, D, 17], [40, D, 17], [40, D, 20.5]] },
  "PS-01>SEC-05": { layer: 2, r: 0.42, pts: [[10, D, 1.2], [12.8, D, 1.2], [12.8, D, 16], [16, D, 16]] },
};

/** Where the simulated harbour-branch break is. */
export const LEAK_POINT: Vec3 = [37.2, D, 17];

/** Vertical links between layers, visible when exploded: [x, z, fromLayer, toLayer]. */
export const RISERS: [number, number, number, number][] = [
  [-23, 4, 5, 4], [-6.5, 2, 4, 3],
  [-1, -14, 3, 2], [2, 0, 3, 2], [-1, 14, 3, 2], [9, 0, 2, 2],
  [22, -15, 2, 1], [38, -9, 2, 1], [24, 1, 2, 1], [33, 16, 2, 1], [16, 16, 2, 1], [40, 20.5, 2, 1],
];

export interface CameraShot { pos: Vec3; target: Vec3 }
/** Camera framing per story scene, with layers fully exploded except scene 1. */
export const SCENE_SHOTS: Record<number, CameraShot & { explode: number; focus: number | null; asset?: string }> = {
  1: { pos: [52, 50, 78], target: [2, 0, 0], explode: 0, focus: null },
  2: { pos: [10, -2, 38], target: [-13, -14, 3], explode: 1, focus: 4, asset: "HPP-01" },
  3: { pos: [54, 26, 42], target: [33, 13, 15], explode: 1, focus: 2, asset: "P-S4A" },
  4: { pos: [49, 20, 32], target: [37, 12.5, 17], explode: 1, focus: 2, asset: "P-S4B" },
  5: { pos: [-16, -17, 32], target: [-36, -28.5, 4], explode: 1, focus: 5, asset: "CHL-01" },
  6: { pos: [24, 10, 32], target: [0, 1, 0], explode: 1, focus: 3, asset: "RES-02" },
  7: { pos: [50, 24, 36], target: [33, 13, 16], explode: 1, focus: 2, asset: "V-04B" },
};
export const HOME_SHOT: CameraShot = { pos: [58, 50, 86], target: [-12, -2, 4] };
export const EXPLODED_SHOT: CameraShot = { pos: [150, 34, 170], target: [-4, -2, 0] };
