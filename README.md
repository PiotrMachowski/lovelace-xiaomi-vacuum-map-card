# Better Xiaomi Vacuum Map Card

Map-based cleaning controls for Home Assistant, with the upstream bugs that were left open for a
long time fixed under a test-first process.

![Better Xiaomi Vacuum Map Card in a dashboard](docs/media/screenshot.png)

The card element (`custom:xiaomi-vacuum-map-card`) and the release asset
(`xiaomi-vacuum-map-card.js`) keep their upstream names, so this is a drop-in replacement: your YAML
does not change. The fork is maintained by [Igloczek](https://github.com/Igloczek) and is based on
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card).

Full option reference: [configuration](docs/configuration.md) · platforms: [supported platforms](docs/platforms.md) · styling: [CSS variables](docs/css_variables.md)

## Why this fork

Upstream issues and pull requests sat unresolved for a long time. The camera snapshot reload storm
([#704](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/704),
[#357](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/357)), rooms
cleaning the wrong room after a re-map
([#928](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/928)), the
horizontal layout ([#183](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/183))
and several crash-on-bad-config reports are all older than this fork.

This fork points AI agents at those specific issues and PRs under a test-first, two-model review
process. A failing test or a real fixture comes first, then the fix; a delivery review and a Claude
Opus 5.5 council review must both approve before merge. Nothing is claimed as fixed without a test
or a real fixture. Vendor and hardware behaviour that cannot be reproduced is postponed instead of
guessed at.

## What is better

Statuses are literal. `shipped` means merged to `master` with the gates green; `postponed` means it
waits for hardware or a fixture. Evidence links to the fork's record in [FORK.md](FORK.md) or to the
plan in [ROADMAP.md](ROADMAP.md).

| Change | Status | What it does | Evidence |
|---|---|---|---|
| Map refresh policy | `shipped` | The camera image reloads on a camera change or once per interval, not on every vacuum, tile or icon update; a hidden tab stops reloading. | [#704, #357](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/704) · [FORK.md](FORK.md#b6-map-refresh) · PR [#11](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/11) |
| Registry lookup | `shipped` | One scoped `config/entity_registry/get_entries` call, cached per device, instead of downloading the whole entity registry and fetching every entry. | [#864](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/864) · [FORK.md](FORK.md#b7-registry-cache) · PR [#8](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/8) |
| Tile labels, durations and icons | `shipped` | Case-insensitive tile translations, `formatEntityName` labels behind a frontend-version gate, `duration_unit` for sensor tiles and the core `return_to_base` icon. | [#723](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/723), [#957](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/957), [#965](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/965), [#961](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/961) · [FORK.md](FORK.md#b3-tiles-labels-icons) · PR [#6](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/6) |
| Config robustness | `shipped` | An incomplete configuration reports the missing field instead of throwing; invalid dynamic predefined selections are ignored. | [#937](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/937), [#940](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/940), [#938](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/938) · [FORK.md](FORK.md#b1-config-robustness) · PR [#4](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/4) |
| Editor room config | `shipped` | Generating rooms no longer mutates Home Assistant's frozen Lovelace config and no longer answers another card's request; repeated generation leaves one ROOM mode. | [#956](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/956), [#944](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/944), [#958](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/958) · [FORK.md](FORK.md#b2-editor-room-config) · PR [#5](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/5) |
| Cleaning-order badges | `shipped` | A selected room shows the position it will be cleaned in, and the numbers renumber when a room is deselected. | [#959](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/959) · [FORK.md](FORK.md#b5-cleaning-order-badges) · PR [#10](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/10) |
| Stale room IDs | `shipped` | Rooms a re-map removed are marked, named in a warning and excluded from service calls, so a stale selection cannot clean the wrong room. | [#928](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/928), [#385](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/385) · [FORK.md](FORK.md#b8-stale-room-selections) · PR [#12](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/12) |
| Default map view | `shipped` | `map_view` sets the view the map opens at, and the reset control and `map_view.reset` action return to it. | [#873](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/873) · [FORK.md](FORK.md#b9-default-map-view) · PR [#13](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/13) |
| Horizontal layout | `shipped` | `layout: horizontal` puts the map beside the controls, and sections-view grid sizing lets the card be resized without `card-mod`. | [#183](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/183), [#943](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/943) · [FORK.md](FORK.md#b10-horizontal-layout) · PR [#14](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/14) |
| Test and CI gates | `shipped` | Vitest with happy-dom, a Playwright visual suite at zoom, rotation, room hit-testing and layout, Node 22 and a `tsc --noEmit` gate on every pull request. | [FORK.md](FORK.md#p0-test-infrastructure) · PR [#2](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/2), [#3](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/3), [#7](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/pull/7) |
| Roborock status/battery tiles | `postponed` | The generic `duration_unit` part of [#964](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/pull/964) shipped; the Roborock-specific templates need a real Roborock-core registry fixture. | [FORK.md](FORK.md#b3-tiles-labels-icons) · [ROADMAP.md](ROADMAP.md#postpone-list) |
| Deferred upstream items | `postponed` | Templated predefined selections, static floorplan background, rotated zone rectangles, Valetudo JSON maps, Ecovacs SVG viewbox, delayed start, non-admin MQTT and collapse map. | [ROADMAP.md](ROADMAP.md#postpone-list) |

## Install

This card is **not** in the HACS default repositories; add it as a custom repository.

### HACS (custom repository)

1. Open HACS → **Frontend** → three-dot menu → **Custom repositories**.
2. Add `https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card` with category **Dashboard**.
3. Install **Better Xiaomi Vacuum Map Card**.
4. Check that the Lovelace resource exists; HACS normally adds it for you:
   ```yaml
   url: /hacsfiles/lovelace-xiaomi-vacuum-map-card/xiaomi-vacuum-map-card.js
   type: module
   ```
5. Reload the browser.

The HACS folder follows the repository name. A later repository rename (tracked in
[ROADMAP.md](ROADMAP.md#phase-4-project-identity-and-readme)) means re-adding the custom repository
and updating only the resource URL; the asset name stays the same.

### Manual

1. Download `xiaomi-vacuum-map-card.js` from the
   [latest fork release](https://github.com/Igloczek/lovelace-xiaomi-vacuum-map-card/releases/latest).
2. Save it under `<ha config>/www/`, for example
   `/config/www/custom_lovelace/xiaomi-vacuum-map-card.js`.
3. Add it to [Lovelace resources](https://my.home-assistant.io/redirect/lovelace_resources/):
   ```yaml
   url: /local/custom_lovelace/xiaomi-vacuum-map-card.js
   type: module
   ```
4. Restart Home Assistant if you had to create `www`, then reload the browser.

## Migrating from upstream

This is the same card, not a different one:

- the element is still `custom:xiaomi-vacuum-map-card`;
- the release asset is still `xiaomi-vacuum-map-card.js`;
- the YAML is unchanged — no key was renamed or removed, and the fork only adds options.

Only the resource URL changes. Point the existing resource at the new file and reload. Both builds
register the same custom element and the first registration wins, so load one build at a time. Keep
the old file on disk and note its URL until you have checked your dashboard; rolling back is then a
one-line change.

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
[configuration](docs/configuration.md); platform-specific setup is in
[supported platforms](docs/platforms.md).

## Supported platforms

Xiaomi Miio, Roborock, Dreame, Valetudo, Viomi, Neato, Roomba, Wyze, Ecovacs, `send_command` and the
community integrations listed in [supported platforms](docs/platforms.md). Each platform page links
its templates, the entities the card discovers and the service calls it uses.

[Adding a new platform](CONTRIBUTING.md#adding-new-platform). Platform templates are shared with
upstream, so platform requests go to the
[upstream tracker](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/new?labels=new+platform&template=new_platform_request.yml).

## Maintenance model

Every change goes through the same gates:

- `npm test` (Vitest + happy-dom), `npx tsc --noEmit`, `npm run lint`, `npm run build`,
  `npm run check:map-scale` and `npm run check:docs` on every pull request.
- The Playwright visual suite runs in its own job for map-rendering pull requests and checks overlay
  alignment at zoom and rotation, room hit-testing and the vertical/horizontal layout at three
  widths ([visual suite](test/visual/README.md)).
- A delivery review and a Claude Opus 5.5 council review must both approve before merge. The
  council audits the diff against the issue and the tests, not just the style.
- Documentation links are checked offline, so a moved section cannot leave a dead link.

There is no robot and no Home Assistant instance in the build environment. Hardware and vendor
behaviour is only claimed when a real fixture proves it; the remaining checks are listed in
[DELIVERY.md](DELIVERY.md). That includes the real Roborock-core registry for status/battery tiles,
the editor's text fields on the current frontend, map behaviour at zoom 2.5 and rotation 90 on a
device, and the sections-view resize on a real dashboard. Items that need that evidence are
postponed rather than presented as done. Open follow-ups, such as a tile label staying stale after
a registry-only rename, are tracked there too.

## Attribution and license

This fork is based on
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card),
created by Piotr Machowski. The card, its platform templates and its translations are his work and
the work of the upstream contributors. Special thanks to Bartosz Orczyk, Filip Schramm, Kamil
Dryzek and Marek Trochimiak for the design and development.

Released under the [MIT license](LICENSE). The fork's scope and every intentional divergence from
upstream are recorded in [FORK.md](FORK.md); the plan and the postponed items are in
[ROADMAP.md](ROADMAP.md).
