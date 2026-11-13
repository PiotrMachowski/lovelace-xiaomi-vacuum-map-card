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
| Test infrastructure | Vitest 3 with happy-dom, the harness under `test/harness/`, synthetic and own-setup fixture locations, `npm test` in CI, and the pure `RoomColorDetector.detectFromImageData` split. Tests import `src/` directly; the real-instance fixture stays empty until P0d. Upstream has no unit-test harness. | PR #3 |

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
