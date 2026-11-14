# Changelog

## Unreleased

### Added

- Agent problem reports: a user's AI agent collects, redacts and files a card problem with the
  [report-problem skill](.agents/skills/report-problem/SKILL.md); valid reports are labelled
  `agent-report`, and leaked tokens are removed from issues and comments automatically. See
  [Report a problem](docs/report-a-problem.md).

### Fixed

- Selected rooms keep the order they were clicked in when the live map refreshes, instead of
  falling back to room-id order.
- A ROOM mode with `evaluate_data_as_template` runs again with room ids from the camera metadata;
  a template error now shows a failure message instead of the run button doing nothing.

## 1.0.1

### Fixed

- The map viewport is transparent instead of Home Assistant's secondary grey, so a map with
  transparent or near-white areas blends into the card in light and dark themes. Set
  `--map-card-zoomer-background` to keep a visible frame.

## 1.0.0

First release of this fork under its own name and version line, based on upstream `v2.4.2`.

### Added

- Cleaning-order badges on selected rooms.
- `map_view` default view with a reset control and the `map_view.reset` action.
- `layout: horizontal` and sections-view grid sizing.
- Automatic room mapping from camera metadata and map colours.
- Persisted map view and rotation, with two-finger rotation.
- Transparent near-white map pixels and high-contrast room labels.

### Changed

- The camera snapshot reloads on a camera change or about once per five seconds instead of on every
  entity update, and stops while the tab is hidden.
- One scoped entity-registry lookup per vacuum, cached per device, replaces downloading the whole
  registry.
- Tile translations match regardless of case; labels, sensor durations and the return-to-base icon
  follow Home Assistant.
- Incomplete configurations and invalid dynamic selections produce validation messages instead of
  exceptions.
- The editor no longer mutates Home Assistant's frozen configuration, scopes room requests to the
  card being edited, and keeps a single rooms mode across repeated generation.
- Rooms removed by a re-map are marked, warned about and excluded from service calls.
- Editor controls follow the frontend: `ha-input` with an `ha-textfield` fallback, and labelled
  switches when `ha-formfield` is absent.

### Fixed

- Zoom and rotation are applied once to the image and its overlays, so room outlines stay aligned.
- A long mode name in the horizontal layout ellipsizes inside the controls column instead of being
  clipped without an ellipsis.
