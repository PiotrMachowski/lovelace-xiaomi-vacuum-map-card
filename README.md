# Better Xiaomi Vacuum Map Card

[![Latest release](https://img.shields.io/github/v/release/Igloczek/lovelace-better-xiaomi-vacuum-map-card)](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/releases/latest)
[![Build](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/actions/workflows/build.yml/badge.svg)](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A Home Assistant dashboard card that puts your robot vacuum's live map on screen and turns it into
the remote. Tap rooms to clean them, draw a zone, send the robot to a spot, and watch it move,
with the vacuum's status and controls around the map.

It works with Xiaomi, Roborock, Dreame, Viomi, Valetudo, Neato, Roomba, Ecovacs, Wyze and more.

![Better Xiaomi Vacuum Map Card in a dashboard](docs/media/screenshot.png)

## Features

**Clean from the map**

- **Rooms:** tap one or more rooms and start. Each selected room shows its place in the cleaning
  order.
- **Zones:** draw rectangles, or save the zones you use often and pick them with one tap.
- **Go to a spot:** tap a point and the robot drives there. Saved points work too.
- **Repeats and custom actions:** set the number of passes, or call any Home Assistant service with
  the selection.

**A map that behaves**

- **Rooms are found automatically.** When the map camera reports its rooms, the card takes the
  outlines, names and tap targets from the map itself. You don't draw anything by hand.
- **Zoom and pan** with the mouse wheel or your fingers, and **rotate** with two fingers or a fixed
  angle. Overlays stay aligned at any zoom and rotation.
- **Remembers your view.** Each card reopens at the zoom, position and rotation you left it at. You
  can also set a starting view and a reset button that returns to it.
- **Light on your system.** The map image reloads when the camera changes, at most about every five
  seconds, and stops while the tab is in the background.
- **Fits any theme.** Room labels stay readable on every colour, and a white map background can be
  made transparent for dark dashboards.

**Controls around the map**

- **Status tiles** for battery, status, area, cleaning time, consumables and more, picked
  automatically for your integration.
- **Action icons** for start, pause, return to base, fan speed and similar, also picked
  automatically. Both tiles and icons can be customised or shown only under conditions.
- **Several vacuums or maps in one card,** switched with a preset selector.

**Built for real dashboards**

- **Vertical or horizontal layout.** The map sits above the controls or beside them, and the card
  resizes in sections views without `card-mod`.
- **A visual editor** for the basics, with full YAML for everything else.
- **Mistakes don't break the card.** An incomplete room or zone shows a clear message instead of a
  blank card.
- **Rooms stay correct after a re-map.** Rooms that no longer exist are marked and left out of
  cleaning, so an old selection never sends the robot to the wrong place.
- **Styling** through CSS variables, and translations in 28 languages.

## What you need

1. **Home Assistant** with your vacuum already set up through its integration. See
   [supported platforms](docs/platforms.md).
2. **A map** to draw:
   - a camera or image entity that shows the live map, from the vacuum integration itself (e.g.
     Roborock, Dreame, Valetudo) or from
     [Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor);
   - or any static image of your floor plan, such as a screenshot from the vendor app.
3. **Calibration,** so the card knows where map pixels are in the vacuum's coordinates. Map cameras
   that publish calibration points need only `calibration_source: {camera: true}`. For a static
   image, give three or four reference points (see
   [calibration](docs/configuration.md#calibration-source-options)).

## Install

[![Open your Home Assistant instance and open this repository in the Marketplace.](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=Igloczek&repository=lovelace-better-xiaomi-vacuum-map-card&category=dashboard)

The button opens this repository in the Marketplace (Home Assistant 2026.11 and newer) or in HACS
(older versions) and offers to add it. If it doesn't open, follow the steps for your setup.

<details>
<summary><b>Marketplace</b> (Home Assistant 2026.11 and newer)</summary>

1. Open **Settings → Marketplace** and accept the first-run warning.
2. **Connect GitHub** when asked. A custom repository can't be added without an account.
3. Add `https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card` as a **Dashboard
   resource** and install it.
4. Reload the browser. Marketplace registers the dashboard resource for you.

Upgrading Home Assistant from a HACS install migrates its entries and resources automatically.
</details>

<details>
<summary><b>HACS</b> (older Home Assistant)</summary>

1. Open HACS → **Frontend** → three-dot menu → **Custom repositories**.
2. Add `https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card` with category
   **Dashboard**.
3. Install **Better Xiaomi Vacuum Map Card**, then reload the browser.
</details>

<details>
<summary><b>Manual</b></summary>

1. Download `xiaomi-vacuum-map-card.js` from the
   [latest release](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/releases/latest).
2. Save it to `<config>/www/`, for example `/config/www/xiaomi-vacuum-map-card.js`.
3. Add it to your [dashboard resources](https://my.home-assistant.io/redirect/lovelace_resources/)
   as `/local/xiaomi-vacuum-map-card.js`, type **JavaScript module**.
4. Restart Home Assistant if you had to create the `www` folder, then reload the browser.
</details>

Keep a single resource entry for the card. Two entries for the same file load it twice.

## Quick start

Add a card to a dashboard, search for **Vacuum Map Card**, and pick your vacuum and map in
the editor. The same card in YAML:

```yaml
type: custom:xiaomi-vacuum-map-card
entity: vacuum.robot
vacuum_platform: Roborock
map_source:
  camera: image.robot_map
calibration_source:
  camera: true
```

Use your own entity IDs, and set `vacuum_platform` to your integration from
[supported platforms](docs/platforms.md). This is enough for zone cleaning, go-to-point, and the
status tiles and action icons for your vacuum.

To add **room cleaning**, open the card editor and press **Generate rooms config**. When the map
camera reports its rooms, the outlines come from the map. Next steps:

- [Configuration reference](docs/configuration.md): every option, map mode, tile, icon and action.
- [Complete example](docs/demo_config.yaml).
- [Getting coordinates](docs/templates/setup.md#getting-coordinates) for saved zones and points.

## Supported platforms

Ready-made templates for these integrations set up the map modes, tiles and icons for you:

Xiaomi Miio · Roborock · Roborock (custom) · Dreame · Valetudo · Valetudo RE · Viomi SE · Viomi V8 ·
miio2 · Xiaomi MIoT · Neato · MyNeato · Neatsvor · Roomba · Roomba Plus · Ecovacs (Deebot) · Wyze ·
`send_command`

Each [platform page](docs/platforms.md) lists the entities the card finds and the services it calls.
Other vacuums still work with the `default` platform and your own service calls.

## Documentation

| Topic | Where |
|---|---|
| All options, map modes, tiles, icons, actions | [Configuration](docs/configuration.md) |
| Integration templates and setup | [Supported platforms](docs/platforms.md) |
| Colours, sizes and fonts | [CSS variables](docs/css_variables.md) |
| Reporting a bug | [Report a problem](docs/report-a-problem.md) |
| Release notes | [Changelog](CHANGELOG.md) |
| What is planned | [Roadmap](ROADMAP.md) |

## Reporting a problem

Let an AI agent report it. Describe the problem to your agent and it gathers your card setup,
removes private data, works out what it can and files the report. Agent reports are labelled
`agent-report` and handled first, because they come with everything needed to reproduce the bug.

Give your agent (Claude Code, Codex, Cursor or similar) this instruction, with your problem at the end:

```text
Read https://raw.githubusercontent.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/master/.agents/skills/report-problem/SKILL.md
and follow it to report this problem with my vacuum map card:

<what is wrong, e.g. "the room outlines are shifted after I rotate the map">
```

It asks once for a temporary Home Assistant token and only reads. It never publishes secrets,
network addresses, device names or the map image. The [step-by-step guide](docs/report-a-problem.md)
covers the token, what the report contains, and follow-up questions. No agent? Use the
[bug form](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/issues/new?template=bug_report.yml).

Map camera problems (a missing or wrong map image) belong to the camera's integration, e.g.
[Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor/issues).

## Contributing

Pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers building, loading a
development build into Home Assistant, adding a platform template and translating. Every change runs
unit tests and a type check. Map changes also run visual tests at different zoom levels and
rotations, and each release passes end-to-end tests against a real Home Assistant.

## Coming from Xiaomi Vacuum Map Card

This card started as a fork of
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card)
and is a drop-in replacement. The card type stays `custom:xiaomi-vacuum-map-card` and your YAML
doesn't change. Remove the old card's resource, install this one, and reload. Both register the
same card type, so only one can be loaded at a time.

A few defaults differ, and each can be switched back:

- The card remembers zoom, position and rotation (`persist_map_view: false` to turn off).
- Two-finger rotation is on (`map_rotation_gesture: false`).
- The lock button's state is remembered (`persist_map_lock: false`).
- Room outlines detected from the map replace configured outlines. Configured rooms are used when
  detection isn't available.

If you installed this card before its rename from `Igloczek/lovelace-xiaomi-vacuum-map-card`,
remove that custom repository and add the current URL. Only the resource URL changes.
[FORK.md](FORK.md) records every difference from the original card.

## Credits and license

Created by Piotr Machowski as
[Xiaomi Vacuum Map Card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card), with
design and development by Bartosz Orczyk, Filip Schramm, Kamil Dryzek and Marek Trochimiak, and
platform templates and translations from its contributors. Maintained by
[Igloczek](https://github.com/Igloczek).

Released under the [MIT license](LICENSE).
