# Fork roadmap: upstream fixes and features

This is the execution plan for carrying selected upstream work into this fork and for the
fork-only fixes that upstream does not cover. It is deliberately conservative: an item is only
scheduled when it has a reliable test path on one real Home Assistant instance. Vendor-specific
behaviour that cannot be reproduced without the matching robot or integration is postponed, not
guessed at.

See [`FORK.md`](FORK.md) for the current fork scope and for the log of intentional divergences.
Every batch below that changes fork behaviour must add or update a row there when it lands.

## Ground rules

1. **One batch = one PR.** Branches are cut from `master` and merged sequentially. Do not stack
   unrelated fixes in one branch.
2. **Upstream fixes are cherry-picked, not rewritten.** Use `git cherry-pick -x <sha>` so the
   original author and PR reference survive. If upstream later merges the same change, the
   patch-id match makes the next sync a no-op.
3. **Fork-only code goes into small modules.** The card file is already large and is the main
   source of merge conflicts. Extract pure logic (`map-refresh-policy`, `room-config`,
   `config-normalizer`) so future upstream syncs touch fewer lines.
4. **Test first, then port.** A cherry-picked upstream fix still gets a regression test written
   against the bug before or alongside the patch.
5. **No hardware, no claim.** Integration service semantics, vendor segment IDs and
   platform-specific payloads are never asserted from guesswork. Contract tests may cover the
   shape of a template; behaviour needs a fixture or the real device.

## Phase 0: foundations

### P0a - Node 22 CI and a type-check gate (S)

- `.github/workflows/build.yml` and `release.yml` currently pin Node 14; `package-lock.json` is
  lockfile v1. Move both workflows to Node 22, switch to `actions/checkout@v4`, and regenerate
  the lockfile on Node 22.
- Add `npx tsc --noEmit` to CI. It is not there today.
- Acceptance: `npm ci && npm run build` is green on Node 22, and the produced bundle is
  behaviourally unchanged (compare size and a smoke load against the Node 14 build).
- Record the CI change in `FORK.md`.

### P0b - Test harness (M)

Stack: **Vitest 3 + happy-dom**. It transpiles with esbuild, so the repo's TypeScript 4.4 and
decorators do not matter. Port `scripts/check-map-scale.cjs` into a Vitest test and keep
`npm run check:map-scale` as an alias.

Harness pieces, under `test/harness/`:

- `mockHass({states, entities, callWS, locale, language})` with:
  - `states`, `entities` (display registry, including `device_id`; confirmed present in
    `src/types/fixes.ts:33`),
  - `hassUrl`, `localize`, `locale`,
  - a `callService` spy,
  - a `callWS` router that serves `config/entity_registry/get`, `/get_entries`, `/list`,
    `frontend/get_translations`, and records every call.
- `withState(hass, id, patch)` returning a **new** `hass` and a new state object only for the
  changed entity. `hasConfigOrAnyEntityChanged` (`src/utils.ts:148`) compares states by
  reference; reusing objects would hide real regressions.
- `cameraEntity({rooms, calibration_points, entity_picture, last_updated})`.
- `stubHaElements()` defining minimal `ha-card`, `ha-icon`, `ha-svg-icon`, `ha-button`,
  `ha-switch`, `ha-formfield`, `ha-select`, `ha-textfield` **and** `ha-input`, plus
  `window.loadCardHelpers`.
- `mountCard`, `mountEditor`, `selectPreset`, `fireMapLoad`, and a multi-card page helper.
- Fake timers and a controllable clock; `_getMapSrc` depends on `Date` and
  `DISCONNECTION_TIME`.

Fixtures, under `test/fixtures/`:

- `own-setup/`: a scrubbed capture of the real instance - `states.json`, `registry.json`,
  `camera.json`, `map.png`. Remove the `entity_picture` token, IPs, serials and any home layout
  that should not be committed.
- `synthetic/`: a small PNG with three flat-colour rooms, plus minimal registries per platform
  touched by a test.

Also split `RoomColorDetector.detect` into a pure
`detectFromImageData({width, height, data}, rooms, converter)` with the existing method as a thin
wrapper. Room detection then runs against PNG fixtures decoded with `pngjs` (pure JS), with no
browser and no native canvas.

Add two smoke tests: the card renders from `own-setup`, and the editor renders. Add `npm test`
to CI. Acceptance: green on CI in under 30 seconds.

### P0c - Playwright visual harness (M, parallel with Phase 1)

A static page that loads the built bundle with a mock `hass`, in Chromium. Four to six
scenarios only:

- overlay alignment at zoom 1 and 2.5, rotation 0 and 90, on the synthetic map;
- room hit-testing at one zoom level;
- default vertical layout;
- horizontal layout once B10 exists.

Keep this as a separate CI job (`workflow_dispatch` plus PRs labelled `visual`) so the main gate
stays fast. Baselines are committed; diff threshold around 0.1 %.

### P0d - Capture the real fixture (S, user action)

On the real Home Assistant instance:

1. Set `debug: true` in the card config and press **Copy entity info** in the editor
   (`src/editor.ts:333`). This dumps the vacuum device's registry entries, including
   `unique_id`, which the tile/icon generators match on.
2. Copy the vacuum and camera state objects, including the camera's `rooms`,
   `calibration_points` and `entity_picture`.
3. Save the map PNG.
4. If a re-map is acceptable, capture the camera attributes again after it. That is the fixture
   for the room-ID drift work in B8.

This fixture is the difference between "tests pass in a mock" and "tests describe this setup".

## Phase 1: correctness

### B1 - Config robustness (S, parallel with B2/B3)

Upstream: PR #937, #940, #938; PR #952 only after a repro.

- #937: `config.id.toString()` crashes when a room has no id
  (`src/config-validators.ts:161`).
- #940: the calibration filter calls `p.x` on `undefined`
  (`src/config-validators.ts:45`).
- #938: invalid dynamic predefined selections should be ignored, not throw. The current dynamic
  parsing in `src/model/map_objects/predefined-multi-rectangle.ts` assumes the entity exists.
- #952: HA YAML 1.1 parses an unquoted `y:` key as boolean `true`. Add `config-normalizer.ts`
  only if the bug reproduces on the current HA version. Normalize the boolean key back to `y`
  inside coordinate objects only, and do not mutate the input config.

Files: `config-validators.ts`, dynamic selection objects, new `config-normalizer.ts`.

Tests (unit): each upstream crash config yields a validation error or an ignored selection,
never an exception. For #952 add a normalizer fixture with `{true: 31175}` and one with a valid
`y` to prove it is untouched.

Acceptance: no throw for missing room id, `calibration_points: [{map: {x: 1}}]`, or a dynamic
selection whose entity/attribute is absent.

### B2 - Editor room-config path (M, one PR plus one follow-up)

Upstream: PR #956, #944; fork: duplicate-mode cleanup (#928 observation); PR #958 after that.

- #956: `_handleRoomConfig` mutates HA's frozen `map_modes`
  (`src/editor.ts:299`). Copy the array before replacing or appending.
- #944: scope `EVENT_ROOM_CONFIG_GET` / `EVENT_ROOM_CONFIG` to the requesting card. The request
  carries the entity/camera and a request id; only the matching card answers and only the editor
  that asked accepts the response (`src/editor.ts:86`, `src/editor.ts:292`,
  `src/xiaomi-vacuum-map-card.ts:977`).
- Duplicate modes: generating twice must leave exactly one ROOM mode. Compare by template, not
  by array index alone.
- #958: render `ha-input` when `customElements.get("ha-input")` is defined, otherwise
  `ha-textfield`, so the editor survives HA frontend component changes
  (`src/editor.ts:139`, `src/editor.ts:230`).
- Card disconnect leak: `disconnectedCallback` re-evaluates `_isInEditor()` after the card has
  been detached, so an editor-preview card keeps its window listeners. B2 must switch the
  disconnect path to the `isInEditor` flag stored in `connectedCallback`; P0b works around it in
  the harness by removing the `hui-card-preview` wrapper instead of the card.

Tests (DOM): frozen config + generate; two cards with two editors on one page, asserting card B
never answers editor A; generate twice and assert one ROOM mode; assert the fallback element
choice with and without an `ha-input` stub. Manual check on the real HA for the actual element
API.

Acceptance: generation is idempotent and never mutates the input config; multi-vacuum isolation
is proven by test; the editor's Title field renders on current HA.

### B3 - Tiles, labels and icons (M, parallel with B1/B2)

Upstream: PR #957, #965, #961; issue #723; fold in #964's generic part.

- #723: tile translations lower-case the value but not the translation keys
  (`src/components/tile.ts:118`). Make the lookup case-insensitive.
- #957: fall back to `hass.formatEntityName` before `friendly_name`
  (`src/components/tile.ts:88`, `src/model/generators/tiles-generator.ts:262`).
- #965: add optional `duration_unit` to tile templates and derive the multiplier from the
  entity's `unit_of_measurement` (`ms`, `s`, `min`, `h`, `d`). Unknown units and
  attribute-based tiles keep the old seconds assumption.
- #961: `return_to_base` uses `mdi:home-import-outline`, matching HA core
  (`src/model/generators/icon-list-generator.ts:179`).

Files: `tile.ts`, `tiles-generator.ts`, `icon-list-generator.ts`, types, `roborock.json`
multipliers.

Tests (unit/snapshot): translation fixture with mixed-case keys; mocked `formatEntityName`;
duration fixtures for each unit plus an unknown unit; icon snapshot. Snapshot the tile and icon
output for `own-setup`, review the diff, then commit.

Acceptance: existing configurations without `duration_unit` are byte-identical; the
`own-setup` snapshot is reviewed.

Open follow-up: #957's `entityNamesChanged` re-render hook is **not carried**. It belongs in
`shouldUpdate` in `src/xiaomi-vacuum-map-card.ts`, which B2's merge owns. Cost: a device, area or
floor rename, and Home Assistant's startup swap of the real formatter, do not refresh tile labels
until the next watched-entity update. A follow-up must add the check to `shouldUpdate` and test it
by swapping `hass.devices` (or `hass.formatEntityName`) between two renders.

### B4 - Roborock status/battery templates (S, conditional)

Upstream: PR #964 (issue #908). The tile regexes and battery tile are only verifiable against a
real Roborock-core registry. **Postpone unless the real instance runs HA-core Roborock (or a
user supplies a scrubbed registry dump with provenance).** The generic `duration_unit` part is
already in B3.

If unblocked: add the two `from_sensors` entries, snapshot the generated tiles against the
fixture, and manually verify the status text. Note the known limitation that sensor tiles show
the raw status string.

### B5 - Cleaning-order badges (S, after B2)

Upstream: PR #959 (issue #866). Show the selection index on selected rooms and renumber when a
room is deselected. Do not change service-call ordering here; whether a platform honours it is
vendor behaviour.

Tests (DOM): select three rooms, deselect the middle one, assert the badges renumber and the
service-call selection order is unchanged.

## Phase 2: performance and room correctness

All batches in this phase touch `src/xiaomi-vacuum-map-card.ts`, so they run sequentially.

### B6 - Map refresh policy (M, highest user impact)

Issues #704 and #357. `_getMapSrc` appends `&v=<timestamp>` on every render
(`src/xiaomi-vacuum-map-card.ts:668`), and renders happen on any watched entity update. The
result is a camera snapshot request storm and constant image reloads.

- Extract a pure `map-refresh-policy.ts` that decides the cache-buster.
- The URL changes only when:
  - the camera state changes (`last_updated` or `entity_picture`), or
  - a configured interval elapses (start around 5 s, tune on the real vacuum).
- It never changes because the vacuum or another watched entity updated.
- Pause while `document.hidden`; refresh once on `visibilitychange`.
- Keep room detection compatible: its key already uses the camera's `last_updated`
  (`src/xiaomi-vacuum-map-card.ts:1418`).

Tests: fake timers - 50 vacuum updates in 10 s produce 1-2 `src` changes; one camera update
produces one; a hidden tab produces zero. Playwright: `visibilitychange` behaviour. Manual:
DevTools shows at most one camera request per interval while cleaning.

Acceptance: no image reload caused by vacuum/tile/icon entity updates; map view restore no
longer races an always-loading image.

### B7 - Registry payload and caching (S-M, parallel with B6)

Issue #864. `getAllEntitiesFromTheSameDevice` calls `config/entity_registry/list`, which returns
the whole registry (multi-megabyte on large installs), then calls `/get` for every entity.

- Use `device_id` from `hass.entities` to filter the display registry locally.
- Call `config/entity_registry/get_entries` once with the candidate entity ids. This command
  exists in HA core and returns full entries including `unique_id`, without admin.
- Memoize per `(hass.connection, vacuum, device entity set)` so a changed entity set refreshes
  the entry, and dedupe concurrent calls from the icon and tile
  generators (`src/model/generators/icon-list-generator.ts:294`,
  `src/model/generators/tiles-generator.ts:169`).
- Keep `/list` only as a fallback if `get_entries` fails.

Tests: `callWS` spy asserts zero `/list` calls and at most one registry call per vacuum per
page; tile/icon snapshots unchanged.

Acceptance: no multi-megabyte registry payload on load; no duplicate calls from the two
generators.

### B8 - Preset rooms and stale room IDs (S verify + M)

- Issue #385: write the preset-switch test first. If the fork's per-image detection already
  refreshes rooms, close it as fixed in the fork with the test as proof. Do not build a second
  mechanism.
- Issue #928: room IDs shift after a map edit, so static ROOM selections can clean the wrong
  room. **Warn, do not silently remap.** Compare configured IDs against the live camera `rooms`
  metadata; mark stale rooms and exclude them from service calls. An optional "use live rooms"
  mode can build selections from metadata. Do not match by name: a rename plus an ID shift
  would silently target the wrong room.

Tests: pure room-config builder with before/after camera fixtures; a stale ID never reaches the
service call. Manual: the second fixture capture from P0d, if a re-map is acceptable.

### B9 - Default map view (S-M, after B6)

Issue #873. Persisted view exists; add a configured default.

- Add `map_view: {scale, x, y, rotation}` used when no stored view exists.
- Add a "reset view" action that returns to it.
- Keep `persist_map_view` and `map_view_storage_key` behaviour unchanged.

Tests: storage fallback unit tests; restore path with a stored and an unset view; Playwright
check that the first render uses the configured view and that a user pan/zoom still wins.

## Phase 3: UX features (only after Phase 2 is stable)

### B10 - Horizontal layout and card height (L)

Issues #183 (67 comments) and #943. Add `layout: vertical | horizontal` plus `getGridOptions`
so the card is resizable in the sections view. Users currently rely on fragile `card-mod` CSS
selectors.

Tests: Playwright screenshots at three widths; resize check in the sections view. #821
(collapse map) may be folded in only if it is nearly free.

## Phase 4: project identity and README

Goal: make this fork clearly a distinct, better-maintained project without breaking existing
dashboards. The card element and release asset names stay stable; this is a project and
repository identity change, not a breaking rename of the Lovelace card.

Working name: **Better Xiaomi Vacuum Map Card**, repository
`lovelace-better-xiaomi-vacuum-map-card`.

### R1 - In-repo rebrand and README rewrite (M, parallel with Phase 2/3)

Compatibility contract:

- Keep the custom element `custom:xiaomi-vacuum-map-card`.
- Keep the release asset `xiaomi-vacuum-map-card.js`.
- Keep existing YAML valid with zero changes.
- Update `package.json`, `hacs.json`, README title, docs titles and issue templates to the new
  project name.

README rewrite, target roughly 150 lines instead of the current upstream manual:

- Hero: project name, one-sentence value proposition, one screenshot or GIF.
- **Why this fork**: upstream issues and PRs left unresolved for a long time; this fork points
  AI agents at them under a test-first, two-model review process; no claims without a test or a
  real fixture.
- **What is better**: a short table of shipped fixes/features linked to `FORK.md`, with honest
  `shipped` / `planned` / `experimental` labels. Do not list unmerged work as shipped.
- **Install**: HACS custom repository and manual install.
- **Migrating from upstream**: same configuration, same element type, only the resource URL
  changes; keep the old card working during the swap.
- **Quick start**: a minimal working YAML block, about 15 lines.
- **Supported platforms**: link to the existing docs instead of reproducing the tables.
- **Maintenance model**: tests and CI gates, Opus 5.5 council review before merge, hardware
  limits stated plainly.
- **Attribution and license**: upstream project, MIT license, link to `FORK.md`; remove the
  upstream author's donation badges and the "HACS Default" badge, which is not true for a fork.
- Move detailed configuration tables out of the README and link to `docs/`; the README is for
  choosing the card, installing it and getting it running.

Verification: markdown link check, the HACS validation workflow, `npm run build`, and a manual
render check. The final manual check is installing from the HACS custom repository on the real
instance.

### R2 - GitHub repository rename and release surface (S, LAST)

- Run `gh repo rename lovelace-better-xiaomi-vacuum-map-card` only after every code batch has
  merged. Renaming earlier breaks the remote of every open PR and worktree.
- Update `origin`, README/badges/docs links, HACS custom repository URL, repository description
  and topics.
- Keep the HACS `filename` and the release asset unchanged. GitHub redirects old URLs, but HACS
  caches custom repository URLs, so the migration note must tell users to re-add the repository.
- Verify: `gh repo view`, HACS validation, a clean install via the new URL, and a published
  release that still attaches `xiaomi-vacuum-map-card.js`.
- Record the rename and the compatibility promise in `FORK.md`.

## Postpone list

| Item | Why postponed | Unblocks when |
|---|---|---|
| #964 Roborock status/battery tiles | Needs a real Roborock-core registry; contract tests cannot prove the regexes | The real instance runs that integration, or a scrubbed fixture is supplied |
| #952 YAML `y:` normalization | Depends on an actual repro on the current HA parser | A config with an unquoted `y:` fails on the real instance |
| #958 beyond the element fallback | The stub only proves the branch, not HA's real element API | Manual check on the current HA |
| #549 templated `predefined_selections` | No concrete case that `state_entity` cannot serve; Jinja subscription is a large change | A real use case and a fixture |
| #503 + #922 static floorplan background | Needs a floorplan, calibration fixture and a decision on transparency/alignment | A concrete floorplan setup |
| #134 rotated zone rectangle | Roborock's zone API is axis-aligned; no evidence the target platform accepts 4 arbitrary points | Vendor documentation or a working integration call |
| #967 + #960 Valetudo icons / JSON map source | Large (945 LOC), platform-specific, no Valetudo instance to verify | Upstream lands it first, or a Valetudo fixture is available |
| #715 + #600 Ecovacs SVG viewbox | Needs an Ecovacs SVG camera fixture | A fixture and an Ecovacs instance |
| #916 delayed start | An HA script or automation does this better; not a map concern | A strong product reason |
| #966 non-admin MQTT | HA policy change, not fixable in the card | Never in-card; at most a documentation note |
| #821 collapse map | Card-mod/conditional-card already does it | Only if free inside B10 |

## Conflict map and parallel work

Hot files: `src/xiaomi-vacuum-map-card.ts`, `src/editor.ts`, `src/config-validators.ts`,
`src/components/tile.ts`, `src/model/generators/tiles-generator.ts`,
`src/model/generators/icon-list-generator.ts`, `src/utils.ts`.

- Sequential: P0a -> P0b.
- Parallel after P0b: B1 (validators), B3 (tiles), B7 (utils/generators) in separate worktrees.
- Sequential because they share `editor.ts` or the main card: B2 -> B5 -> B6 -> B8 -> B9.
- B2 and B1 both touch config types only lightly; land B1 first if there is any overlap.
- B4 waits for B3 and the fixture.
- P0c runs alongside Phase 1 and is required before B10.
- Cherry-pick order inside B2: #956 first, then #944, then the fork cleanup, then #958. All
  three touch `_handleRoomConfig`; applying them out of order creates pointless conflicts.
- R1 (in-repo rebrand) touches README, `hacs.json`, `package.json` and docs only, so it can run
  in parallel with any code batch. It must not change the element name or the release asset.
- R2 (repository rename) is the last step of the whole programme. It changes every remote URL,
  so it cannot overlap an open PR or a worktree that still needs to push.

## Quality gates and definition of done

Required on every PR:

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `npm run check:map-scale`

Required on PRs touching map rendering, scale, rotation or layout: the Playwright visual job.

Definition of done for each batch:

1. A failing test reproduces the bug before the fix (or is added with a cherry-picked fix).
2. All gates are green.
3. `FORK.md` row added or updated: what changed, why, upstream PR/commit, and whether it is a
   cherry-pick or fork-only.
4. `docs/configuration.md` and `docs/platforms.md` updated when user-facing configuration changes;
   the README keeps only the What-is-better table and the migration notes.
5. A one-line manual verification on the real instance, stated in the PR body
   (`verified on HA 2026.x, <integration>`).
6. Map-rendering PRs: zoom 2.5 and rotation 90 checked on the device.
7. No snapshot is updated with `-u` without a sentence in the PR body explaining the diff.

## Immediate next moves

1. **P0a** - move CI to Node 22, add `tsc --noEmit`, regenerate the lockfile, verify the build.
2. **P0d** - capture the real fixture and answer two questions: which vacuum integration and
   platform template are in use, and which Home Assistant version is running. Those answer
   whether B4, #952 and the #958 manual check are in scope now.
3. **P0b** - add Vitest + happy-dom and the harness, then write the first two failing tests:
   the frozen `map_modes` TypeError (#956) and the cross-card room-config leak (#944). Both fail
   on current `master`, which proves the harness catches real bugs before B2 fixes them.
