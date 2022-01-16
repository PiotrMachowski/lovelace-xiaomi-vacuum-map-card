[![HACS Default][hacs_shield]][hacs]
[![GitHub Latest Release][releases_shield]][latest_release]
[![GitHub All Releases][downloads_total_shield]][releases]
[![Community Forum][community_forum_shield]][community_forum]
[![Buy me a coffee][buy_me_a_coffee_shield]][buy_me_a_coffee]
[![PayPal.Me][paypal_me_shield]][paypal_me]


[hacs_shield]: https://img.shields.io/static/v1.svg?label=HACS&message=Default&style=popout&color=green&labelColor=41bdf5&logo=HomeAssistantCommunityStore&logoColor=white
[hacs]: https://hacs.xyz/docs/default_repositories

[latest_release]: https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases/latest
[releases_shield]: https://img.shields.io/github/release/PiotrMachowski/lovelace-xiaomi-vacuum-map-card.svg?style=popout

[releases]: https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases
[downloads_total_shield]: https://img.shields.io/github/downloads/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/total

[community_forum_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Forum&style=popout&color=41bdf5&logo=HomeAssistant&logoColor=white
[community_forum]: https://community.home-assistant.io/t/xiaomi-vacuum-interactive-map-card/123901

[buy_me_a_coffee_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Buy%20me%20a%20coffee&color=6f4e37&logo=buy%20me%20a%20coffee&logoColor=white
[buy_me_a_coffee]: https://www.buymeacoffee.com/PiotrMachowski

[paypal_me_shield]: https://img.shields.io/static/v1.svg?label=%20&message=PayPal.Me&logo=paypal
[paypal_me]: https://paypal.me/PiMachowski


# Lovelace Vacuum Map card

This card provides a user-friendly way to fully control Xiaomi (Roborock/Viomi/Dreame/Roidmi) and Neato (+ possibly
other) vacuums in [Home Assistant](https://www.home-assistant.io/).


https://user-images.githubusercontent.com/6118709/140251738-7fb06e81-34b0-4bf8-b7b1-2221d0062331.mp4


## Table of contents
  - [Features](#features)
  - [Installation](#installation)
    - [HACS](#hacs)
    - [Manual](#manual)
  - [Configuration](#configuration)
    - [Main options](#main-options)
    - [Preset options](#preset-options)
    - [Map source options](#map-source-options)
      - [Cropping options](#cropping-options)
    - [Calibration source options](#calibration-source-options)
      - [Calibration points options](#calibration-points-options)
    - [Supported vacuum platforms](#supported-vacuum-platforms)
    - [Icon list entry options](#icon-list-entry-options)
    - [Tile list entry options](#tile-list-entry-options)
    - [Condition options](#condition-options)
    - [Map modes options](#map-modes-options)
      - [Supported templates](#supported-templates)
      - [Supported selection types](#supported-selection-types)
      - [Service call schema options](#service-call-schema-options)
      - [Supported repeats types](#supported-repeats-types)
      - [Predefined selection options](#predefined-selection-options)
      - [Icon options](#icon-options)
      - [Label options](#label-options)
  - [Hints](#hints)
  - [FAQ](#faq)
  - [Migrating from v1.x.x](#migrating-from-v1xx)
  - [Translations](#translations)
  - [Special thanks](#special-thanks)

## Features

Features include:

- Map-based controls:
    - Zoned cleaning (manual and saved)
    - Going to target (manual and saved)
    - Room cleaning
    - Following path
    - Custom services
- Icon controls:
    - Conditional visibility
    - Customizable service calls
- Value tiles:
    - Customizable content
    - Conditional visibility
    - Customizable service calls
- General:
    - Multiple vacuums support
    - Multiple maps (camera/image) support
    - Fully customizable styling

## Installation

### HACS

- Open HACS
- Go to "Frontend" section
- Click button with "+" icon
- Search for "Xiaomi Vacuum Map"
- Install repository in HACS
- Make sure you have added this card to [Lovelace resources](https://my.home-assistant.io/redirect/lovelace_resources/)
  ```yaml
  url: /hacsfiles/lovelace-xiaomi-vacuum-map-card/xiaomi-vacuum-map-card.js
  type: module
  ```
- Refresh your browser

### Manual

- Download `xiaomi-vacuum-map-card.js` file from the [latest release](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases/latest)
- Save downloaded file somewhere in `<ha config>/www/` directory, e.g. `/config/www/custom_lovelace/xiaomi-vacuum-map-card.js`
- Add saved file to [Lovelace resources](https://my.home-assistant.io/redirect/lovelace_resources/)
  ```yaml
  url: /local/custom_lovelace/xiaomi-vacuum-map-card.js
  type: module
  ```
- Restart HA if you had to create `www` directory
- Refresh your browser

## Configuration

This card contains UI configuration editor, but it is limited to only basic set of features.
Its full potential can be achieved by manual yaml adjustments.

:warning::warning::warning:

You can use this configuration as an example: [demo config](/docs/demo_config.yaml) (configuration used in full_demo.mp4).

:warning::warning::warning:

### Main options

<table>
  <tr>
    <th>Key</th>
    <th>Type</th>
    <th>Required</th>
    <th>Default</th>
    <th>Description</th>
  </tr>
  <tr>
    <td><code>title</code></td>
    <td>string</td>
    <td>no</td>
    <td><i>empty</i></td>
    <td>Card's title</td>
  </tr>
  <tr>
    <td><code>language</code></td>
    <td>string</td>
    <td>no</td>
    <td><i>autodetected</i></td>
    <td>Overrides autodetected language (<a href="#translations">supported languages</a>)</td>
  </tr>
  <tr>
    <td><code>additional_presets</code></td>
    <td>list</td>
    <td>no</td>
    <td><i>empty</i></td>
    <td>A list of additional <a href="#preset-options">presets</a> (e.g. with different map/vacuum)</td>
  </tr>
  <tr>
    <td colspan="5" style="text-align: center">
      All values from <a href="#preset-options">preset options</a> section
    </td>
  </tr>
</table>

### Preset options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `preset_name` | string | yes<br><small>(if multiple presets are configured)</small> | - | Name of the preset |
| `entity` | string | yes | - | Vacuum entity |
| `map_source` | string | yes | - | Preset's [map source](#map-source-options) |
| `calibration_source` | object | yes | - | Preset's [calibration source](#calibration-source-options) |
| `vacuum_platform` | string | no | `default` | Preset's [vacuum platform](#supported-vacuum-platforms) |
| `map_locked` | boolean | no | `false` | Default state of pan/zoom |
| `two_finger_pan` | string | no | `false` | Enables two finger map panning  |
| `icons` | list | no | _autogenerated_ | Preset's [icons](#icon-list-entry-options) |
| `append_icons` | boolean | no | `false` | Enables appending configured icons to autogenerated ones instead of replacing them |
| `tiles` | list | no | _autogenerated_ | Preset's [tiles](#tile-list-entry-options) |
| `append_tiles` | boolean | no | `false` | Enables appending configured tiles to autogenerated ones instead of replacing them |
| `map_modes` | list | no | _autogenerated_ | Preset's [map modes](#map-modes-options) |
| `activate` | object | no | - | [Service call](#service-call-schema-options) that should be executed after clicking preset name |
| `activate_on_switch` | boolean | no | `false` | Enables executing `activate` service call after switching map preset |
| `conditions` | list | no | - | List of [conditions](#condition-options) that need to be (all of them) met for preset to be shown |
| `clean_selection_on_start` | boolean | no | `true` | Allows to disable cleaning selection on cleanup start |

### Map source options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `camera` | string | no<sup>1</sup> | - | Entity id of map camera |
| `image` | string | no<sup>1</sup> | - | URL of map image |
| `crop` | object | no | _no cropping_ | Images [cropping options](#cropping-options) |

<sup>1</sup> Exactly one of `camera` or `image` must be provided

#### Cropping options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `top` | number | no | 0 | Image cropping value from the top (in pixels) |
| `bottom` | number | no | 0 | Image cropping value from the bottom (in pixels) |
| `left` | number | no | 0 | Image cropping value from the left (in pixels) |
| `right` | number | no | 0 | Image cropping value from the right (in pixels) |

### Calibration source options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `camera` | boolean | no<sup>1</sup> | - | Enables retrieving calibration from camera defined in `map_source` ([Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor)) |
| `entity` | string | no<sup>1</sup> | - | Entity with calibration returned as a state |
| `attribute` | string | no | - | Enables usage of a configured attribute instead of state of given entity |
| `calibration_points` | list | no<sup>1</sup> | - | List of 3 or 4 [calibration points](#calibration-points-options) |
| `identity` | boolean | no<sup>1</sup> | - | Enables using image coordinates on map (e.g. when map is used just for rooms) |

<sup>1</sup> Exactly one of `camera`, `entity`, `calibration_points` or `identity` must be provided

#### Calibration points options

Each of calibration points must have a following structure:
```yaml
vacuum: # coordinates of a point in a vacuum coordinate system
  x: 25500
  y: 25500
map: # coordinates of a point in a map coordinate system (can be read using e.g. Paint or Gimp)
  x: 466
  y: 1889
```

[Manual calibration guide](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/wiki)

### Supported vacuum platforms

Following vacuum platforms are supported at this moment:
- `default`: [Built-in Xiaomi Miio integration](https://www.home-assistant.io/integrations/xiaomi_miio/#xiaomi-mi-robot-vacuum)
- `KrzysztofHajdamowicz/miio2`: [Custom miio2 integration by KrzysztofHajdamowicz](https://github.com/KrzysztofHajdamowicz/home-assistant-vacuum-styj02ym)
- `marotoweb/viomise`: [Custom Viomi SE integration by marotoweb](https://github.com/marotoweb/home-assistant-vacuum-viomise)
- `send_command`: Uses `vacuum.send_command` service with commands: `app_zoned_clean`, `app_goto_target`, `app_segment_clean`
- `Neato`:  [Built-in Neato integration](https://www.home-assistant.io/integrations/neato)

[Adding a new platform](CONTRIBUTING.md#adding-new-platform)

### Icon list entry options

![icons image](/docs/icons.png)

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `icon` | string | yes | - | An icon to be displayed ([mdi](https://materialdesignicons.com/)) |
| `tap_action` | action | no | _more-info_ | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is tapped |
| `hold_action` | action | no | - | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is held and released |
| `double_tap_action` | action | no | - | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is double-tapped |
| `conditions` | list | no | - | List of [conditions](#condition-options) that need to be (all of them) met for an icon to be shown |
| `tooltip` | string | false | - | Tooltip to be displayed on hoover |

### Tile list entry options

![tiles image](/docs/tiles.png)

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `label` | string | yes | - | Label of a tile |
| `entity` | string | yes | - | Entity which should be shown on a tile |
| `icon` | string | no | - | An icon to be displayed ([mdi](https://materialdesignicons.com/)) |
| `attribute` | string | no | - | Attribute that should be shown on a tile |
| `multiplier` | number | no | - | Multiplier that should be used to calculate value shown on a tile |
| `precision` | number | no | - | Precision that should be used to present value on a tile |
| `unit` | string | no | - | Unit to be used |
| `tap_action` | action | no | _more-info_ | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is tapped |
| `hold_action` | action | no | - | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is held and released |
| `double_tap_action` | action | no | - | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is double-tapped |
| `conditions` | list | no | - | List of [conditions](#condition-options) that need to be (all of them) met for a tile to be shown |
| `tooltip` | string | false | - | Tooltip to be displayed on hoover |
| `translations` | map | false | - | Translations that should be applied to tile's value |

### Condition options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `entity` | string | yes | - | Entity ID |
| `attribute` | string | no | - | Attribute to use instead of entity state |
| `value` | string | no<sup>1</sup> | - | Entity state/attribute has to be equal to this value |
| `value_not` | string | no<sup>1</sup> | - | Entity state/attribute has to be unequal to this value |

<sup>1</sup> Exactly one of them has to be provided

### Map modes options

![map modes image](/docs/map_modes.png)

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `template` | string | no<sup>1</sup> | - | Map mode template to be used ([supported templates](#supported-templates)) |
| `name` | string | yes<sup>2</sup> | - | Name of map mode |
| `icon` | string | yes<sup>2</sup> | - | Icon of map mode ([mdi](https://materialdesignicons.com/)) |
| `selection_type` | string | yes<sup>2</sup> | - | Type of selection, one of [supported ones](#supported-selection-types) |
| `service_call_schema` | object | yes<sup>2</sup> | - | [Service call schema](#service-call-schema-options) that should be used in this mode |
| `run_immediately` | boolean | no | `false` | Enables calling service immediately after choosing a selection |
| `coordinates_rounding` | boolean | no | `true` | Enables coordinates rounding |
| `max_selections` | integer | no | 1 | Maximal number of selections |
| `repeats_type` | string | no | `NONE` | Type of repeats inclusion, one of [supported ones](#supported-repeats-types) |
| `max_repeats` | integer | no | 1 | Maximal value of repeats |
| `predefined_selections` | list | no<sup>3</sup> | - |   |

> You can override any value from built-in template by providing it in your configuration

<sup>1</sup> Not required if all parameters with (<sup>2</sup>) are provided

<sup>2</sup> Required if `template` is not provided

<sup>3</sup> Required if `template` is not provided and `selection_type` is one of: `PREDEFINED_RECTANGLE`, `PREDEFINED_POINT`, `ROOM`

#### Supported templates

List of supported templates depends on selected `vacuum_platform`:

- `default`:
  - `vacuum_clean_zone`: Cleaning free-drawn rectangular zones on the map
  - `vacuum_clean_zone_predefined`: Cleaning rectangular zones that can be selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_goto`: Going to point selected by clicking in an arbitrary place on the map
  - `vacuum_goto_predefined`: Going to point selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_clean_segment`: Room cleaning based on identifier - room number ([getting outline](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318), [config generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317))
  - `vacuum_follow_path`: Following path selected by clicking on the map (using [script](/docs/follow_path.yaml))
- `KrzysztofHajdamowicz/miio2`
  - `vacuum_clean_zone`: Cleaning free-drawn rectangular zones on the map
  - `vacuum_clean_zone_predefined`: Cleaning rectangular zones that can be selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_goto`: Going to point selected by clicking in an arbitrary place on the map
  - `vacuum_goto_predefined`: Going to point selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_clean_segment`: Room cleaning based on identifier - room number ([getting outline](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318), [config generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317))
  - `vacuum_follow_path`: Following path selected by clicking on the map (using [script](/docs/follow_path.yaml))
- `marotoweb/viomise`
  - `vacuum_clean_zone`: Cleaning free-drawn rectangular zones on the map
  - `vacuum_clean_zone_predefined`: Cleaning rectangular zones that can be selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_clean_point`: Cleaning around point selected by clicking in an arbitrary place on the map
  - `vacuum_clean_point_predefined`: Cleaning around point selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
- `send_command`
  - `vacuum_clean_zone`: Cleaning free-drawn rectangular zones on the map
  - `vacuum_clean_zone_predefined`: Cleaning rectangular zones that can be selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_goto`: Going to point selected by clicking in an arbitrary place on the map
  - `vacuum_goto_predefined`: Going to point selected on the map from `predefined_selections` ([getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))
  - `vacuum_clean_segment`: Room cleaning based on identifier - room number ([getting outline](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318), [config generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317))
  - `vacuum_follow_path`: Following path selected by clicking on the map (using [script](/docs/follow_path.yaml))
- `Neato`
  - `vacuum_clean_segment`: Room cleaning based on identifier ([getting outline](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318))

> See [hints](#hints) to check how to easily retrieve zone/point coordinates.


#### Supported selection types

Following selection types are supported at this moment:
 - `MANUAL_RECTANGLE`: Free-drawn rectangular zones on the map
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666913-d95f082d-f5bf-4ab5-a478-ba44effe6f34.mp4

   </details>
 - `PREDEFINED_RECTANGLE`: Rectangular zones that can be selected on the map from `predefined_selections`
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666920-492a000c-9a78-4c20-b4f5-9343928140c7.mp4

   </details>
 - `MANUAL_POINT`: Point selected by clicking in an arbitrary place on the map
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666921-2f3d66da-6ffc-492a-8439-625da97651bd.mp4

   </details>
 - `PREDEFINED_POINT`: Point selected on the map from `predefined_selections`
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666923-965679e9-25fb-44cd-be08-fc63e5c85ce0.mp4

   </details>
 - `ROOM`: Identifier-based selection with free-drawn outline
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666925-34b01cde-82ff-447b-aecc-e9ced402b1ed.mp4

   </details>
 - `MANUAL_PATH`: Path selected by clicking on the map
   <details>
   <summary>Example video</summary>

     https://user-images.githubusercontent.com/6118709/141666931-48d1717f-96d0-461d-84f4-788c071f3a78.mp4

   </details>

#### Service call schema options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `service` | string | yes | - | Service that should be called in a given mode |
| `service_data` | object | no | - | Data that should be passed to service call |

It is possible to use several placeholders in `service_data` section. They will be replaced by:
 - `[[entity_id]]`: `entity_id` defined in preset's config
 - `[[selection]]`: selection made on the map (zone, point or path)
 - `[[selection_size]]`: number of selections made on the map
 - `[[selection_unwrapped]]`: the same as `[[selection]]`, but passed as string unwrapped from brackets
 - `[[repeats]]`:  selected number of repeats
 - `[[point_x]]`: x coordinate of selected point (for `MANUAL_POINT` and `PREDEFINED_POINT` selection types)
 - `[[point_y]]`: y coordinate of selected point (for `MANUAL_POINT` and `PREDEFINED_POINT` selection types)

It is possible to use following modifiers in `service_data` section:
- `|[[jsonize]]`: if value ends with this modifier it will be decoded as a JSON


#### Supported repeats types

Following repeats types are supported at this moment:
 - `NONE`: No repeats
 - `INTERNAL`: Repeats number included in coordinates array (`[25500, 25000, 26500, 26500, 2]`)
 - `EXTERNAL`: Repeats number used as a separate attribute in `service_call_schema`
 - `REPEAT`: Repeats selection (repeats: `2`, selection: `[5,6]` => `[5,6,5,6]`)

#### Predefined selection options

Format of data depends on selected `selection_type`:
* `PREDEFINED_RECTANGLE`

  | Key | Type | Required | Default | Description |
  | --- | --- | --- | --- | --- |
  | `zones` | list | yes | - | List of lists containing zone's coordinates in `[x,y,width,height]` format (e.g. `[[25500, 25000, 26500, 26500]]`) |
  | `icon` | object | no | - | [Icon definition](#icon-options) |
  | `label` | object | no | - | [Label definition](#label-options) |

  > See [hints](#hints) to check how to easily retrieve zone coordinates.

* `PREDEFINED_POINT`

  | Key | Type | Required | Default | Description |
  | --- | --- | --- | --- | --- |
  | `position` | list | yes | - | Point's coordinates in `[x,y]` format (e.g. `[25500, 25000]`) |
  | `icon` | object | no | - | [Icon definition](#icon-options) |
  | `label` | object | no | - | [Label definition](#label-options) |

  > See [hints](#hints) to check how to easily retrieve point coordinates.

* `ROOM`

  | Key | Type | Required | Default | Description |
  | --- | --- | --- | --- | --- |
  | `id` | string or number | yes | - | Room's identifier |
  | `outline` | list | no | - | List of points forming an outline of a room (e.g. `[[25500,25500],[26500,25500],[25500,26500]]` |
  | `icon` | object | no | - | [Icon definition](#icon-options) |
  | `label` | object | no | - | [Label definition](#label-options) |

  > See [hints](#hints) to check how to easily create outline.

#### Icon options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `name` | string | yes | - | An icon to be displayed ([mdi](https://materialdesignicons.com/)) |
| `x` | number | yes | - | X coordinate of an icon (in vacuum's coordinate system) |
| `y` | number | yes | - | Y coordinate of an icon (in vacuum's coordinate system) |

#### Label options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `text` | string | yes | - | Text to be displayed |
| `x` | number | yes | - | X coordinate of a label (in vacuum's coordinate system) |
| `y` | number | yes | - | Y coordinate of a label (in vacuum's coordinate system) |
| `offset_x` | number | no | - | Offset that should be applied to label in X direction (in pixels) |
| `offset_y` | number | no | - | Offset that should be applied to label in Y direction (in pixels) |


## FAQ

- **Make sure to check out [FAQ section in Discussions](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/categories/faq), it contains a lot of useful information**

- **Does this card require rooted device?**

  No, it only utilizes features of Home Assistant.

- **How to create a map?**

  The easiest way is to use [Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor), but you can use any image (e.g. a screenshot from Mi Home/FloleVac).

- **Can I use image that has a perspective distortion?**

  Yes, you just have to provide 4 calibration points.

## Migrating from v1.x.x

<details>
<summary>Configuration with <code>map_image</code></summary>
<table>
<tr>
<th>Old config (<code>v1.x.x</code>)</th><th>New config (<code>v2.x.x)</code></th>
</tr>
<tr>
<td>
<pre>
type: custom:xiaomi-vacuum-map-card
entity: vacuum.xiaomi_vacuum
map_image: '/local/custom_lovelace/xiaomi_vacuum_map_card/map.png'
calibration_points:
  - vacuum:
      x: 25500
      y: 25500
    map:
      x: 466
      y: 1889
  - vacuum:
      x: 26500
      y: 26500
    map:
      x: 730
      y: 1625
  - vacuum:
      x: 25500
      y: 26500
    map:
      x: 466
      y: 1625
zones:
  - [[25500, 25500, 26500, 26500]]
  - [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
</pre>
</td>
<td>
<pre>
type: custom:xiaomi-vacuum-map-card
entity: vacuum.xiaomi_vacuum
map_source:
  image: '/local/custom_lovelace/xiaomi_vacuum_map_card/map.png'
calibration_source:
  calibration_points:
    - vacuum:
        x: 25500
        y: 25500
      map:
        x: 466
        y: 1889
    - vacuum:
        x: 26500
        y: 26500
      map:
        x: 730
        y: 1625
    - vacuum:
        x: 25500
        y: 26500
      map:
        x: 466
        y: 1625
map_modes:
  - template: vacuum_clean_zone
  - template: vacuum_goto
  - template: vacuum_clean_zone_predefined
    predefined_selections:
      - zones: [[25500, 25500, 26500, 26500]]
      - zones: [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
</pre>
</td>
</tr>
</table>
</details>
<br/>
<details>
<summary>Configuration with <code>map_camera</code></summary>
<table>
<tr>
<th>Old config (<code>v1.x.x</code>)</th><th>New config (<code>v2.x.x)</code></th>
</tr>
<tr>
<td>
<pre>
type: custom:xiaomi-vacuum-map-card
entity: vacuum.xiaomi_vacuum
map_camera: camera.xiaomi_cloud_map_extractor
camera_calibration: true
zones:
  - [[25500, 25500, 26500, 26500]]
  - [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
</pre>
</td>
<td>
<pre>
type: custom:xiaomi-vacuum-map-card
entity: vacuum.xiaomi_vacuum
map_source:
  camera: camera.xiaomi_cloud_map_extractor
calibration_source:
  camera: true
map_modes:
  - template: vacuum_clean_zone
  - template: vacuum_goto
  - template: vacuum_clean_zone_predefined
    predefined_selections:
      - zones: [[25500, 25500, 26500, 26500]]
      - zones: [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
</pre>
</td>
</tr>
</table>
</details>

## Translations

Currently, this card contains translations for following languages:
* `cs` - Czech (Čeština)
* `da` - Danish (Dansk)
* `de` - German (Deutsch)
* `el` - Greek (Ελληνικά)
* `en` - English
* `es` - Spanish (Español)
* `fr` - French (Français)
* `he` - Hebrew (עברית)
* `hu` - Hungarian (Magyar)
* `is` - Icelandic (Íslenska)
* `it` - Italian (Italiano)
* `nl` - Dutch (Nederlands)
* `pl` - Polish (Polski)
* `pt-BR` - Brazilian Portuguese (Português Brasileiro)
* `ru` - Russian (Русский)
* `sv` - Swedish (Svenska)
* `uk` - Ukrainian (Українська)
* `zh` - Chinese (中文)
* `zh-Hant` - Traditional Chinese (正體中文)

[Adding a new language](CONTRIBUTING.md#adding-new-translations)

## Special thanks

I'd like to give special thanks to people who helped me with card's design and development:
* [Bartosz Orczyk](www.bratver.com)
* [Filip Schramm](https://github.com/fi-sch)
* [Kamil Dryzek](https://github.com/dryzek)
* [Marek Trochimiak](https://github.com/tromarek1)


<a href="https://www.buymeacoffee.com/PiotrMachowski" target="_blank"><img src="https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>
