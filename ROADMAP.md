# Roadmap

What this fork plans to work on next. The current state of the card is described in the
[README](README.md); released changes are in [CHANGELOG.md](CHANGELOG.md); the differences from
upstream are in [FORK.md](FORK.md).

## How to propose work

Open an issue on the fork tracker with the platform and Home Assistant version involved, the
configuration that shows the problem, and what you expected instead. A change is only planned when it
can be checked on one real Home Assistant instance: either by a fixture that reproduces the report or
by the behaviour being observable in the UI. Vendor behaviour that needs the physical robot stays out
until someone can provide that evidence.

Every change is expected to come with a test that fails first, pass the repository gates, and be
reviewed before release. See [CONTRIBUTING.md](CONTRIBUTING.md) for the local workflow.

## Now

- **Horizontal layout at narrow widths.** The map and controls sit side by side, but at the smallest
  sections-view spans the controls column is short and the map is small. Decide whether to stack
  below a width threshold and where the breakpoint sits.
- **Editor coverage on current frontends.** The editor already adapts to `ha-input` and to the
  removal of `ha-formfield`; keep watching Home Assistant frontend releases for the next element
  that disappears.

## Next

- **Roborock status and battery templates.** The generic duration handling is in place; the
  Roborock-specific tile templates need a real Roborock-core registry dump (the `unique_id`
  patterns and the status strings) before the regexes can be trusted.
- **Placement and sizing polish.** The sections-view grid options are a compromise: `layout:
  horizontal` asks for six rows, which is too tall for some cards and too short for others. A
  per-card override story that does not need `card-mod` would help.

## Later

- **Live path overlay on a static floorplan.** A static image already works as the map source
  (`map_source.image` plus `transparent_background`); what is missing is drawing the robot's live
  path on top of such an image.
- **Templated predefined selections.** Dynamic selections currently come from an entity's state or
  attribute. Supporting Jinja templates would be a large change and needs a concrete use case that
  entity-backed selections cannot serve.
- **Rotated zone rectangles.** Zone APIs are axis-aligned; supporting arbitrary quadrilaterals
  needs evidence that a target platform accepts four points.
- **Valetudo JSON map source and icons.** Large and platform-specific; needs a Valetudo instance or
  a captured fixture before it can be tested.
- **Ecovacs SVG viewbox handling.** Needs an Ecovacs SVG camera fixture.
- **Delayed start.** An automation or script does this better than the card.

## Postponed, with unblock conditions

| Item | Why it waits | Unblocks when |
|---|---|---|
| Roborock status/battery tiles | The templates need the integration's real registry entries | A scrubbed Roborock-core registry dump and a status string sample are available |
| Live path overlay on a static image | No fixture and no decision on how a path overlays a picture | A path entity fixture and an agreed rendering |
| Templated predefined selections | No concrete use case and a large Jinja subscription change | A report that entity-backed selections cannot serve |
| Rotated zone rectangles | No platform documented to accept arbitrary points | Vendor documentation or a working service call |
| Valetudo JSON map / icons | No Valetudo instance to verify | A captured map fixture or a Valetudo instance |
| Ecovacs SVG viewbox | No Ecovacs fixture | An Ecovacs SVG camera capture |
| Delayed start | A script or automation is the better place | A product reason that belongs in the card |
| Collapse map | `card-mod` and conditional cards already cover it | It becomes free alongside another layout change |

## Open questions and risks

- **Version comparison across the rename.** The fork's own line starts at 1.0.0 while the previous
  pre-versioning tag is `v2.5.0-igloczek.1`, so a strict version updater may not offer 1.0.0 as an
  update. Watch how Marketplace and HACS handle that and document a migration if they do not.
- **HACS to Marketplace.** Home Assistant 2026.11 blocks the HACS integration and migrates installs
  to the Marketplace. Keep `hacs.json` accurate for older releases while the Marketplace path is the
  one that gets exercised.
- **Vendor-specific ordering.** The card can show the cleaning order and send selections in click
  order; whether a platform honours that order is vendor behaviour and cannot be promised here.
- **Real-device coverage.** Camera request rates, map refresh timing and long-name layouts are
  proven on a local Home Assistant with a fixture camera. Firmware quirks that change snapshot
  timing or room metadata need a report with logs.
- **Test environment drift.** The end-to-end suite pins Home Assistant 2026.11.0; new frontend
  releases can remove elements or change layouts, so re-run the suite when bumping the image.
