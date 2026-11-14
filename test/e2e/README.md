# End-to-end suite (real Home Assistant)

These tests drive a real Home Assistant instance in Docker, install the card the way a user does,
and exercise the behaviours the mock harness cannot prove. The delivery owns this verification: a
failure here blocks a release, and the screenshots under `artifacts/` are the evidence.

## What it covers

| Spec | What it proves |
|---|---|
| `render.spec.ts` | The card renders from the installed Lovelace resource against a real camera entity. |
| `editor.spec.ts` | The visual editor opens in edit mode, the Title field is the element the frontend provides, typing it reaches the config, and **Generate rooms config** produces rooms from the camera metadata without a page error. |
| `map-view.spec.ts` | `map_view` opens at the configured view, a gesture changes it, the reset control returns to it, and the view persists across reloads. |
| `layout.spec.ts` | `layout: horizontal` places the map beside the controls in a real **sections** view, a long mode name ellipsizes inside the column, and changing the card's grid options (what the resize handle does) resizes the card. The vertical layout stays stacked. |
| `zoom-rotation.spec.ts` | At zoom 2.5 and rotation 90, clicking each room outline selects that room, which only works when the overlay sits on the image. |
| `camera-rate.spec.ts` | With a camera fixture that counts requests: vacuum state updates cause no new snapshot, a camera change causes exactly one, a hidden tab causes none, and becoming visible again causes one. |
| `yaml-y-key.spec.ts` | A YAML dashboard with an unquoted `y:` key is applied, not parsed as a boolean (upstream #952). |

`marketplace-install.cjs` installs the card from the repository URL through Home Assistant's own
installer and asserts the asset and the Lovelace resource.

## Install path note

Home Assistant 2026.11 ships the core **marketplace** integration and removes a HACS config entry as
a duplicate (`Removing duplicate configuration entry … is kept` in the log), so HACS cannot run on
this version. The suite therefore installs through the Marketplace, which is the current equivalent;
the card's HACS metadata (`hacs.json`, `filename`) is unchanged and still validated by the HACS
action in CI for releases that use HACS.

## Running it

```sh
npm run build                                   # the installer downloads releases, so build before a manual copy
docker compose -f test/e2e/compose.yaml up -d   # Home Assistant 2026.11.0 on :8123
node test/e2e/setup.cjs                         # onboarding + storage dashboards
node test/e2e/marketplace-install.cjs           # install the card from the repository URL
npx playwright test -c test/e2e/playwright.config.ts
```

Screenshots are written to `test/e2e/artifacts/`. They are gitignored; attach the relevant ones to
the release notes or the pull request when a behaviour changes.

## Fixture camera

`test/e2e/ha/config/custom_components/map_fixture` is a test-only integration: it serves the
committed synthetic map through `/api/map_fixture/image`, counts every request, exposes the room
metadata the card reads, and offers `map_fixture.bump` (a new map, like an integration would push)
and `map_fixture.set_image`. It is never part of the released card.

The first run needs a GitHub token for the installer, injected into the Home Assistant config entry
by the bootstrap step described in the release evidence; the token is never committed (`.auth/` and
`ha/config/.storage/` are gitignored).
