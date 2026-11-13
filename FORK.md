# Fork scope and upstream differences

This repository is Igloczek's fork of [PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card). Upstream is the baseline; this fork carries the focused Home Assistant fixes and features listed below. Planned upstream carries, fork-only fixes and the testing strategy are in [`ROADMAP.md`](ROADMAP.md).

## Upstream snapshot

Compared on 2026-11-13 after fetching `upstream/master`:

- Upstream baseline: `045c3ac` (`upstream/master`).
- Fork head: `c11bc76` (`master`), 26 commits ahead and 0 commits behind that fetched upstream branch.
- The count includes the upstream PR #949 implementation carried by this fork, fork-specific changes, and this maintenance documentation. Refresh this snapshot whenever upstream is synced.

## Active differences

| Area | Fork behavior and scope | Origin |
| --- | --- | --- |
| Persistent map view and rotation | Carries upstream PR #949's per-card/preset/map view persistence and rotation support. Keep this until equivalent changes land in upstream. | `badf9b2`, `e57bb8d` |
| Rotation controls | The toolbar's manual rotate button is removed. Configured rotation and enabled rotation gestures remain available. | `62e339f` |
| Automatic room mapping | Use camera room IDs/names and map fill colors to create irregular room outlines, label centers, and room hit targets. Manual room definitions remain a fallback when the camera metadata or distinct colors are unavailable. | `5276b9b` |
| Map appearance | Optional near-white transparency and high-contrast room labels support the dark dashboard map. | `5276b9b`, `36b890b` |
| Zoom alignment | Base image scale uses untransformed canvas layout width so zoom/rotation is applied once to the image and overlays. The local regression check covers zoom and rotation. | `2d5d439` |
| Release packaging | The release workflow has `contents: write` permission so it can attach the built card asset to a release. | `1655011` |
| CI validation | HACS validation skips the `issues` check (upstream owns issue tracking) while the fork's repository topics satisfy the `topics` check. The master→dev automerge job requests `contents: write` so `GITHUB_TOKEN` can push. | PR #1 |
| CI baseline | Build, release, HACS and automerge workflows use `actions/checkout@v4`; build and release run Node 22 on `actions/setup-node@v4` with npm caching, and the build job runs `npx tsc --noEmit` before bundling. `package-lock.json` is regenerated as lockfile v3 with every package version unchanged. Upstream still pins Node 14 and has no type-check gate. | PR #2 |
| Test infrastructure | Vitest 3 with happy-dom, the harness under `test/harness/`, synthetic and own-setup fixture locations, `npm test` in CI, and the pure `RoomColorDetector.detectFromImageData` split. The mock registry answers `get_entries` with core's entity-id/`null` map, `withRegistryEntries` derives a hass whose display registry and both registry commands agree, and editor-preview mounts tear down by removing their wrapper so the card's disconnect path runs as in HA. `withoutCustomElement` masks an optional frontend tag for the #958 fallback instead of pretending `stubHaElements` can exclude one. Tests import `src/` directly; the real-instance fixture stays empty until P0d. Upstream has no unit-test harness. | PR #3 |
| Config robustness | Carries upstream PR #937, #940 and #938 so an incomplete configuration produces a validation message instead of an exception: a predefined room without `id` (or a rectangle selection without `zones`) reports the missing field and skips its format/value check, a calibration point without `map`/`vacuum` reports the missing section instead of dereferencing it, and dynamic (entity-backed) predefined rectangles and points that reference a missing entity, missing attribute, `null` value or non-list value are ignored. Valid rooms, calibrations and dynamic selections behave exactly as before. The #938 cherry-pick was resolved by hand against this fork's CRLF copies of `src/utils.ts`, `predefined-multi-rectangle.ts` and `predefined-point.ts`, and its new helper takes the fork's `HomeAssistantFixed` because the tsc gate rejects `custom-card-helpers`' own copy of the websocket types; the change is otherwise upstream's. `config-normalizer.ts` for #952 is intentionally absent until that bug is reproduced on a real HA instance. | upstream #937, #940, #938; PR #4 |
| Tile labels, translations, durations and icons | Tile translations match keys case-insensitively while the emitted value keeps its own casing; an exact lower-case key still wins over an earlier mixed-case one, as before. Tile labels resolve through `hass.formatEntityName` only when the frontend version is at least 2026.4 **and** carries the function, and the call is wrapped so a throw or empty result also falls back. The gate is not optional: 2025.10 through 2026.3 ship the same helper with an incompatible signature, and on 2025.10 the call iterates the `undefined` type argument, which throws `TypeError` inside `Tile.render()` and rejects the tiles promise, leaving tiles and modes unset; those frontends resolve to `friendly_name` and then the entity id instead. The comparison is numeric year.month, not a string compare, so `2026.10` is not mistaken for older than `2026.4` (upstream #957 does the same). The try/catch is fork-only hardening so a future signature change degrades instead of breaking rendering. The `entityNamesChanged` re-render hook is not carried, so a registry-only rename can leave a label stale until the next watched-entity update (open follow-up in `ROADMAP.md`, B3). Platform tile templates accept `duration_unit` (`ms`, `s`, `min`, `h`, `d`) and derive the multiplier from the entity's `unit_of_measurement`; unknown units and attribute-based tiles keep the seconds assumption, templates without it keep their multiplier, and `duration_unit` is stripped from the generated tile config. `return_to_base` uses `mdi:home-import-outline`, matching HA core. #964's Roborock status/battery templates remain postponed. Tile and icon snapshots pin the synthetic fixture output. | #723, #957, #965, #961; fork hardening; PR #6 |

## Scope boundaries

- Keep the fork focused on the differences above and concrete bugs or features with a clear Home Assistant use case. Upstream behavior remains the default elsewhere.
- For this dashboard, automatic room metadata/color detection is the intended path; retain manual room configuration as a compatibility fallback for other integrations.
- Keep the manual rotate button removed unless a user explicitly asks to restore it. Rotation configuration and gestures are separate supported behavior.
- Record a new intentional divergence here when it is implemented. State what it changes, why it exists, what it does not change, and the issue/PR/commit that motivated it.

## Syncing upstream

This checkout has an `upstream` remote. In a fresh clone, configure it with:

```sh
git remote add upstream https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card.git
```

Before syncing, fetch and review both sides of the branch difference:

```sh
git fetch upstream
git log --left-right --cherry-pick --oneline upstream/master...master
git diff --stat upstream/master...master
```

Review upstream changes against the active differences above before merging, rebasing, or cherry-picking. Preserve fork-specific behavior where it still matches the scope. After a sync, update the upstream snapshot and move any upstream-absorbed item out of **Active differences**, recording the upstream commit that superseded it.
