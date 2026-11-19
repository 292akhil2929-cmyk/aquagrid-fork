# AquaGrid — The city beneath the city

An interactive digital twin of a Gulf coastal water system. It explains the Water, Energy & Climate Resilience problem visually: how seawater intake, desalination, storage and distribution depend on one another, and what happens when a tariff spike, a burst main, a faulty sensor and an algal bloom arrive in the same twenty minutes.

## What's in it

| Section | What it shows |
| --- | --- |
| **The system** (hero) | A 3D coastal city that separates into five layers as you scroll: city, distribution, storage, desalination, intake. Rotate, pan, zoom, expand or collapse, select any layer or asset for an information panel, reset the camera. A 2D section view is one click away. |
| **One city. Four disruptions.** | A seven-step walkthrough (13:00 → 14:20) with a sticky 3D view that flies to each incident: tariff spike, Sector 4 leak, P-S4B sensor flatline (cross-checked and quarantined by the backend), algal-bloom warning, the unsafe AI production cut (rejected by the backend), and a human-approved valve isolation. |
| **Inside the desalination plant** | Exploded six-stage RO plant with a production slider; plant load, specific energy and hourly cost come from the backend energy model. Includes an SWRO process-flow diagram with the energy-recovery loop. |
| **Storage** | Two transparent reservoirs, baseline vs proposed peak-tariff throttling, with the 35% floor as a physical plane. Play the evening hour by hour. |
| **Control room** (`/control`) | 2D network twin with search, upstream trace, pan/zoom, flow and label toggles, asset inspector, alerts, three production plans, activity history and session JSON export. |

## Architecture

```
app/, components/, lib/     Next.js 16 · React 19 · TypeScript · Tailwind 4
                            React Three Fiber · drei · three · motion · GSAP ScrollTrigger
backend/aquagrid/           Python simulation engine (standard library only)
api/index.py                Vercel Python function exposing the engine at /api/*
backend/dev_server.py       Same engine on http://127.0.0.1:8000 for local development
```

The **Python engine is the only source of operational values**. The browser draws what it returns and never computes reserve levels, verdicts, costs or sensor diagnoses itself. Rendering (`components/three/*`) is separate from operational logic (`backend/aquagrid/*`).

3D modules: `CoastalCity`, `DesalinationPlant`, `ReservoirSystem`, `PipelineNetwork`, `DistributionSector`, `SensorNode`, `IsolationValve`, `ExplodedLayers`, `IncidentCamera`, plus `ScenarioController` (shared state, wraps the backend client). All geometry is procedural and original; no third-party models or textures.

### API

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Engine status |
| `GET /api/network` | Topology: assets, layers, edges |
| `POST /api/state` | Full operational state for a scene, given quarantined sensors and signed valve records |
| `POST /api/sensors/analyze` | Flatline test + neighbour cross-check + Sector 4 flow balance |
| `POST /api/sensors/quarantine` | Quarantines a sensor only if the analysis shows it is unreliable (409 otherwise) |
| `POST /api/plans/evaluate` | Reservoir projection and constraint verdict (`ACCEPTED` / `HOLD` / `REJECTED`), plus a backend-derived safe alternative |
| `GET /api/desal?production=` | RO stages and operating point |
| `POST /api/auth/login` | Operator sign-in, returns an HMAC-signed session |
| `POST /api/valves/stage` | Evaluates a valve change and returns a signed, locked proposal (or a rejection) |
| `POST /api/valves/approve` | Requires a Control-Room Operator, re-validates against current state, returns a signed simulated valve record |

Demo accounts: **CR-07 / 2468** (Control-Room Operator, can approve) and **AN-02 / 1357** (analyst, refused with 403). Override with `AQUAGRID_OPERATOR_PIN`, `AQUAGRID_ANALYST_PIN`; set `AQUAGRID_SECRET` in production.

## Run locally

```bash
npm install
npm run dev:api     # terminal 1 — Python engine on :8000
npm run dev         # terminal 2 — Next.js on :3000 (proxies /api to :8000)
```

Tests: `npm run test:api` (engine, 20 tests) and `npm run typecheck`.

## Deploy

`vercel.json` sets the Next.js framework, deploys `api/index.py` as a Python function (bundling `backend/aquagrid`) and rewrites `/api/*` to it. No Python dependencies are needed.

## Model (illustrative, synthetic)

- Storage: next volume = volume + production − demand − modelled loss, hourly. 10,000 m³ across three reservoirs, 62% at 14:00, 550 m³/h demand, 65 m³/h Sector 4 leak, 35% safety floor.
- Production: two RO trains, 600 m³/h nominal (100–800 m³/h envelope), 48% recovery. Specific energy = 2.64 + 120/p + 0.0011·p kWh/m³ (3.5 at 600 m³/h).
- Tariff: $0.32/kWh 14:00–20:00, $0.12/kWh otherwise.
- Peak-tariff throttling (100 m³/h through the peak) bottoms out at 30.5% and is **rejected**. Shift-to-off-peak passes the floor but is **held** for human review while the bloom warning is open.
- Leak evidence rests on flow balance and localisation, never on pressure alone. A flatline marks an unreliable channel, not a finding about the water. A bloom warning triggers water-quality assessment, not a contamination verdict.

## Limits

All telemetry is synthetic and deterministic. There is no EPANET hydraulic solver, LLM or persistent audit store; the activity log lives in the browser tab. Valve control is simulated: nothing connects to a real actuator, PLC or SCADA system.

## Accessibility and performance

Reduced-motion users get instant camera moves and static flow; every 3D view has a 2D alternative and keyboard-operable controls; charts include data tables for screen readers. Buildings and membrane vessels are instanced, materials and geometry are reused, canvases stop rendering when off screen, and there is no post-processing.
