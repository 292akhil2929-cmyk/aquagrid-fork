# AquaGrid

Interactive infrastructure explorer and network-first command centre, built as a dependency-free browser simulation.

## Run

Open `dist/index.html` directly, or serve `dist` with `python3 -m http.server 4173 --directory dist`.

## Included

- Original procedural SVG exploded model of five infrastructure layers, with expand/collapse, contextual information and a 2D alternative.
- Interactive network with asset search, inspection, upstream tracing, pan, zoom, flow and label controls.
- Reproducible 14:00 disruption, intake sensor quarantine, independent Sector 4 leak evidence.
- Three production comparisons with calculated reserve projections and energy costs, demo constraint evaluation and session JSON export.
- Responsive interface, keyboard asset controls, reduced-motion support.

## Limits

This implements the requested visual application experience. It is not the full engineering MVP described in the supplied reference briefs. There is no Python service, EPANET hydraulic solver, authenticated operator workflow, LLM integration or physical actuator. Data is synthetic; pressure/head values are illustrative. Session history is held in browser memory and resets on reload. All controls are simulation or inspection controls.

Hourly reservoir balance: next volume = current volume + production − demand − injected loss. Capacity 10,000 m³, initial storage 6,200 m³, demand 550 m³/h, injected loss 65 m³/h, demo reserve floor 35%. Desalination production totals 600 m³/h from 1,250 m³/h feed; the remaining 650 m³/h reject stream is outside the distribution schematic. Cost sums production × 3.5 kWh/m³ × illustrative USD tariffs (0.32 peak, 0.12 off-peak). These assumptions are educational, not operating guidance.

## Validation

Run `node tests/model.cjs` for reserve-balance and cost assertions. Browser checks cover landing model controls, upstream tracing, disruption, reserve-floor rejection, quarantine, activity recording and responsive layouts.

## Assets

All infrastructure geometry and icons are original code-generated SVG; no stock photography or third-party models. Google Fonts: Manrope, DM Sans and IBM Plex Mono, with system fallbacks. Fonts require network access; all simulation logic works offline.
