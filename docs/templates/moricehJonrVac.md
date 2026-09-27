# JONR Vacuum by [@moriceh](https://github.com/moriceh/jonr-vac)

[Integration's documentation](https://github.com/moriceh/jonr-vac)

This platform can be used to control vacuums connected to Home Assistant using the **JONR Vacuum** (`jonr_vac`)
integration created by [@moriceh](https://github.com/moriceh) (supports `xtl.vacuum.xm2216` = JONR P20 Pro with a
washing/drying dock).

Set `vacuum_platform: moriceh/jonr-vac` on the card: it then auto-generates the map-mode templates, the
tiles and the icon menus below. The integration's map camera entity exposes a `calibration_points` attribute, so
`calibration_source: camera` works without any manual calibration, and the same camera image is used as
`map_source`.

> **Note:** coordinates are plugin-native *scene units* (5 cm per unit). The card's `coordinates_to_meters_divider`
> is display-only (rectangle size tooltip): templates set it to `20` to show correct metres; the values sent to the
> services are never divided.

> **Warning — duplicate modes in the visual editor:** when you select this platform on a card that *already* has
> explicit `map_modes`, the editor appends the platform's `default_templates` next to your existing entries (the
> runtime itself never merges — it uses your `map_modes` verbatim once you set them). If "Rooms" shows up twice,
> delete the hand-written duplicate and keep the single `- template:` entry.

## Available templates

* ### Whole-house cleaning (`vacuum_start`)

  Selecting the mode opens the map popup (×N repeats + ▶). Tapping ▶ runs `vacuum.start` right away — no
  selection on the map, no point to tap: the card only demands a selection for modes whose
  `service_call_schema` actually consumes `[[selection]]` (rooms/zones). The integration's stop+settle
  sequence then sends the `clean_type 1` full-area command. The action bar's own ▶ (`start_cleanup`, the
  common card icon) is available as well whenever the vacuum isn't already cleaning.

  Used service: `vacuum.start`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_start
  ```

  </details>

* ### Room cleaning (`vacuum_clean_segment`)

  Uses room IDs to clean specific rooms. The integration's map camera entity exposes a `rooms` attribute
  (one record per room with `id`, `name`, `x`, `y` and the traced `outline`, all in scene units) — copy those
  values into `predefined_selections`; the integration keeps them consistent with the room ids its
  `jonr_vac.clean_segment` service consumes.

  Used service: `jonr_vac.clean_segment`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      predefined_selections:
        - id: 4
          outline: [[ 429.5, 357.5 ], [ 431.5, 357.5 ], [ 482.5, 357.5 ], [ 482.5, 366.5 ], [ 490.5, 368.5 ], [ 490.5, 396.5 ], [ 430.5, 396.5 ]]
          label:
            text: "Bedroom"
            x: 459
            y: 376
            offset_y: 12
          icon:
            name: "mdi:bed"
            x: 459
            y: 376
  ```

  </details>

* ### Zone cleaning (`vacuum_clean_zone`)

  Uses rectangles `[x_min, y_min, x_max, y_max]` (scene units) to clean rectangular zones — this is exactly
  `jonr_vac.clean_zone`'s `zones` input format.

  Used service: `jonr_vac.clean_zone`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_zone
  ```

  </details>

* ### Predefined zone cleaning (`vacuum_clean_zone_predefined`)

  Same as above but zones are defined in the configuration and selected by tapping.

  Used service: `jonr_vac.clean_zone`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_zone_predefined
      predefined_selections:
        - zones: [[ 430, 358, 490, 396 ]]
          label:
            text: "Nightstand"
            x: 460
            y: 377
            offset_y: 12
          icon:
            name: "mdi:lamp"
            x: 460
            y: 377
  ```

  </details>

## Tiles

Generated from the integration's sensors, in display order (first array entry = first tile):

| tile | sensor unique_id suffix | shows |
|---|---|---|
| `status` | `_status` | robot state, already translated by the integration (`En station`, `Nettoyage`, …) |
| `battery_level` | `_battery` | % |
| `cleaning_time` | `_session_clean_time` | last session, minutes |
| `cleaned_area` | `_session_clean_area` | last session, m² |
| `total_cleaning_time` | `_total_clean_time` | lifetime, hours |
| `cleaning_count` | `_total_clean_count` | lifetime runs |
| `main_brush_left` / `side_brush_left` / `filter_left` / `mop_left` | `*_life` | % remaining |

Sensors are matched on their entity-registry `unique_id` (not the `entity_id` shown in the UI — HA localizes
those), which the integration bases on the device MAC, e.g. `AA:BB:CC:DD:EE:FF_fan_speed` behind
`select.<name>_puissance_d_aspiration`. Matching uses an anchored regex (`^[^_]+_…$`; `[^_]+` matches the MAC
base while keeping the collision guarantees: `_status` cannot match `_return_status`, `_count` cannot match
`_total_clean_count`). Add your own with `tiles:` + `append_tiles: true`, or hide a generated one with
`tiles: [{ tile_id: cleaning_count, remove: true }]`.

## Icons

Menu icons bound to the integration's selects (each opens a menu of the entity's `options`; tapping calls
`select.select_option`). Labels come from the integration's own translations, so they follow the UI language.
Order: `mode` (Vac&Mop / Sweep / Mop / Sweep then Mop / Custom), `fan_speed` (`mdi:gauge-empty` /
`mdi:gauge-low` / `mdi:gauge` / `mdi:gauge-full` for quiet → turbo), `water_level`, `route`.

Station-only selects (`dust_collection`, `drying_time`, `carpet_prefer`, `mop_wash_frequency`) are deliberately
not mapped — they exist in Home Assistant for automations but are not daily controls. Add any of them back with
`icons:` + `append_icons: true`.

## Not mapped

- `vacuum_goto` / `vacuum_clean_point`: `jonr_vac` currently has no single-point service (`remote_control` requires
  a stop call and would not suit a tap-to-go template). A future `goto` service would add the template with no
  calibration changes on the card side.
