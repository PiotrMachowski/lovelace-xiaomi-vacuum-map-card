# Fork differences: sync preservation checklist

[`FORK.md`](../../../FORK.md) is authoritative. This file is the sync view: every active difference,
the files that implement it, and the proof that must still pass after an upstream import. An import
that merges cleanly but breaks a row here is a failed sync.

| Area (FORK.md anchor) | Protected implementation | Proof after the sync |
|---|---|---|
| Persistent map view and rotation (`#persistent-map-view-and-rotation`) | `src/model/map-view-store.ts`; `src/xiaomi-vacuum-map-card.ts` restore/persist methods; `src/const.ts` storage keys | `test/map-view-store.test.ts`, `test/map-view-config.test.ts`, visual stored-view scenarios, e2e `map-view.spec.ts` |
| Rotation controls (`#rotation-controls`) | Toolbar render in `src/xiaomi-vacuum-map-card.ts`; rotation gesture handling | The toolbar has no manual rotate button; gestures and configured `map_rotation` still work |
| Automatic room mapping (`#automatic-room-mapping`) | `src/model/room-color-detector.ts`; `src/model/map_objects/room.ts`; card `_detectRoomColors`, `_getRoomsConfig`, `_handleRoomColorClick` | `test/room-color-detector.test.ts`; visual room hit-test; e2e render/editor specs |
| Map appearance (`#map-appearance`) | Room-label CSS variables and `transparent_background` in `src/xiaomi-vacuum-map-card.ts`; label style in `src/model/map_objects/room.ts`; `docs/css_variables.md` | Visual baselines; e2e render screenshot; label white/dark-outline defaults |
| Zoom alignment (`#zoom-alignment`) | `src/model/map-scale.ts`; `calculateRealScale` call sites | `test/map-scale.test.ts`; visual overlay zoom × rotation scenarios |
| Map refresh policy (`#b6-map-refresh`) | `src/model/map-refresh-policy.ts`; card `_getMapSrc`, visibility handler, trailing refresh | `test/map-refresh-policy.test.ts`, `test/regressions/map-refresh-policy.test.ts`; e2e `camera-rate.spec.ts` |
| Editor room-config path (`#b2-editor-room-config`) | `src/editor.ts` request scope, idempotency and `ha-input` fallback; card room-config event handlers | `test/regressions/room-config-*.test.ts`, `editor-text-field-fallback.test.ts`; e2e `editor.spec.ts` |
| Delayed card work | Card `_scheduleDelayedCallback`, `disconnectedCallback`, detached map-load replay | `test/regressions/card-disconnect-delayed-work.test.ts` |
| Release packaging | `.github/workflows/release.yml` (`contents: write`, asset name) | Release workflow still attaches `xiaomi-vacuum-map-card.js` |
| CI validation | `.github/workflows/hacs.yaml`, `automerge.yaml` | HACS validation and master→dev automerge still pass |
| CI baseline (`#ci-baseline`) | `.github/workflows/build.yml`, `release.yml`; `package-lock.json` v3; `tsconfig.json` | Node 22, `actions/checkout@v4`, `npx tsc --noEmit`; no lockfile downgrade |
| Test infrastructure (`#p0-test-infrastructure`) | `test/harness/`, `test/fixtures/`, `vitest.config.ts`, CI test step | `npm test`; harness tests; `npm run check:docs` |
| Config robustness (`#b1-config-robustness`) | `src/config-validators.ts`; dynamic predefined rectangle/point objects | `test/regressions/config-robustness.test.ts` |
| Registry cache (`#b7-registry-cache`) | `src/entity-registry.ts`; `src/utils.ts` re-export | `test/regressions/registry-caching.test.ts`, `test/harness/entity-registry.test.ts` |
| Tile labels, translations, durations, icons (`#b3-tiles-labels-icons`) | `src/components/tile.ts`; `src/model/generators/tiles-generator.ts`; `icon-list-generator.ts`; `src/entity-name.ts`; `platform_templates/roborock.json` | `test/regressions/tile-*.test.ts`, `icon-list.test.ts`, committed snapshots |
| Cleaning-order badges (`#b5-cleaning-order-badges`) | `src/model/map_objects/room.ts`; room selection rendering | `test/regressions/room-cleaning-order.test.ts`; visual `room-hit-test.png` |
| Stale room selections (`#b8-stale-room-selections`) | `src/model/room-config.ts`; card `_getSelection`, warnings and stale-room rendering | `test/room-config.test.ts`, `test/regressions/stale-room-ids.test.ts`; e2e `stale-rooms.spec.ts` |
| Default map view (`#b9-default-map-view`) | `src/model/map-view-store.ts`; card restore/reset; `types.ts` config | `test/map-view-config.test.ts`, `test/regressions/default-map-view.test.ts`; e2e `map-view.spec.ts` |
| Horizontal layout and sizing (`#b10-horizontal-layout`) | Card render/styles, `getGridOptions`, layout types; docs | `test/regressions/card-layout.test.ts`; visual layout scenarios; e2e `layout.spec.ts` |
| Visual regression harness (`#visual-regression-harness`) | `test/visual/`, `.github/workflows/visual.yml`, Playwright pin | `npm run test:visual` |
| End-to-end verification (PR #17) | `test/e2e/`, compose file, HA fixture, installer scripts | `npm run test:e2e` |
| Project identity (`#r1-project-identity`) | `README.md`, `package.json`, `hacs.json`, `docs/`, issue forms | `npm run check:docs`; README install/identity review |
| Repository rename (`#r2-repository-rename`) | `package.json` repository/homepage/bugs, README links, issue forms, `origin` | `gh repo view`; `npm run check:docs` |
| Upstream sync skill | `.agents/skills/sync-upstream/` | This file and `SKILL.md` still present and referenced by `AGENTS.md` |

## Rules for a clean merge

A conflict-free merge is not proof that a difference survived. After importing:

1. Diff the upstream range and list every touched area above.
2. For each touched area, run the proof in the table, or a smaller targeted test plus a code read.
3. Re-run the semantic checks that fixtures cannot cover: map overlays at zoom 2.5 and rotation 90,
   automatic room detection with and without colour, map-view restore, hidden-tab refresh behaviour.
4. If upstream changed a shared file, reapply the fork change instead of accepting one side.
5. Keep the tests. If a test no longer compiles because upstream moved its target, port the test;
   do not delete it.
6. Update `FORK.md` in the same pull request: snapshot, active rows, superseded rows.

## Superseding a difference

Only when upstream provides the same behaviour:

1. Prove equivalence with the table's proof, plus a read of the upstream implementation.
2. Remove the fork-specific code, not the tests.
3. Move the `FORK.md` row to **Superseded differences** with the upstream commit and date.
4. Record the change in `CHANGELOG.md`.
5. Keep the compatibility promise: element name, asset name, HACS filename and YAML keys.
