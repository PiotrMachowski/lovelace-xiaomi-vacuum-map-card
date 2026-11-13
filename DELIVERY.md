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
| P0c | Playwright visual harness (separate job, `visual` label) | in progress | - | - | - | - |
| P0d | Capture the real Home Assistant fixture | blocked | - | - | - | needs the user's HA instance (see Manual checks) |
| B1 | Config robustness (#937, #940, #938; #952 postponed) | merged | [#4](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/4) | APPROVE | `a8b3a39` | - |
| B2 | Editor room-config path (#956, #944, duplicate cleanup, #958) | in progress | - | - | - | - |
| B3 | Tiles, labels and icons (#723, #957, #965, #961) | in progress | - | - | - | - |
| B4 | Roborock status/battery templates (#964) | postponed | - | - | - | needs a real Roborock-core registry fixture |
| B5 | Cleaning-order badges (#959) | planned | - | - | - | after B2 |
| B6 | Map refresh policy (#704, #357) | planned | - | - | - | after B5 |
| B7 | Registry payload and caching (#864) | planned | - | - | - | after B3 |
| B8 | Preset rooms and stale room IDs (#385, #928) | planned | - | - | - | after B6 |
| B9 | Default map view (#873) | planned | - | - | - | after B8 |
| B10 | Horizontal layout and card height (#183, #943) | planned | - | - | - | after B9 and P0c |
| R1 | In-repo rebrand and README rewrite | planned | - | - | - | after code batches |
| R2 | GitHub repository rename and release surface | planned | - | - | - | last, after every code PR merges |

## Postponed

Exactly the items in [`ROADMAP.md`](ROADMAP.md#postpone-list), with the reason recorded there:
#964 (Roborock templates), #952 (YAML `y:` normalization), #958 beyond the element fallback,
#19, #22, #24, #25, #26, #23, #966, #21, #27.

## Follow-ups discovered during delivery

| Item | Blocks a batch? | Owner |
|---|---|---|
| `#957`'s `entityNamesChanged` re-render hook was not carried with the `formatEntityName` fallback, because it lives in the card file that B2 owned. Without it a registry-only rename can leave a tile label stale until an unrelated entity update. | No | B3 follow-up, once B2 has merged |
| `mountEditor` attaches the editor before setting `hass` (unlike `mountCard`). Harmless today; worth aligning when the editor harness is next touched. | No | B2 |
| `withoutCustomElement` masks `customElements.get` only; the element still upgrades if something renders it. B2 must assert on the rendered tag name. | No | B2 |
| An empty YAML key still crashes validation: `id:` with no value parses to `null`, passes the `=== undefined` check and throws on `null.toString()`; `map:` left empty does the same because `p !== undefined` lets `null` through. Upstream has the same gap, so patching it inside a cherry-pick would break the carry rule. | No | fork-only fix after the Phase 1 wave, with tests for `null` and the `#938` cases the council probed (native-list attribute, `null` value, non-list JSON) |
| **Flaky Vitest gate** (high priority): `_updateElements` schedules an uncancelled `delay(100).then(...)`; after happy-dom teardown the callback throws `ReferenceError: window is not defined` in `_restoreMapView`, which reddened one P0c Build run. Not reproducible in 12 consecutive local runs, but it can redden any PR. Fix: track the timer in the card and cancel it in `disconnectedCallback`, plus a test that disconnects before the delay elapses. | No (but flaky gates are not acceptable long-term) | the batch that next touches the card (B6), or a small dedicated PR once B2 merges |

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
