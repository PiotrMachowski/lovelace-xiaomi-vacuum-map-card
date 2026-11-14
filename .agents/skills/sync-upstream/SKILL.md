---
name: sync-upstream
description: Import PiotrMachowski/lovelace-xiaomi-vacuum-map-card changes into this fork while preserving every intentional difference recorded in FORK.md. Use for upstream merges, cherry-picks, snapshot imports, conflict resolution, or refreshing the upstream snapshot.
---

# Sync upstream into this fork

This is a feature fork, not a removal fork. Upstream is the baseline; this fork carries focused
Home Assistant fixes and features. Never overwrite a documented difference just because an upstream
change merged cleanly.

Read these before touching the tree:

1. [`FORK.md`](../../../FORK.md) — the authoritative list of active differences and the upstream
   snapshot. Every row in **Active differences** is a preservation criterion.
2. [`fork-differences.md`](fork-differences.md) — the sync checklist: each area mapped to the files
   that implement it and the test that proves it.
3. [`AGENTS.md`](../../../AGENTS.md) — repository rules, map geometry, local checks.

The compatibility promise is permanent unless the maintainer explicitly changes it: the element
`custom:xiaomi-vacuum-map-card`, the release asset `xiaomi-vacuum-map-card.js`, the HACS
`filename` and every existing YAML key stay exactly as they are.

## 1. Preflight

Start clean and record the exact fork state:

```sh
git status --short
git fetch upstream
git fetch origin
pre=$(git rev-parse HEAD)
upstream_sha=$(git rev-parse upstream/master)
git log --oneline "$pre..$upstream_sha"
git diff --stat "$pre...$upstream_sha"
git diff --name-only "$pre...$upstream_sha"
```

If the worktree is dirty, stop and commit, stash or move the work elsewhere. Do not sync on top of
unrelated changes.

Map the changed files to the areas in `fork-differences.md`. For every affected area, open the
current implementation and record its pre-sync behaviour in notes outside the worktree. This is the
comparison baseline after the merge.

Create a dedicated branch from the fork's current `master`:

```sh
git switch -c "sync/upstream-$(date +%Y%m%d)" origin/master
```

Never merge upstream directly into `master`, and never rebase published fork commits. Sync on the
branch, verify, and open a pull request.

## 2. Import strategy

Prefer a merge that keeps upstream history and the merge base:

```sh
git merge --no-ff -m "Merge upstream $upstream_sha" "$upstream_sha"
```

Use `upstream/master` unless the maintainer names a different revision. Upstream's `master` and
`dev` can differ; check both before assuming a branch.

If the request is a single upstream pull request or commit, carry it with its provenance:

```sh
git cherry-pick -x "$commit"
```

If history is unusable and a snapshot import is requested, copy upstream into a temporary directory,
compare it with the fork, and apply the changes deliberately. A snapshot is never permission to
overwrite unrelated local work, tests, docs, or this skill.

Do not merge upstream's `dev` into this fork's `master` just because `dev` is ahead; this fork
tracks `master` and records the upstream baseline in `FORK.md`.

## 3. Resolve conflicts by preserving the fork behaviour

For every conflict:

1. Find the area in `FORK.md` and `fork-differences.md`.
2. Read both sides. Keep the upstream improvement and reapply the fork behaviour around it.
3. Never choose one entire side with `git checkout --theirs` or `--ours` unless the conflict is
   already fully understood and the other side is provably obsolete.
4. Never delete a fork regression test, a `FORK.md` row, a documentation anchor or this skill to
   make the merge pass.
5. If upstream now implements the same behaviour, compare semantics and prove equivalence with the
   tests. Only then remove the fork divergence, move the row to **Superseded differences** in
   `FORK.md`, and record the upstream commit.

Shared files are the normal case, not the exception. Reapply fork changes to:

- `src/xiaomi-vacuum-map-card.ts` and `src/card/` — upstream keeps the whole card in one file; the
  fork splits it into `src/card/*.ts` modules (see the [card module layout](../../../FORK.md#card-module-layout)
  row). Port an upstream change to that file into the module that owns the code it touches, matching
  methods by name without the leading underscore (`_restoreMapView` → `map-view.ts`
  `restoreMapView(card)`). Map view/rotation, automatic room mapping, map refresh policy, stale-room
  guards, default view, layout and disconnect cleanup all live there.
- `src/editor.ts` — room-config scoping and idempotency, `ha-input` fallback, editor teardown.
- `src/model/` — `map-view-store.ts`, `map-refresh-policy.ts`, `room-config.ts`,
  `room-color-detector.ts`, `map-scale.ts`, room map objects.
- `src/entity-registry.ts`, `src/config-validators.ts`, `src/components/tile.ts`,
  `src/model/generators/`, platform templates.
- `.github/workflows/`, `package.json`, `hacs.json`, `README.md`, `docs/`, `FORK.md`.

## 4. Verify

Run the full local gate set:

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run check:map-scale
npm run check:docs
```

Run the affected proofs from [`fork-differences.md`](fork-differences.md). For map, room, zoom,
rotation, layout or visual changes, run the Playwright visual suite:

```sh
npm run test:visual
```

When the real-Home-Assistant environment from PR #17 is present, run the end-to-end suite:

```sh
npm run test:e2e
```

Then audit the diff against the pre-sync notes:

```sh
git diff --stat "$pre...HEAD"
git diff --check
```

Look for accidental upstream overwrites, deleted tests, renamed element/asset names, reverted Node
or lockfile changes, lost README identity, and `FORK.md` rows that disappeared. A clean merge is not
proof of preserved behaviour; the tests are.

## 5. Update FORK.md

In the same pull request as the sync:

- Update **Upstream snapshot**: sync date, upstream baseline commit, fork head, ahead/behind count.
- Keep the **Active differences** rows accurate; update file or test references if the merge moved
  them.
- Move any difference now provided by upstream to **Superseded differences**, with the upstream
  commit that supersedes it.
- Keep the **Upstream sync preservation contract** and `fork-differences.md` current.

## 6. Open the pull request

Open the sync branch against `master`, never against `upstream`. Include:

- the imported upstream range and merge commit;
- affected fork areas and the proof for each;
- gates and end-to-end runs;
- unresolved conflicts or differences that could not be preserved;
- the updated `FORK.md` snapshot.

Run the normal delivery review and the independent Opus 5.5 council before merging. Do not
force-push `master`, do not push to `upstream`, and do not merge the sync branch before the review
is green.

Rollback on the sync branch only:

```sh
git reset --hard "$pre"
```

## Red flags

Stop and investigate if a resolution:

- drops a test under `test/regressions/`, `test/visual/` or `test/e2e/`;
- removes a `FORK.md` row or anchor instead of marking it superseded;
- renames `custom:xiaomi-vacuum-map-card`, `xiaomi-vacuum-map-card.js` or the HACS filename;
- removes automatic room mapping, map-view persistence, the map refresh policy, the stale-room
  guard, editor room-config scoping, registry caching, `duration_unit`, cleaning-order badges,
  `map_view` or `layout`;
- restores Node 14, lockfile v1, the manual rotate button or upstream's HACS `issues` ignore;
- replaces the README's fork identity or the release/install instructions;
- updates snapshots with `-u` without explaining the diff.
