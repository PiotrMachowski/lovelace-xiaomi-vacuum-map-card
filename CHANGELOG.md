# Changelog

## 1.0.7

### Fixed

- Rooms are no longer locked after the vacuum has returned to the dock: a run ends as soon as the
  vacuum is docked, idle or in error. Before the vacuum reports that it started, a tap on a room
  starts a new selection instead of being refused.
- Dragging, pinching or rotating the map no longer selects the room under the pointer.

### Documentation

- Removed the one-room-at-a-time script recipe. A per-installation script is not a fix; the docs
  state that some vacuums (Viomi V8) ignore the room order instead.

## 1.0.6

### Fixed

- Tapping a cleaning path, or a small marker drawn over a room, selects that room. A path that
  crossed a room no longer shrinks the room's highlight to one side of it: gaps up to 8 px that
  the map draws over a room's colour are treated as part of the room.

## 1.0.5

### Fixed

- A run that docks between rooms keeps its order and lock: the run ends only once the vacuum has
  stayed out of `cleaning`, `paused` and `returning` for 90 seconds, and the card ends it on time
  even without a further state change.

### Documentation

- The one-room-at-a-time script waits until the vacuum has docked before sending the next room
  (the Viomi V8 ignores a room command while heading home) and resends a room that does not start.

## 1.0.4

### Changed

- During a run the rooms keep exactly the look they had when selected; the separate dashed style is
  gone.

### Fixed

- Rooms cannot be tapped while a run is in progress, so the cleaning order on the map cannot change
  until the vacuum is done.

## 1.0.3

### Fixed

- The cleaning order stays on the map after **Start**: the rooms of the run keep their numbers,
  with a dashed outline, until the vacuum is done. A reload keeps them.

### Documentation

- How to clean rooms in a fixed order on vacuums that plan their own route (Viomi V8): a script
  that sends one room at a time, started from the card.

## 1.0.2

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
