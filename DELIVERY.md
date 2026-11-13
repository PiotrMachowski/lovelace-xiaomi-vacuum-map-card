# Delivery tracking

Execution tracker for [`ROADMAP.md`](ROADMAP.md). One row per batch. Updated after every merge so
progress is visible without reading the PR list.

Status values: `planned` · `in progress` · `review` · `merged` · `postponed` · `blocked`.
A batch is only `merged` when CI is green, the delivery review passed, and the council (Claude
Opus 5.5) returned `VERDICT: APPROVE` on the PR.

## Batches

| Batch | Scope | Status | PR | Council | Merge SHA | Blocker |
|---|---|---|---|---|---|---|
| P0a | Node 22 CI, `actions/checkout@v4`, lockfile v3, `tsc --noEmit` in CI | merged | [#2](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/2) | APPROVE (round 2) | `deb2555` | - |
| P0b | Vitest 3 + happy-dom harness, fixtures, `detectFromImageData`, first two failing tests, `npm test` in CI | merged | [#3](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/3) | APPROVE (round 2) | `4a0dcc9` | - |
| P0c | Playwright visual harness (separate job, `visual` label) | merged | [#7](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/7) | APPROVE (round 2) | `683c07a` | - |
| P0d | Capture the real Home Assistant fixture | blocked | - | - | - | needs the user's HA instance (see Manual checks) |
| B1 | Config robustness (#937, #940, #938; #952 postponed) | merged | [#4](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/4) | APPROVE | `a8b3a39` | - |
| B2 | Editor room-config path (#956, #944, duplicate cleanup, #958) | merged | [#5](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/5) | APPROVE (round 3) | `c8042b9` | - |
| B3 | Tiles, labels and icons (#723, #957, #965, #961) | merged | [#6](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/6) | APPROVE (round 2) | `6fe6307` | - |
| B4 | Roborock status/battery templates (#964) | postponed | - | - | - | needs a real Roborock-core registry fixture |
| B5 | Cleaning-order badges (#959) | in progress | - | - | - | - |
| B6 | Map refresh policy (#704, #357) | in progress | - | - | - | - |
| B7 | Registry payload and caching (#864) | merged | [#8](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/8) | APPROVE (round 2) | `5939551` | - |
| B8 | Preset rooms and stale room IDs (#385, #928) | planned | - | - | - | after B6 |
| B9 | Default map view (#873) | planned | - | - | - | after B8 |
| B10 | Horizontal layout and card height (#183, #943) | planned | - | - | - | after B9 and P0c |
| R1 | In-repo rebrand and README rewrite | planned | - | - | - | after code batches |
| R2 | GitHub repository rename and release surface | planned | - | - | - | last, after every code PR merges |

## Delivery fixes that are not roadmap batches

| Fix | Why | PR | Council | Merge SHA |
|---|---|---|---|---|
| Deterministic test gate: cancelling delayed card work on disconnect | The 100 ms delayed update could outlive the element and throw `ReferenceError: window is not defined` after happy-dom teardown (~1 in 15 runs), reddening an otherwise green build. Also finishes a cancelled 300 ms transition reset and defers a map-image load that lands while detached. | [#9](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/9) | APPROVE (round 3) | `966d348` |

## Postponed

Exactly the items in [`ROADMAP.md`](ROADMAP.md#postpone-list), with the reason recorded there:
#964 (Roborock status/battery tiles), #952 (YAML `y:` normalization), #958 beyond the element
fallback, #549 (templated `predefined_selections`), #503 + #922 (static floorplan background),
#134 (rotated zone rectangle), #967 + #960 (Valetudo icons / JSON map source), #715 + #600
(Ecovacs SVG viewbox), #916 (delayed start), #966 (non-admin MQTT), #821 (collapse map).

The references above are upstream GitHub issue and pull-request numbers. Earlier revisions of this
file quoted an internal backlog numbering that did not correspond to GitHub; it has been corrected.

## Coverage matrix

One row per upstream item considered for this fork, mapped to the batch that owns it and its
status. Programme batches with no upstream item (P0a, P0b, P0c, R1, R2) are tracked in the batch
table above; P0d is a user-captured fixture, not an upstream item.

| Upstream | Scope | Batch | Status |
|---|---|---|---|
| #937 | Validation crash: predefined selection without `id`/`zones` | B1 | merged, PR #4 |
| #940 | Validation crash: incomplete calibration point | B1 | merged, PR #4 |
| #938 | Invalid dynamic predefined selections throw | B1 | merged, PR #4 |
| #952 | YAML 1.1 unquoted `y:` normalization | B1 | postponed: no repro on the real parser |
| #956 | Frozen `map_modes` mutation in the room config generator | B2 | merged, PR #5 |
| #944 | Room-config events not scoped to the requesting card | B2 | merged, PR #5 (extended with camera + request id) |
| #958 | Editor text fields on frontends without `ha-textfield` | B2 | merged, PR #5 (fallback order reversed; real frontend element API still a manual check) |
| #723 | Tile translations lower-case the value but not the keys | B3 | merged, PR #6 |
| #957 | Resolve tile labels via `hass.formatEntityName` | B3 | merged, PR #6 (the `entityNamesChanged` re-render hook is an open follow-up) |
| #965 | Duration tiles for sensors reporting hours/minutes | B3 | merged, PR #6 |
| #961 | `return_to_base` icon matches Home Assistant core | B3 | merged, PR #6 |
| #964 | Roborock status/battery tile templates | B4 | postponed: needs a real Roborock-core registry |
| #959 | Cleaning-order badges on selected rooms | B5 | in progress |
| #704 + #357 | Camera snapshot request storm / constant map reloads | B6 | planned |
| #864 | Whole entity registry downloaded, then `/get` per entity | B7 | merged, PR #8 |
| #385 | Preset switch does not refresh rooms | B8 | planned (verify first; may already be fixed by the fork) |
| #928 | Room IDs shift after a map edit | B8 | planned |
| #873 | Configured default map view | B9 | planned |
| #183 + #943 | Horizontal layout and card height | B10 | planned |
| #549 | Templated `predefined_selections` | - | postponed: no concrete case; Jinja subscription is a large change |
| #503 + #922 | Static floorplan background | - | postponed: needs a floorplan, calibration fixture and alignment decision |
| #134 | Rotated zone rectangle | - | postponed: Roborock zone API is axis-aligned |
| #967 + #960 | Valetudo icons / JSON map source | - | postponed: large, platform-specific, no Valetudo instance |
| #715 + #600 | Ecovacs SVG viewbox | - | postponed: needs an Ecovacs SVG camera fixture |
| #916 | Delayed start | - | postponed: an HA script or automation does this better |
| #966 | Non-admin MQTT | - | postponed: HA policy change, not fixable in the card |
| #821 | Collapse map | - | postponed: only if free inside B10 |
| #411 | Unable to press Start on Tizen Browser | - | skipped: not scheduled in ROADMAP; no batch assigned |
| #454 | Remove support for the `miio2` integration | - | skipped: removal is a breaking change with no benefit for this dashboard |
| #861 | Proposed calibration documentation changes | - | skipped: documentation PR, not carried; docs move to `docs/` in R1 |
| #955 | Revise coordinate-retrieval setup steps | - | skipped: documentation PR, not carried; docs move to `docs/` in R1 |
| #953 | Serbian (Latin) translation | - | skipped: translation PR, orthogonal to this fork's scope |
| #962 | `moriceh/jonr-vac` platform (JONR P20 Pro) | - | skipped: no fixture or device to verify the templates |
| #927 | Viomi SE integration update and templates | - | skipped: no fixture or device to verify the templates |
| #796 | Honiture Q6 Pro | - | skipped: no fixture or device |
| #842 | Eufy RoboVac | - | skipped: no fixture or device |
| dependabot PRs | Dependency bumps opened against upstream | - | skipped: dependency upgrades stay with upstream; this fork pins its own toolchain |

## Follow-ups discovered during delivery

| Item | Blocks a batch? | Owner |
|---|---|---|
| `#957`'s `entityNamesChanged` re-render hook was not carried with the `formatEntityName` fallback, because it lives in the card file that B2 owned. Without it a registry-only rename can leave a tile label stale until an unrelated entity update. | No | B3 follow-up, once B2 has merged |
| `mountEditor` attaches the editor before setting `hass` (unlike `mountCard`). Harmless today; worth aligning when the editor harness is next touched. | No | B2 |
| `withoutCustomElement` masks `customElements.get` only; the element still upgrades if something renders it. B2 must assert on the rendered tag name. | No | B2 |
| An empty YAML key still crashes validation: `id:` with no value parses to `null`, passes the `=== undefined` check and throws on `null.toString()`; `map:` left empty does the same because `p !== undefined` lets `null` through. Upstream has the same gap, so patching it inside a cherry-pick would break the carry rule. | No | fork-only fix after the Phase 1 wave, with tests for `null` and the `#938` cases the council probed (native-list attribute, `null` value, non-list JSON) |
| `test/visual/README.md` and the spec comment overstate the numeric overlay check: dividing by `realScale` cancels base-scale errors and `getBBox()` ignores the zoom/rotation transforms, so a base-scale regression is caught only by the screenshots. Fix the wording (and consider tightening the 0.75 px tolerance to ~0.1). | No | audit pass / R1 docs |
| The visual workflow has no `concurrency` group, so a second label added to a `visual` PR starts a duplicate run. | No | audit pass |
| The visual README regenerate command replaces the host `node_modules` with Linux binaries; it should say to re-run `npm ci` on the host afterwards. | No | audit pass / R1 docs |
| Registry **icon** edits are cached: the key covers which entities exist, not their contents, so a changed sensor `icon` persists until reload where master picked it up on rebuild (cosmetic). Adding the entity icon to the cache key would close it. | No | audit pass |
| The harness display registry includes disabled entries while core's excludes them, so the enable-a-disabled-sensor path can only be tested by editing `hass.entities` by hand. | No | audit pass (harness) |
| **Flaky Vitest gate** (high priority): `_updateElements` schedules an uncancelled `delay(100).then(...)`; after happy-dom teardown the callback throws `ReferenceError: window is not defined` in `_restoreMapView`, which reddened one P0c Build run. Reproduced locally: **1 in 15** `npm test` runs (unhandled rejection at `src/xiaomi-vacuum-map-card.ts:1565` `_getMapViewDashboardPath` via `_restoreMapView`, after the test environment is torn down; Vitest exits non-zero, so the gate can go red on an otherwise green branch). Fix: track the timer in the card and cancel it in `disconnectedCallback`, plus a test that disconnects before the delay elapses. | No (but flaky gates are not acceptable long-term) | the batch that next touches the card (B6), or a small dedicated PR once B2 merges |

## Manual checks owed by the user

| Check | Batch | Why it cannot be automated here |
|---|---|---|
| Capture the real fixture (vacuum + camera state, registry dump, map PNG) | P0d | Needs the running Home Assistant instance and the real token |
| Editor Title field on the current HA frontend | B2 (#958) | A stub only proves the branch, not HA's real element API |
| Status text for Roborock sensor tiles | B4 | Needs the real Roborock-core integration; batch postponed |
| Unquoted `y:` YAML parse | B1 (#952) | Needs a repro on the current HA parser; batch item postponed |
| At most one camera request per interval while cleaning | B6 | Needs DevTools against the real camera |
| Zoom 2.5 / rotation 90 on the device | any map-rendering PR | Real dashboard rendering |
| Second camera capture after a re-map (room ID drift) | B8 | Needs an acceptable re-map on the real instance |
| Install from the HACS custom repository | R1/R2 | Needs the real HACS instance |
| Clean install from the renamed repository URL | R2 | Needs HACS cache behaviour on the real instance |
