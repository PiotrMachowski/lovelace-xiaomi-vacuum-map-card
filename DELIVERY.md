# Delivery tracking

Execution tracker for [`ROADMAP.md`](ROADMAP.md). One row per batch. Updated after every merge so
progress is visible without reading the PR list.

Status values: `planned` · `in progress` · `review` · `merged` · `postponed` · `blocked`.
A batch is only `merged` when CI is green, the delivery review passed, and the council (Claude
Opus 5.5) returned `VERDICT: APPROVE` on the PR.

## Batches

| Batch | Scope | Status | PR | Council | Merge SHA | Blocker |
|---|---|---|---|---|---|---|
| P0a | Node 22 CI, `actions/checkout@v4`, lockfile v3, `tsc --noEmit` in CI | merged | [#2](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/2) | APPROVE (round 2) | `deb2555` | - |
| P0b | Vitest 3 + happy-dom harness, fixtures, `detectFromImageData`, first two failing tests, `npm test` in CI | merged | [#3](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/3) | APPROVE (round 2) | `4a0dcc9` | - |
| P0c | Playwright visual harness (separate job, `visual` label) | merged | [#7](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/7) | APPROVE (round 2) | `683c07a` | - |
| P0d | Real-HA fixture and integration test | merged | [#17](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/17) | under review | - | replaced by the synthetic fixture + `test/e2e`; no user capture needed |
| B1 | Config robustness (#937, #940, #938; #952 postponed) | merged | [#4](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/4) | APPROVE | `a8b3a39` | - |
| B2 | Editor room-config path (#956, #944, duplicate cleanup, #958) | merged | [#5](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/5) | APPROVE (round 3) | `c8042b9` | - |
| B3 | Tiles, labels and icons (#723, #957, #965, #961) | merged | [#6](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/6) | APPROVE (round 2) | `6fe6307` | - |
| B4 | Roborock status/battery templates (#964) | postponed | - | - | - | needs a real Roborock-core registry fixture |
| B5 | Cleaning-order badges (#959) | merged | [#10](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/10) | APPROVE (round 3) | `f3a27f1` | - |
| B6 | Map refresh policy (#704, #357) | merged | [#11](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/11) | APPROVE (round 2) | `03a9420` | - |
| B7 | Registry payload and caching (#864) | merged | [#8](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/8) | APPROVE (round 2) | `5939551` | - |
| B8 | Preset rooms and stale room IDs (#385, #928) | merged | [#12](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/12) | APPROVE (round 2) | `09ebc6e` | - |
| B9 | Default map view (#873) | merged | [#13](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/13) | APPROVE (round 2) | `a4477c5` | end-to-end verified |
| B10 | Horizontal layout and card height (#183, #943) | merged | [#14](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/14) | APPROVE (round 2) | `ceacbdd` | end-to-end verified |
| R1 | In-repo rebrand and README rewrite | merged | [#15](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/15) | APPROVE (round 3) | `6433e8c` | end-to-end verified |
| R2 | GitHub repository rename and release surface | merged | [#16](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/16) | APPROVE | `70ebe0d` | install from the new URL verified |

## Delivery fixes that are not roadmap batches

| Fix | Why | PR | Council | Merge SHA |
|---|---|---|---|---|
| Deterministic test gate: cancelling delayed card work on disconnect | The 100 ms delayed update could outlive the element and throw `ReferenceError: window is not defined` after happy-dom teardown (~1 in 15 runs), reddening an otherwise green build. Also finishes a cancelled 300 ms transition reset and defers a map-image load that lands while detached. | [#9](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/9) | APPROVE (round 3) | `966d348` |

## Final state

All roadmap batches that do not depend on hardware are merged. The card element
(`custom:xiaomi-vacuum-map-card`), the release asset (`xiaomi-vacuum-map-card.js`), the HACS
`filename` and every existing YAML key are unchanged: this was a project and repository identity
change, not a card rename.

- Repository: [Igloczek/lovelace-better-xiaomi-vacuum-map-card](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card)
  (renamed from `Igloczek/lovelace-xiaomi-vacuum-map-card`; the old URLs redirect with 301).
- Latest release: [`v2.5.0-igloczek.1`](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/releases/tag/v2.5.0-igloczek.1),
  the first release containing every shipped row; it attaches `xiaomi-vacuum-map-card.js`.
- Pull requests: [#2](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/2) P0a,
  [#3](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/3) P0b,
  [#7](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/7) P0c,
  [#4](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/4) B1,
  [#5](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/5) B2,
  [#6](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/6) B3,
  [#10](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/10) B5,
  [#11](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/11) B6,
  [#8](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/8) B7,
  [#12](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/12) B8,
  [#13](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/13) B9,
  [#14](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/14) B10,
  [#15](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/15) R1,
  [#16](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/16) R2, and
  [#9](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/9) the gate fix.
- Every PR was merged with a merge commit after green CI and an independent Claude Opus 5.5 council
  verdict; the verdict is recorded as a PR comment on each one.
- An audit-polish commit after R2 applied four documentation and metadata notes from the last council
  review (npm `author` person format, README migration grammar, the "keep only one resource entry"
  warning, and the repository homepage). No behaviour change; gates re-run green.

## Postponed

Exactly the items in [`ROADMAP.md`](ROADMAP.md#postpone-list), with the reason recorded there:
#964 (Roborock status/battery tiles), #952 (YAML `y:` normalization), #958 beyond the element
fallback, #549 (templated `predefined_selections`), #503 + #922 (live path overlay on a static floorplan),
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
| #949 | Persistent map view and map rotation | carried before this programme | merged before batch work (`badf9b2`); recorded in FORK.md |
| #939 | Watch the current preset's entities rather than a fixed entity | - | considered; no change needed — the fork already resolves the current preset correctly |
| #843 | Map rotation follow-up | - | grouped under #949 |
| #771 | Multiple vacuums / room-config answers | - | grouped under #944 (B2) |
| #932 | Frozen `map_modes` when generating rooms | - | grouped under #956 (B2) |
| #908 | Roborock status/battery tiles | - | grouped under #964 (B4, postponed) |
| #878, #857, #963 | Roborock duration/unit tiles | - | grouped under #965 (B3) |
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
| #959 | Cleaning-order badges on selected rooms | B5 | merged, PR #10 |
| #704 + #357 | Camera snapshot request storm / constant map reloads | B6 | merged, PR #11 |
| #864 | Whole entity registry downloaded, then `/get` per entity | B7 | merged, PR #8 |
| #385 | Preset switch does not refresh rooms | B8 | merged, PR #12 — closed as already fixed, proven by a same-camera refresh test |
| #928 | Room IDs shift after a map edit | B8 | merged, PR #12 |
| #873 | Configured default map view | B9 | merged, PR #13 |
| #183 + #943 | Horizontal layout and card height | B10 | merged, PR #14 — #821 collapse-map declined as not nearly free |
| #549 | Templated `predefined_selections` | - | postponed: no concrete case; Jinja subscription is a large change |
| #503 + #922 | Live path overlay on a static floorplan | - | postponed: a static image already works as the map source (`map_source.image` + `transparent_background`); only the live path overlay is missing |
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

Every follow-up is either resolved or explicitly accepted. Nothing in this table is open silently.

| Follow-up | Disposition | Reason or evidence |
|---|---|---|
| Flaky Vitest gate (`ReferenceError: window is not defined` after happy-dom teardown) | **Resolved** | Fixed by PR [#9](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/9) (`966d348`): delayed card work is cancellable on disconnect, the transition reset is finished, and a detached map load is replayed on re-attach. Three council rounds; 20 consecutive local runs with no unhandled errors, and the regression test is red on master. |
| `#957` `entityNamesChanged` re-render hook not carried | **Accepted** | Cost: a device, area or floor rename does not refresh tile labels until the next watched-entity update. Recorded in `src/entity-name.ts`, `FORK.md` and ROADMAP B3. Implementing it is a card `shouldUpdate` change plus tests, i.e. new code scope after the final audit. |
| Null YAML key validator gap (`id:` / `map:` without a value parses to `null`) | **Accepted** | Upstream has the same gap. Fixing it means changing the cherry-picked validator logic and adding tests — new code scope. Impact is narrow (an empty YAML value produces a card error rather than a clear validation message); it is the first candidate for the next code batch. |
| Visual workflow has no `concurrency` group | **Accepted** | A duplicate run only costs CI minutes and happens when a second label is added to an already `visual`-labelled PR. Adding it is a workflow change outside a documentation audit. |
| `test/visual/README.md` overstated the numeric overlay check | **Resolved** | The README now says the numeric check covers the detected outline and calibration conversion, that `getBBox()/realScale` cancels base-scale errors and ignores zoom/rotation, and that the screenshots are the guard for alignment; the 0.75 px tolerance admits a 1 layout-px drift by design. |
| Registry **icon** edits stay cached until reload | **Accepted** | Cosmetic: the cache key covers which entities exist, not their contents, so a changed sensor `icon` appears after a reload where master picked it up on rebuild. Adding the icon to the key is a one-line change for the next code batch. |
| Harness display registry includes disabled entries (core excludes them) | **Accepted** | Test-harness fidelity only, no production impact; the enable-a-disabled-sensor path was probed by hand during B7. Filtering `disabled_by` in `toDisplayRegistry` would let a regression test cover it directly. |
| Trailing map refresh: two branches have no test of their own (pending-flag reset on disconnect, hidden check inside the callback) | **Accepted** | Both behaviours were probed by the B6 council (disconnect while a refresh is pending clears the flag and leaves no timers; a pending timer firing while hidden does nothing). Low risk, and the card file is no longer being edited; add the tests when it is next touched. |
| Coarse `Date.now()` rounding can re-render at 0 ms at the interval boundary | **Accepted** | Bounded and cheap: at most a no-op re-render per boundary on browsers that round the clock (Firefox anti-fingerprinting, ~100 ms). A 1 ms minimum delay would remove it. |
| Template-only mode without colour detection can show a selected room with a badge while sending nothing and warning nothing | **Accepted** | Safe — no stale id reaches the service call (proven in B8) — but silent to the user. Fixing the feedback needs a warning for metadata-derived ids, i.e. new card code. |
| Stale-room `!` marker overlaps the live room label in `stale-room-hit-test.png` | **Accepted** | Cosmetic in a test baseline; the warning text is the primary signal and the overlap disappears once the config is regenerated. Fading or hiding the stale icon is a cheap visual improvement. |
| `map_view.reset` fired while the card is connected but hidden | **Accepted** | Narrow: `_centreConfiguredView` falls back to top-left anchoring only when the map has no measurable size, which requires a reset while hidden; the persisted view would then be that fallback. Deferring the reset or skipping the save would close it. |
| Two-width centring for a configured `map_view` is proven by a browser probe, not a committed Playwright case | **Accepted** | Proven twice by council probes (400 px `-100,-74.5`; 800 px `-200,-149.5`) plus the happy-dom test at one width. Add the second width when the visual suite is next extended. |

## Final audit evidence

Checked on master at `4a24b23` on 2026-11-14 (the audit commit; `6a32a8e` is the commit before it):

- **Council verdicts.** Every batch pull request (#2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12,
  #13, #14, #15, #16) carries a comment recording `VERDICT: APPROVE` from the independent Claude
  Opus 5.5 council; each PR page contains exactly one such verdict comment, and the rounds that
  required changes are recorded above it in the same comment.
- **Merge provenance.** Every merge commit is an ancestor of master: `deb2555` P0a, `4a0dcc9` P0b,
  `683c07a` P0c, `a8b3a39` B1, `c8042b9` B2, `6fe6307` B3, `f3a27f1` B5, `03a9420` B6, `5939551`
  B7, `09ebc6e` B8, `a4477c5` B9, `ceacbdd` B10, `966d348` gate fix, `6433e8c` R1, `70ebe0d` R2
  (all verified with `git merge-base --is-ancestor`).
- **CI.** The latest master runs at `4a24b23` are green: Build, Validate HACS and the master→dev
  automerge job. The `workflow_dispatch` Visual (Playwright) run is green at `6a32a8e`; the two
  commits after it change only `DELIVERY.md` and `test/visual/README.md`, which the visual suite does
  not load.
- **Release.** `v2.5.0-igloczek.1` is published (not a draft or prerelease), targets `6196002`, and
  attaches `xiaomi-vacuum-map-card.js` (484,990 bytes, state `uploaded`); the asset download returns
  the file and the old repository URLs redirect with 301.
- **Identity.** `gh repo view` reports `Igloczek/lovelace-better-xiaomi-vacuum-map-card` with the
  fork description, topics, enabled issues and the README homepage; `hacs.json` keeps
  `filename: xiaomi-vacuum-map-card.js`; `package.json` points `repository`, `homepage` and `bugs` at
  the fork with the maintainer as `author` and upstream credited under `contributors`; the README,
  `docs/configuration.md` and `docs/platforms.md` are the rewritten fork documentation.

## End-to-end verification owned by delivery

Nothing in this project is verified by the user. A real Home Assistant runs in Docker, the card is
installed the way a user installs it, and a Playwright suite drives the real frontend. The suite
proves the behaviours it lists below; it does not cover every shipped feature, so the table says what
is proven and what is not. Anything that cannot be reproduced stays postponed with its reason instead
of becoming a task for the owner.

### Environment

- Home Assistant **2026.11.0**, pinned in `test/e2e/compose.yaml`, with a test-only camera fixture
  (`test/e2e/ha/config/custom_components/map_fixture`) that serves the committed synthetic map,
  counts every image request, exposes the `rooms` metadata the card reads, and can push a new map.
- The card is installed from `https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card`
  through Home Assistant's own installer (`test/e2e/marketplace-install.cjs`), which registers the
  Lovelace resource the suite then loads.
- Home Assistant 2026.11 ships the core **marketplace** integration, and it removes a HACS config
  entry as a duplicate (`Removing duplicate configuration entry …` in the log). HACS therefore cannot
  run on this version; Marketplace is the current equivalent, and the card's `hacs.json` metadata is
  unchanged and still validated by the HACS action in CI for releases that use HACS.

### Evidence (real Home Assistant, installer-created build)

Every row is a spec in `test/e2e/specs/` and passes against the installed artifact. Screenshots are
committed under [`docs/evidence/e2e/`](docs/evidence/e2e).

| Verification | Proves | Evidence |
|---|---|---|
| Card render | The card renders from the installed Lovelace resource against a real camera entity, with the committed map decoded. | `render.spec.ts`, [dashboard](docs/evidence/e2e/01-real-dashboard.png) |
| Card editor | The visual editor opens in edit mode, the Title field is the real `ha-input` this frontend provides, typing reaches the config, and **Generate rooms config** produces rooms from the camera metadata with no page error. | `editor.spec.ts`, [title](docs/evidence/e2e/13-editor-title.png), [generated rooms](docs/evidence/e2e/14-editor-generated-rooms.png) |
| Default map view (#873) | `map_view` opens the configured view, a gesture changes it, the reset control returns to it, and the view survives a reload. | `map-view.spec.ts`, [reset](docs/evidence/e2e/03-map-view-reset.png), [persisted](docs/evidence/e2e/04-map-view-persisted.png) |
| Horizontal layout (#183/#943) | In a real **sections** view the map sits beside the controls, a long mode name ellipsizes with no sideways overflow, and changing the card's grid options (what the resize handle causes) resizes the card; the vertical layout stays stacked. A real drag of the resize handle is not automated. | `layout.spec.ts`, [horizontal](docs/evidence/e2e/05-layout-horizontal-1280.png), [narrow cell](docs/evidence/e2e/06-layout-horizontal-cell-6.png), [vertical](docs/evidence/e2e/09-layout-vertical.png) |
| Zoom 2.5 + rotation 90 | At 2.5x and 90 degrees, screenshot pixels inside each outline are the room colour and pixels beyond it are not (so a shifted overlay fails), and clicking each outline selects that room. | `zoom-rotation.spec.ts`, [screenshot](docs/evidence/e2e/10-zoom-2-5-rotation-90.png) |
| Camera request rate (#704/#357) | Inside the refresh window, vacuum state changes cause no snapshot request; at most one interval refresh lands; a camera change causes exactly one; a hidden tab causes none; becoming visible again causes one. The hidden state is simulated by overriding `document.hidden`. | `camera-rate.spec.ts`, [screenshot](docs/evidence/e2e/11-camera-rate.png) |
| YAML `y:` (#952) | A YAML dashboard with an unquoted `y:` key applies the offset, so Home Assistant 2026.11 does not reproduce the boolean-key bug. | `yaml-y-key.spec.ts`, [screenshot](docs/evidence/e2e/12-yaml-y-key.png) |
| Install from the repository URL | Home Assistant's installer registers the repository, installs the release asset and creates the Lovelace resource. | `marketplace-install.cjs` |

### Reproducing it

```sh
npm run build
docker compose -f test/e2e/compose.yaml up -d
node test/e2e/setup.cjs
GITHUB_TOKEN=... node test/e2e/connect-github.cjs --restart   # Marketplace needs a GitHub account
node test/e2e/marketplace-install.cjs                          # proves the install path
node test/e2e/install-local-build.cjs                          # behaviour specs run this checkout's build
npm run test:e2e
```

The Marketplace install proves the shipped release; the local overlay then puts the branch build in
front of the behaviour specs, including removing the installer's pre-compressed siblings, which Home
Assistant would otherwise serve instead of the new file. The suite needs Docker and is not part of the
pull-request CI job; a release is only published after it passes.

### Batch status after this evidence

| Batch | Previous blocker | Now |
|---|---|---|
| P0d real fixture | "needs the user's HA instance" | **Replaced**: the committed synthetic fixture plus this real-HA suite. The owner's own vacuum data is no longer a release criterion; capturing it later would be an optional extra. |
| B2 editor (#955/#958) | real HA element API unproven | **Verified** on 2026.11: `ha-input` is what the frontend provides and renders, and generate-rooms fills an empty ROOM mode through Home Assistant's edit dialog. The suite also found a real editor defect: 2026.11 no longer defines `ha-formfield`, so the four switch labels were invisible; fixed with a labelled fallback and covered by a Vitest test and the e2e spec. |
| B6 refresh policy | request rate unproven | **Verified** with the counting camera fixture, including the hidden tab. |
| B9 map view | real dashboard unproven | **Verified**: open, reset and persist on a real dashboard. |
| B10 layout | real sections view unproven | **Verified**, including a resized cell and a long mode name. |
| R1 rebrand | README/release story unproven | **Verified** through the Marketplace install from the renamed repository URL; the README is checked by the offline link checker, which is CI-gated, and rendering it on GitHub itself is not part of the suite. |
| R2 rename | install from the new URL unproven | **Verified** by installing from `Igloczek/lovelace-better-xiaomi-vacuum-map-card`. |
| B1 / #952 | repro on the current parser needed | **Closed as not reproducible**: the YAML test proves `y:` is applied on 2026.11, so no normalizer is needed. |
| B4 Roborock templates | real registry needed | **Still postponed**: the fixture requires the Roborock integration's runtime registry; deriving unique_id patterns from its source would not prove the device reports them. No user action is requested. |

### Still not covered by the suite

These are not user tasks; they are limits of a headless, hardware-free environment, and none of them
gates the shipped rows above:

- The HACS UI install. Home Assistant 2026.11 blocks the HACS integration and migrates to Marketplace;
  the suite proves Marketplace and the manual asset path, and CI validates the HACS metadata.
- Roborock status/battery templates (B4): needs the integration's runtime registry and the device.
- A real drag of the sections resize handle (the grid-options write it performs is covered) and
  scrolling on a phone.
- A second camera capture after a re-map for B8: stale ids are covered by unit and DOM tests with
  before/after fixtures, but the suite does not perform a real re-map.
- `map_view` at `{scale: 2.5, rotation: 90}` on the default-map-view card and the `map_view.reset`
  action: the suite covers `{scale: 2}, rotation 0` plus the toolbar reset, and rotation 90 is
  covered separately by the zoom/rotation spec.
