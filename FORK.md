# Fork scope and upstream differences

This repository is Igloczek's fork of
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card),
published as **Better Xiaomi Vacuum Map Card**. Upstream is the baseline; this file records where the
fork behaves differently and how to sync upstream. Planned work is in [ROADMAP.md](ROADMAP.md),
released changes in [CHANGELOG.md](CHANGELOG.md).

## Compatibility

The custom element (`custom:xiaomi-vacuum-map-card`), the release asset
(`xiaomi-vacuum-map-card.js`) and every existing configuration key keep their upstream names and
meaning. The fork adds options; it does not rename or remove them.

## Upstream snapshot

- Upstream baseline: `045c3ac` (`upstream/master`), the revision the differences below were last
  reviewed against on 2026-11-14.
- Refresh this snapshot in the same pull request as an upstream sync. The ahead/behind counts belong
  to that pull request (`git log --left-right --cherry-pick --oneline upstream/master...master`), not
  to this file.

## Active differences

Each row is a preservation criterion for an upstream import. The
[sync checklist](.agents/skills/sync-upstream/fork-differences.md) maps every row to the files that
implement it and the proof that must still pass.

| Area | Behaviour in this fork | Why |
| --- | --- | --- |
| <a id="persistent-map-view-and-rotation"></a>Persistent map view and rotation | Zoom, position and rotation are remembered per card, preset and map by default (`persist_map_view`), the lock state is remembered too (`persist_map_lock`), and two-finger rotation is on by default (`map_rotation_gesture`). | A dashboard should reopen the map where the user left it. |
| <a id="rotation-controls"></a>Rotation controls | The toolbar has no manual rotate button; configured `map_rotation` and the rotation gesture remain available. | Rotation belongs in the gesture and the configuration, not a toolbar button. |
| <a id="automatic-room-mapping"></a>Automatic room mapping | Room outlines, names, label positions and hit targets are built from the camera's `rooms` metadata and the map's fill colours; configured rooms remain the fallback when metadata or distinct colours are unavailable. | Hand-drawing room outlines is the main setup cost of the upstream card. |
| <a id="map-appearance"></a>Map appearance | `transparent_background` makes near-white pixels transparent for a dark dashboard, and room labels are white with a dark outline so they read on any room colour. | Upstream labels are hard to read on coloured maps. |
| <a id="zoom-alignment"></a>Zoom alignment | The base image scale comes from the canvas's untransformed layout width, so zoom and rotation apply once to the image and its overlays. | A transformed measurement applied the scale twice and detached the room overlays. |
| <a id="b6-map-refresh"></a>Map refresh policy | A pure policy (`src/model/map-refresh-policy.ts`) decides the camera snapshot's cache-buster: the URL changes on a camera `last_updated`/`entity_picture` change or about once per five seconds, and stays frozen while the tab is hidden. A render the interval holds back schedules exactly one trailing refresh, cancelled on disconnect, and room-colour detection shares the same camera identity key. | Upstream reloaded the snapshot on every vacuum, tile or icon update. |
| <a id="b2-editor-room-config"></a>Editor room-config path | Generating rooms copies the mode list instead of mutating Home Assistant's frozen configuration, scopes the room-config request and answer to the requesting card (entity, camera, request id), keeps exactly one ROOM mode across repeated generation, renders `ha-input` with an `ha-textfield` fallback, draws switch labels when the frontend has no `ha-formfield`, and removes an editor-preview card's listeners on disconnect. | Upstream generation mutated the config, leaked across cards and lost its labels on newer frontends. |
| <a id="delayed-card-work"></a>Delayed card work | Delayed callbacks are tracked and cancelled in `disconnectedCallback`, a callback queued after removal does not start a timer, and a map-image `load` that arrives after removal is replayed when the card is attached again. | Home Assistant re-layouts and re-attaches cards; upstream could leave a static map blank or animate a re-attached card. |
| <a id="release-packaging"></a>Release packaging | The release workflow has `contents: write`, attaches the built `xiaomi-vacuum-map-card.js`, and accepts an unchanged version (`npm version --allow-same-version`). | Without the permission the workflow cannot upload the asset, and a version already set in `package.json` must not block the release. |
| <a id="ci-validation"></a>CI validation | HACS validation runs every check including `issues`, because the fork tracks its own reports; the master→dev automerge job has `contents: write` so `GITHUB_TOKEN` can push. | The default HACS setup would fail on the fork's own issue tracker. |
| <a id="ci-baseline"></a>CI baseline | Build, release, HACS and automerge workflows use `actions/checkout@v4`; build and release run Node 22 with npm caching, and the build runs `npx tsc --noEmit` before bundling; `package-lock.json` is lockfile v3. | Upstream pins Node 14 and has no type-check gate. |
| <a id="p0-test-infrastructure"></a>Test infrastructure | Vitest 3 with a happy-dom harness (`test/harness/`), fixture locations under `test/fixtures/`, `npm test` in CI, and a pure `RoomColorDetector.detectFromImageData` entry point. | Upstream has no unit-test harness. |
| <a id="b1-config-robustness"></a>Config robustness | An incomplete predefined room, calibration point or dynamic (entity-backed) selection reports a validation message and is skipped instead of throwing; valid entries behave as before. | Small configuration mistakes crashed the upstream card. |
| <a id="b7-registry-cache"></a>Registry lookup and caching | `getAllEntitiesFromTheSameDevice` reads the vacuum's `device_id` and makes one `config/entity_registry/get_entries` call for that device, memoized per connection and device entity set, with `/list` plus per-entry `/get` only as a fallback. | Upstream downloaded the whole registry and fetched every entry on every `setConfig`. |
| <a id="b3-tiles-labels-icons"></a>Tile labels, translations, durations and icons | Tile translations match case-insensitively, labels use `hass.formatEntityName` only where it exists with the current signature (2026.4+) and fall back to `friendly_name` then the entity id, `duration_unit` follows the sensor's unit, and `return_to_base` uses `mdi:home-import-outline`. | Upstream labels, durations and icons were wrong on some integrations, and the 2025.10 helper signature threw during render. |
| <a id="b5-cleaning-order-badges"></a>Cleaning-order badges | A selected room shows its position in click order, the remaining badges renumber on deselection, and detected rooms without an icon draw the number above their label; the badge ignores pointer events. | The order is sent to the platform but was invisible before cleaning started. |
| <a id="b8-stale-room-selections"></a>Stale ROOM selections | Configured ROOM ids missing from the live camera `rooms` metadata are stale: drawn from their stored outline, marked red with a `!`, unselectable and pointer-transparent, named in a `hui-warning`, and dropped from `_getSelection` so they cannot reach a service call. Missing metadata means "unknown", not "all stale". | A re-map renumbers segments, so a stale selection could clean the wrong room. |
| <a id="b9-default-map-view"></a>Default map view and reset | `map_view: {scale, x, y, rotation}` sets the opening view, and the reset control and `map_view.reset` action return to it; partial values fill from the neutral view, invalid values are reported, and the order is stored view, configured default, neutral. It applies at the start of a card or preset session and is ignored in `additional_presets`. | Upstream always opened at the neutral view and had no reset to a configured one. |
| <a id="b10-horizontal-layout"></a>Horizontal layout and sections-view sizing | `layout: vertical \| horizontal` puts the map beside the controls when horizontal, with a clamped controls column that wraps and scrolls. `getGridOptions()` keeps the upstream default for vertical and asks for 6 rows and `min_columns: 9` for horizontal; a grid cell is filled and scrolled rather than overflowed, and a `ResizeObserver` recalculates the base scale after a resize. | Getting this layout needed `card-mod`, and fixed-height sections cells overflowed. |
| <a id="visual-regression-harness"></a>Visual regression harness | Playwright (Chromium, pinned to the job image) loads the built bundle with a browser-side mock `hass` and covers overlay alignment at zoom 1/2.5 × rotation 0/90, configured and stored map views, room hit-testing including a stale room over a live one, layout and resize geometry, a sections-view cell and the horizontal interactions. It runs in its own `visual` workflow (dispatch or the `visual` label). | Upstream has no browser-level visual coverage. |
| <a id="end-to-end-verification"></a>End-to-end verification | `test/e2e/` runs Home Assistant 2026.11.0 in Docker, installs the card from the repository through the Marketplace, overlays the branch build and drives the frontend with Playwright: editor, map view, both layouts, zoom and rotation, camera request rate, YAML `y:`, rendering and a re-mapped camera with stale rooms. Run it with `npm run test:e2e`. | Unit tests cannot prove the card inside a real Home Assistant frontend. |
| <a id="r1-project-identity"></a>Project identity | The package, HACS metadata, README, `docs/configuration.md`, `docs/platforms.md` and issue forms are rebranded for Better Xiaomi Vacuum Map Card while the element, asset and YAML keys stay upstream-compatible; fork bugs go to the fork tracker and shared platform templates stay upstream. | The fork needs its own identity without breaking existing dashboards. |
| <a id="r2-repository-rename"></a>Repository rename | The repository is `Igloczek/lovelace-better-xiaomi-vacuum-map-card`; the fork's own URLs and the HACS resource path point at it, while upstream links and the `upstream` remote stay upstream. The README tells HACS users to re-add the custom repository once. | HACS caches custom repository URLs, and the resource path changed with the repository name. |
| <a id="upstream-sync-skill"></a>Upstream sync skill | `.agents/skills/sync-upstream/` holds the sync procedure (`SKILL.md`) and the per-area checklist (`fork-differences.md`), and `AGENTS.md` points at both. | A clean merge does not prove a difference survived; the checklist makes every row testable. |

## Upstream sync preservation contract

Every row in **Active differences** is a preservation criterion for an upstream import, including changes that merge without conflicts. Before syncing, follow [.agents/skills/sync-upstream/SKILL.md](.agents/skills/sync-upstream/SKILL.md); the checklist in [.agents/skills/sync-upstream/fork-differences.md](.agents/skills/sync-upstream/fork-differences.md) maps each area to the files that implement it and the test that proves it.

- Reconcile upstream improvements at the affected boundary; do not freeze an old implementation.
- Never resolve a conflict by choosing one side wholesale. Keep the fork behavior and reapply the upstream change around it.
- Never delete a fork regression test, a FORK.md row, a documentation anchor or the sync skill to make an import pass.
- If upstream now provides the same behavior, prove equivalence with the tests, then move the row to **Superseded differences** and record the upstream commit.
- Keep the upstream snapshot and this section current in the same pull request as the sync.

## Superseded differences

None yet.

## Scope boundaries

- Keep the fork focused on concrete bugs and features with a Home Assistant use case; upstream
  behavior stays the default elsewhere.
- Keep vendor-specific claims out unless they can be reproduced with a fixture or a device.
- Prefer small modules for fork-only logic so upstream syncs touch fewer lines.
- When a new intentional difference is added, record it here with what it changes and why, and add
  it to the sync checklist.

## Syncing upstream

This checkout has an `upstream` remote. In a fresh clone:

```sh
git remote add upstream https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card.git
```

Follow [the sync skill](.agents/skills/sync-upstream/SKILL.md) for the full procedure. Before
merging, review both sides:

```sh
git fetch upstream
git log --left-right --cherry-pick --oneline upstream/master...master
git diff --stat upstream/master...master
```

Run the proof for every area the import touches, keep the fork behavior that still fits, and update
this file in the same pull request: the snapshot, the active rows, and any row that upstream has
superseded.
