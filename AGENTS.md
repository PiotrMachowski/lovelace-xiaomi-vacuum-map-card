# Agent guide

## Fork relationship

- This repository is Igloczek's fork of `PiotrMachowski/lovelace-xiaomi-vacuum-map-card`; upstream remains the base for general development.
- Keep the active differences, intended scope, and upstream-sync notes in [`FORK.md`](FORK.md). Read it before changing fork-specific behavior or syncing upstream.
- Add every intentional fork-only feature or fix to `FORK.md`, including its reason, scope, and originating issue/PR/commit. When upstream absorbs it, mark it superseded with the upstream commit.
- In a fresh clone, configure the original repository as `upstream` before attempting a sync; this checkout already has that remote configured.

## Project map

- This is a TypeScript/Lit custom card for Home Assistant. The main card is `src/xiaomi-vacuum-map-card.ts`.
- Map models and geometry live in `src/model/`; configuration types are in `src/types/` and validation is in `src/config-validators.ts`.
- Read `CONTRIBUTING.md` for platform-template and translation workflows. Update `docs/configuration.md` and `docs/platforms.md` when user-facing configuration or behavior changes; the README keeps only the What-is-better table and the migration notes.

## Map geometry

- Keep vacuum coordinates, calibrated map coordinates, source-image pixels, and CSS layout pixels distinct. Use `CoordinatesConverter` and the `MapObject` conversion helpers instead of mixing spaces.
- `realScale` converts source-image pixels to the canvas's untransformed layout size. `mapScale` is the pinch-zoom scale. The canvas and SVG overlays share the `#map-zoomer-content` transform.
- Use `calculateRealScale()` for the base image scale. `getBoundingClientRect()` includes CSS zoom and rotation and can apply a transform twice to overlays when an image reloads.
- `RoomColorDetector` returns image-pixel room outlines. Camera `rooms` metadata supplies room IDs and names; preserve configured room selections as a fallback when detection is unavailable.
- When changing map rendering, verify overlays and room hit-testing at multiple zoom levels and rotations. Keep rotation behavior in the shared map transform; add a manual rotation control only when the requested feature calls for one.

## Local checks

- Run `npm run check:map-scale` for the zoom/rotation scale regression check.
- Run `npm run build` for linting and the production bundle; `npx tsc --noEmit` is an additional type check.
- Use `npm start` for the development bundle. `CONTRIBUTING.md` documents loading it into a Home Assistant instance.

## GitHub releases

- `.github/workflows/release.yml` builds and uploads `xiaomi-vacuum-map-card.js` when a GitHub release is published. Check that workflow when changing release packaging.
- Run `gh` in the authorized local environment, outside the sandbox.
