# Fork scope and upstream differences

This repository is Igloczek's fork of
[PiotrMachowski/lovelace-xiaomi-vacuum-map-card](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card),
published as **Better Xiaomi Vacuum Map Card**. Upstream is the baseline; this file records where the
fork behaves differently and how to sync upstream. Planned work is in [ROADMAP.md](ROADMAP.md),
released changes in [CHANGELOG.md](CHANGELOG.md).

## Compatibility

The custom element (`custom:xiaomi-vacuum-map-card`), the release asset
(`xiaomi-vacuum-map-card.js`) and every existing configuration key keep their upstream names and
meaning. The fork adds options; it does not rename or remove them.

## Current differences

| Area | Behaviour in this fork | Why |
|---|---|---|
| Map appearance | Near-white pixels can be transparent (`transparent_background`) and room labels are white with a dark outline, so the map reads on a dark dashboard and over any room colour. | The upstream labels are hard to read on coloured maps. |
| Automatic room mapping | Room outlines, names and hit targets are taken from the camera's room metadata and the map colours. Configured rooms remain the fallback when that metadata or the colours are unavailable. | Room configuration from the camera avoids hand-drawn outlines. |
| Persistent view and rotation | Zoom, position and rotation are remembered per card, preset and map by default, and two-finger rotation is enabled by default. | The card should reopen where the user left it. |
| Zoom alignment | The base image scale uses the canvas's untransformed layout width, so zoom and rotation apply once to the image and its overlays. | A transformed measurement applied the scale twice and detached overlays. |
| Room-config editor | Generating rooms copies the mode list instead of mutating Home Assistant's frozen configuration, scopes requests and answers to the requesting card, keeps one rooms mode across repeated generation, and uses `ha-input` with an `ha-textfield` fallback. | Upstream generation mutated the config and crossed cards. |
| Editor element fallbacks | The editor also draws its own labels for switches when the frontend does not define `ha-formfield`. | Home Assistant 2026.11 removed that element. |
| Registry and refresh | One entity-registry lookup per vacuum per page, and a camera snapshot that reloads on a camera change or about once per five seconds rather than on every entity update. A hidden tab stops reloading. | The upstream behaviour downloaded the full registry and reloaded the map constantly. |
| Config robustness | Incomplete rooms, calibration points and dynamic selections produce validation messages and are ignored, instead of throwing. | Reports showed crashed cards from small configuration mistakes. |
| Stale rooms | Rooms missing from the current camera metadata are marked, named in a warning and excluded from service calls. | A re-map renumbers segments, and a stale selection could clean the wrong room. |
| Tile labels and icons | Tile translations match case-insensitively, labels use Home Assistant's entity naming when available, sensor durations follow the sensor's unit, and the return-to-base icon matches Home Assistant. | Upstream labels and durations were wrong on some integrations. |
| Cleaning order | Selected rooms show their position in the cleaning order. | The order was invisible even though it is sent to the platform. |
| Default view and layout | `map_view` sets the opening view with a reset action, and `layout: horizontal` places the map beside the controls with sections-view grid sizing. | Users were writing `card-mod` CSS for this. |

## Scope boundaries

- Keep the fork focused on concrete bugs and features with a Home Assistant use case; upstream
  behaviour stays the default elsewhere.
- Keep vendor-specific claims out unless they can be reproduced with a fixture or a device.
- Prefer small modules for fork-only logic so upstream syncs touch fewer lines.
- When a new intentional difference is added, record it here with what it changes and why.

## Syncing upstream

This checkout has an `upstream` remote. In a fresh clone:

```sh
git remote add upstream https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card.git
```

Before syncing, review both sides:

```sh
git fetch upstream
git log --left-right --cherry-pick --oneline upstream/master...master
git diff --stat upstream/master...master
```

Review the upstream changes against the differences above, keep the fork behaviour that still fits,
and move any item upstream has absorbed out of this file. Update the tests and the end-to-end suite
when a sync changes rendering, the editor or the refresh behaviour.
