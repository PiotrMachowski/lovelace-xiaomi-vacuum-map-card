# Changelog

## 2.6.0

The fork's first release under its own version number and the "Better Xiaomi Vacuum Map Card"
name; earlier fork tags used a local `-igloczek.N` suffix for the same code, so treat the items below
as the state of 2.6.0 rather than as changes since `v2.5.0-igloczek.1`. The
custom element (`custom:xiaomi-vacuum-map-card`), the release asset (`xiaomi-vacuum-map-card.js`) and
every existing configuration are unchanged.

### Fixed

- Map refresh policy: the camera snapshot reloads on a camera change or once per interval instead of
  on every vacuum, tile or icon update, and a hidden tab stops reloading.
- Registry lookup: one scoped `get_entries` call per vacuum, cached per device, instead of
  downloading the whole entity registry.
- Configuration robustness: an incomplete configuration reports the missing field instead of
  throwing, and invalid dynamic selections are ignored.
- Editor room configuration: generating rooms no longer mutates Home Assistant's frozen config,
  answers only the card that asked, and repeated generation leaves one ROOM mode.
- Tiles: case-insensitive translations, `formatEntityName` labels behind a frontend-version gate,
  `duration_unit` for sensor tiles, and the core `return_to_base` icon.
- Stale room ids after a re-map are marked, named in a warning and excluded from service calls.
- Zoom alignment and overlay scaling are covered by the local scale check and the visual suite.

### Added

- Cleaning-order badges on selected rooms.
- `map_view` default view plus a reset action.
- `layout: horizontal` and sections-view grid sizing, so the card no longer needs `card-mod` for a
  side-by-side arrangement.
- Automatic room mapping from camera metadata and map colours, remembered map view and rotation, and
  near-white map transparency (carried from the fork's earlier work).

### Verification

Vitest with happy-dom, a Playwright visual suite, and a real-Home-Assistant end-to-end suite
(`test/e2e`) that drives the editor, map view, layouts, zoom/rotation at 2.5x/90 degrees, camera
request rate and YAML parsing on a Dockerised Home Assistant, installed through the Marketplace.
