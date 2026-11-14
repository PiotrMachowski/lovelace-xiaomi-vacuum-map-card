# Changelog

## 1.0.0

First release of this fork under its own name and version line. It is based on upstream `v2.4.2`;
the numbering restarts at 1.0.0 because this is a separately named project. The earlier
`v2.5.0-igloczek.1` tag was a pre-versioning snapshot and differs by the editor switch-label fix
and the horizontal mode-name ellipsis below.

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
