# End-to-end suite (real Home Assistant)

These tests drive a real Home Assistant instance in Docker, install the card the way a user does,
and exercise the behaviours the mock harness cannot prove. The delivery owns this verification: a
release is only published after this suite passes against the release candidate; screenshots are
written to the gitignored `test/e2e/artifacts/`.

## What it covers

| Spec | What it proves |
|---|---|
| `render.spec.ts` | The card renders from the installed Lovelace resource against a real camera entity. |
| `editor.spec.ts` | The visual editor opens in edit mode on a card whose ROOM mode starts empty; the Title field is the element the frontend provides and real keyboard typing reaches Home Assistant's edit-dialog config; **Generate rooms config** is the only way the room ids appear, and it does. The four switch labels are visible even though this frontend no longer defines `ha-formfield`. |
| `map-view.spec.ts` | `map_view` opens at the configured view, a real wheel gesture changes scale and offsets, the reset control returns to the default, and the view persists across reloads. |
| `layout.spec.ts` | `layout: horizontal` places the map beside the controls in a real **sections** view, a long mode name ellipsizes inside the column, and changing the card's grid options (what the resize handle causes) resizes the card. The vertical layout stays stacked. |
| `zoom-rotation.spec.ts` | At zoom 2.5 and rotation 90, the painted room colour's screen box must match the outline's screen box within 4 px in all four directions (set `E2E_OVERLAY_SHIFT="20,0"` to prove the check fails on a shifted overlay), and clicking each outline selects that room. |
| `camera-rate.spec.ts` | Vacuum state changes cause no snapshot request inside the refresh window (at most the one interval refresh); a camera change causes exactly one; a hidden tab causes none; becoming visible again causes one. |
| `yaml-y-key.spec.ts` | A YAML dashboard with an unquoted `y:` key applies the offset, so Home Assistant 2026.11 does not reproduce the boolean-key bug (upstream #952). |
| `stale-rooms.spec.ts` | The fixture renumbers its segments while keeping the geometry: the card marks the configured rooms stale, warns with their ids, refuses to select them, and still selects the new live id. |

## What it does not cover

- HACS itself: Home Assistant 2026.11 blocks the HACS custom integration and ships the Marketplace.
  The card's `hacs.json` metadata is unchanged and the HACS action in CI still validates it, but the
  HACS UI install can only be exercised on an older Home Assistant release.
- Hardware-specific behaviour: the Roborock status/battery templates (B4) need the integration's
  runtime registry, and vendor service semantics need the device. Those stay postponed.
- Real phone scrolling and a real drag-resize: the resize uses the grid options the handle writes,
  and the hidden-tab check overrides `document.hidden` rather than moving the page to a background
  window. Both are documented limitations of a headless run.
- Two worktrees side by side by default: the container name and port can be overridden with
  `E2E_CONTAINER` and `E2E_HA_PORT`, but `connect-github.cjs --restart` still targets the default
  compose project unless `COMPOSE_PROJECT_NAME` is set.

## Install path

Home Assistant 2026.11 ships the core **marketplace** integration and blocks the `hacs` custom
integration (`loader.py`: built into Home Assistant as the Marketplace); upgrading migrates an
existing HACS install. `marketplace-install.cjs` therefore installs from the repository URL through
Marketplace, and `install-local-build.cjs` then overlays the branch build so the behaviour specs test
the pull request rather than the last release (it also removes the installer's stale `.gz`/`.br`
siblings, which Home Assistant would otherwise serve instead).

## Running it

```sh
npm run build
docker compose -f test/e2e/compose.yaml up -d      # Home Assistant 2026.11.0 on :8123
node test/e2e/setup.cjs                            # onboarding + storage dashboards
node test/e2e/connect-github.cjs --restart         # Marketplace GitHub token (GITHUB_TOKEN or gh auth)
node test/e2e/marketplace-install.cjs              # install from the repository URL (proves the path)
node test/e2e/install-local-build.cjs              # put this checkout's build in front of the specs
npm run test:e2e
```

Screenshots are written to `test/e2e/artifacts/` (gitignored); attach the relevant ones to a pull
request or release when a behaviour changes.

## Fixture camera

`test/e2e/ha/config/custom_components/map_fixture` is a test-only integration: it serves the
committed synthetic map through `/api/map_fixture/image`, counts every request, exposes the room
metadata the card reads, and offers `map_fixture.bump` (a new map, like an integration would push)
and `map_fixture.set_image`. It is never part of the released card.

`connect-github.cjs` writes the token into the ignored Home Assistant state file
(`test/e2e/ha/config/.storage`), because the Marketplace device flow cannot run headless. Nothing
under `.storage`, `.auth` or `artifacts` is committed.
