# Better Xiaomi Vacuum Map Card

Map-based cleaning controls for Home Assistant, with the upstream bugs that were left open for a
long time fixed under a test-first process.

![Better Xiaomi Vacuum Map Card in a dashboard](docs/media/screenshot.png)

The card element (`custom:xiaomi-vacuum-map-card`) and the release asset (`xiaomi-vacuum-map-card.js`)
keep their upstream names, so this is a drop-in replacement: your YAML does not change. Install
[`v1.0.0`](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/releases/tag/v1.0.0)
or newer, the first fork release with every shipped row below. Maintained by [Igloczek](https://github.com/Igloczek),
based on [PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card).

Full option reference: [configuration](docs/configuration.md) · platforms: [supported platforms](docs/platforms.md) · styling: [CSS variables](docs/css_variables.md)

## Why this fork

Upstream issues and pull requests sat unresolved for a long time: the camera snapshot reload storm
([#704](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/704),
[#357](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/357)), rooms
cleaning the wrong room after a re-map
([#928](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/928)), the
horizontal layout
([#183](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/183)) and several
crash-on-bad-config reports are all older than this fork.

AI agents work those specific issues and PRs test-first: a failing test or a real fixture comes
first, then the fix, and nothing is claimed as fixed without one. Vendor and hardware behaviour that
cannot be reproduced is postponed instead of guessed at.

## What is better

Statuses are literal: `shipped` means merged to `master` with the gates green, `postponed` waits for
hardware or a fixture. Evidence links to the fork's record in [FORK.md](FORK.md) or to the plan in
[ROADMAP.md](ROADMAP.md).

| Change | Status | What it does | Evidence |
|---|---|---|---|
| Map refresh policy | `shipped` | The camera image reloads on a camera change or once per interval, not on every vacuum, tile or icon update; a hidden tab stops reloading. | [#704, #357](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/704) · [FORK.md](FORK.md#b6-map-refresh) · PR [#11](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/11) |
| Registry lookup | `shipped` | One scoped `config/entity_registry/get_entries` call, cached per device, instead of downloading the whole entity registry and fetching every entry. | [#864](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/864) · [FORK.md](FORK.md#b7-registry-cache) · PR [#8](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/8) |
| Tile labels, durations and icons | `shipped` | Case-insensitive tile translations, `formatEntityName` labels behind a frontend-version gate, a `duration_unit` field in platform tile templates so sensor tiles show the right duration, and the core `return_to_base` icon. | [#723](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/723), [#957](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/957), [#965](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/965), [#961](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/961) · [FORK.md](FORK.md#b3-tiles-labels-icons) · PR [#6](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/6) |
| Config robustness | `shipped` | An incomplete configuration reports the missing field instead of throwing; invalid dynamic predefined selections are ignored. | [#937](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/937), [#940](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/940), [#938](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/938) · [FORK.md](FORK.md#b1-config-robustness) · PR [#4](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/4) |
| Editor room config | `shipped` | Generating rooms no longer mutates Home Assistant's frozen Lovelace config and no longer answers another card's request; repeated generation leaves one ROOM mode. | [#956](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/956), [#944](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/944), [#958](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/958) · [FORK.md](FORK.md#b2-editor-room-config) · PR [#5](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/5) |
| Cleaning-order badges | `shipped` | A selected room shows the position it will be cleaned in, and the numbers renumber when a room is deselected. | [#959](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/959) · [FORK.md](FORK.md#b5-cleaning-order-badges) · PR [#10](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/10) |
| Stale room IDs | `shipped` | Rooms a re-map removed are marked, named in a warning and excluded from service calls, so a stale selection cannot clean the wrong room. | [#928](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/928), [#385](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/385) · [FORK.md](FORK.md#b8-stale-room-selections) · PR [#12](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/12) |
| Default map view | `shipped` | `map_view` sets the view the map opens at, and the reset control and `map_view.reset` action return to it. Verified end to end on a real dashboard ([DELIVERY.md](DELIVERY.md#end-to-end-verification-owned-by-delivery)). | [#873](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/873) · [FORK.md](FORK.md#b9-default-map-view) · PR [#13](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/13) |
| Horizontal layout | `shipped` | `layout: horizontal` puts the map beside the controls, and sections-view grid sizing lets the card be resized without `card-mod`. Verified end to end on a real dashboard ([DELIVERY.md](DELIVERY.md#end-to-end-verification-owned-by-delivery)). | [#183](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/183), [#943](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/943) · [FORK.md](FORK.md#b10-horizontal-layout) · PR [#14](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/14) |
| Automatic room mapping | `shipped` | Room outlines, names and hit targets come from the camera's `rooms` metadata and the map colours; hand-configured room outlines stay as the fallback when detection is unavailable. | [FORK.md](FORK.md#automatic-room-mapping) · `5276b9b` |
| Persisted view and rotation | `shipped` | Carries upstream PR [#949](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/949): the zoom, position and rotation are remembered per card, preset and map, and rotation gestures work; the toolbar's manual rotate button that came with it was dropped again in `62e339f`. | [FORK.md](FORK.md#persistent-map-view-and-rotation), [rotation controls](FORK.md#rotation-controls) · `badf9b2`, `e57bb8d` |
| Map appearance | `shipped` | Near-white map pixels can be made transparent for a dark dashboard (`transparent_background: true`), and room labels default to white text with a dark outline so they stay readable on every map colour. | [FORK.md](FORK.md#map-appearance) · [CSS variables](docs/css_variables.md) · `5276b9b`, `36b890b` |
| Zoom alignment | `shipped` | Zoom and rotation are applied once to the image and the overlays, so room outlines stay on the map; the local regression check covers both. | [FORK.md](FORK.md#zoom-alignment) · `2d5d439` |
| Test and CI gates | `shipped` | Vitest with happy-dom, a Playwright visual suite at zoom, rotation, room hit-testing and layout, Node 22 and a `tsc --noEmit` gate on every pull request. | [FORK.md](FORK.md#p0-test-infrastructure), [CI baseline](FORK.md#ci-baseline), [visual harness](FORK.md#visual-regression-harness) · PR [#2](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/2), [#3](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/3), [#7](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/pull/7) |
| Roborock status/battery tiles | `postponed` | The generic `duration_unit` field of [#964](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/964) shipped in the platform tile templates; the Roborock-specific templates need a real Roborock-core registry fixture. | [FORK.md](FORK.md#b3-tiles-labels-icons) · [ROADMAP.md](ROADMAP.md#postpone-list) |
| Deferred upstream items | `postponed` | Templated predefined selections, live path overlay on a static floorplan, rotated zone rectangles, Valetudo JSON maps, Ecovacs SVG viewbox, delayed start, non-admin MQTT and collapse map. | [ROADMAP.md](ROADMAP.md#postpone-list) |

## Install

Install `v1.0.0` or newer. It is the fork's first release under its own version number: the fork
starts its own line at 1.0.0 instead of continuing upstream's 2.x numbers. The earlier
`v2.5.0-igloczek.1` tag was a pre-versioning snapshot and differs from 1.0.0 only by the editor
switch-label fix; because 1.0.0 sorts below that tag, HACS/Marketplace may not offer it as an update,
so reinstall from the repository URL once.

Home Assistant 2026.11 blocks the HACS custom integration and ships the built-in **Marketplace**
instead; upgrading an existing HACS install migrates its entries and resources to the Marketplace.
Use Marketplace on 2026.11 or newer, HACS on older releases, or install the release asset by hand.

### Marketplace (Home Assistant 2026.11+)

1. Open **Settings → Marketplace** and accept the first-run warning if it appears.
2. **Connect GitHub** when prompted; without an account the Marketplace cannot add a custom
   repository.
3. Add the custom repository `https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card` as a
   **Dashboard resource** and install it.
4. Marketplace registers the Lovelace resource itself; reload the browser.

### HACS (older Home Assistant)

1. Open HACS → **Frontend** → three-dot menu → **Custom repositories**.
2. Add `https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card` with category **Dashboard**.
3. Install **Better Xiaomi Vacuum Map Card**.
4. Check that the Lovelace resource exists; HACS normally adds it for you:
   ```yaml
   url: /hacsfiles/lovelace-better-xiaomi-vacuum-map-card/xiaomi-vacuum-map-card.js
   type: module
   ```
5. Reload the browser.

#### Re-adding the renamed repository

The repository was renamed from `Igloczek/lovelace-xiaomi-vacuum-map-card`. HACS keeps the custom
repository URL it was added with, so remove the old entry, add the new URL from step 2 and reinstall.
Only the resource URL changes, to
`/hacsfiles/lovelace-better-xiaomi-vacuum-map-card/xiaomi-vacuum-map-card.js`; the element
(`custom:xiaomi-vacuum-map-card`), the asset name (`xiaomi-vacuum-map-card.js`) and your YAML stay
exactly as they are. GitHub redirects the old repository URL, but do not rely on that for a HACS
entry cached against the old one.

Removing the old download in HACS also removes its resource. Keep only one resource entry:
an old `/hacsfiles/lovelace-xiaomi-vacuum-map-card/...` entry left next to the new one registers
the element twice, which logs a console error and may load the old build first.

### Manual

1. Download the `xiaomi-vacuum-map-card.js` asset from the
   [latest release](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/releases/latest).
2. Save it under `<ha config>/www/`, for example
   `/config/www/custom_lovelace/xiaomi-vacuum-map-card.js`.
3. Add it to [Lovelace resources](https://my.home-assistant.io/redirect/lovelace_resources/):
   ```yaml
   url: /local/custom_lovelace/xiaomi-vacuum-map-card.js
   type: module
   ```
4. Restart Home Assistant if you had to create `www`, then reload the browser.

## Migrating from upstream

Your YAML needs no edit and the element stays `custom:xiaomi-vacuum-map-card`, so only the resource
URL changes: point the existing resource at the new `xiaomi-vacuum-map-card.js` and reload. Both
builds register the same custom element and the first registration wins, so load one build at a
time; keep the old file on disk until your dashboard checks out, so rolling back is one line.

A few behaviours differ from upstream with no YAML edit:

- `persist_map_view` defaults to `true`, so the card remembers the zoom, position and rotation per
  card, preset and map across reloads. Upstream does not persist the view; set
  `persist_map_view: false` for the upstream behaviour.
- Twisting two fingers rotates the map (`map_rotation_gesture`, default `true`). Upstream only zooms
  and pans; set it to `false` for upstream zoom-and-pan-only gestures.
- The lock button state is remembered with the view (`persist_map_lock`, default `true`) and takes
  precedence over `map_locked` after the first toggle; set `persist_map_lock: false` to always start
  from `map_locked`.
- Earlier fork releases carried a manual rotate button in the map toolbar. Upstream never had one and
  it was dropped again in `62e339f`; use `map_rotation`, the rotation gesture or the reset control
  instead.
- When the camera reports `rooms` metadata and the map has distinct room colours, the detected
  outlines, labels and hit targets replace hand-configured room outlines. Configured rooms remain
  the fallback when detection is unavailable
  ([`5276b9b`](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/commit/5276b9b)).

## Quick start

A minimal card for a Xiaomi/Roborock vacuum with a map camera:

```yaml
type: custom:xiaomi-vacuum-map-card
entity: vacuum.roborock_s7
vacuum_platform: Xiaomi Miio
map_source:
  camera: camera.xiaomi_cloud_map_extractor
calibration_source:
  camera: true
map_modes:
  - template: vacuum_clean_zone
  - template: vacuum_goto
  - template: vacuum_clean_zone_predefined
    predefined_selections:
      - zones: [[25500, 25000, 26500, 26500]]
        label: {text: Kitchen, x: 26000, y: 25750}
```

Replace the entity ids and the platform. Every option, template and action is in
[configuration](docs/configuration.md), platform setup in [supported platforms](docs/platforms.md).

## Supported platforms

Xiaomi Miio, Roborock, Dreame, Valetudo, Viomi, Neato, Roomba, Wyze, Ecovacs, `send_command` and the
community integrations listed in [supported platforms](docs/platforms.md), where each page links its
templates, the entities the card discovers and the service calls it uses.

[Adding a new platform](CONTRIBUTING.md#adding-new-platform); platform templates are shared with
upstream, so those requests go to the
[upstream tracker](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/new?labels=new+platform&template=new_platform_request.yml).

## Maintenance model

Every change goes through the same gates:

- `npm test` (Vitest + happy-dom), `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `npm run check:map-scale` and `npm run check:docs` on every pull request; the documentation link
  check runs offline, so a moved section cannot leave a dead link.
- The Playwright visual suite runs in its own job for map-rendering pull requests and checks overlay
  alignment at zoom and rotation, room hit-testing and the vertical/horizontal layout at three
  widths ([visual suite](test/visual/README.md)).
- A real Home Assistant, Marketplace-installed and Playwright end-to-end suite (`test/e2e`) proves
  the editor, map view, layouts, zoom/rotation, camera request rate and YAML parsing before a
  release; the delivery owns that verification and publishes the screenshots as evidence. The suite
  is not part of the pull-request CI job (it needs Docker and a Home Assistant container), so a
  release is only published after it passes. The HACS metadata is still validated by the HACS action
  in CI for releases that use HACS.
- A delivery review and a Claude Opus 5.5 council review must both approve before merge. The
  council audits the diff against the issue and the tests, not just the style.

Report bugs and feature requests for this fork on the
[fork tracker](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/issues). If the same
configuration also fails with the upstream release, report it on the
[upstream tracker](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues) as well;
platform-template requests that apply to both builds belong upstream because those templates are
shared.

End-to-end verification is owned by delivery, not by you. A real Home Assistant 2026.11 runs in
Docker with a controllable camera fixture, the card is installed from this repository the way a user
installs it, and a Playwright suite drives the editor, the map view, both layouts, zoom 2.5 with
rotation 90, the camera request rate and YAML parsing. The evidence is recorded in
[DELIVERY.md](DELIVERY.md#end-to-end-verification-owned-by-delivery), and a behaviour is only called
shipped when that suite proves it. Hardware and vendor behaviour that cannot be reproduced — such as
the Roborock status/battery templates — stays explicitly postponed with its reason, never handed to
you as a check to perform.

## Attribution and license

This fork is based on
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card),
created by Piotr Machowski; the card, its platform templates and its translations are his work and
the work of the upstream contributors. Special thanks to Bartosz Orczyk, Filip Schramm, Kamil
Dryzek and Marek Trochimiak for the design and development.

Released under the [MIT license](LICENSE). The fork's scope and every intentional divergence from
upstream are recorded in [FORK.md](FORK.md); the plan and the postponed items are in
[ROADMAP.md](ROADMAP.md).
