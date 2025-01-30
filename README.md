[![HACS Default][hacs_shield]][hacs]
[![GitHub Latest Release][releases_shield]][latest_release]
[![GitHub All Releases][downloads_total_shield]][releases]
[![Community Forum][community_forum_shield]][community_forum]<!-- piotrmachowski_support_badges_start -->
[![Ko-Fi][ko_fi_shield]][ko_fi]
[![buycoffee.to][buycoffee_to_shield]][buycoffee_to]
[![PayPal.Me][paypal_me_shield]][paypal_me]
[![Revolut.Me][revolut_me_shield]][revolut_me]
<!-- piotrmachowski_support_badges_end -->


[hacs_shield]: https://img.shields.io/static/v1.svg?label=HACS&message=Default&style=popout&color=green&labelColor=41bdf5&logo=HomeAssistantCommunityStore&logoColor=white

[hacs]: https://hacs.xyz/docs/default_repositories

[latest_release]: https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases/latest

[releases_shield]: https://img.shields.io/github/release/PiotrMachowski/lovelace-xiaomi-vacuum-map-card.svg?style=popout

[releases]: https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases

[downloads_total_shield]: https://img.shields.io/github/downloads/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/total

[community_forum_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Forum&style=popout&color=41bdf5&logo=HomeAssistant&logoColor=white

[community_forum]: https://community.home-assistant.io/t/xiaomi-vacuum-interactive-map-card/123901

# Lovelace Vacuum Map card

This card provides a user-friendly way to fully control map-based vacuums
in [Home Assistant](https://www.home-assistant.io/).
Supported brands include Xiaomi (Roborock/Viomi/Dreame/Roidmi/Valetudo/Valetudo RE), Neato, Wyze, Roomba, Ecovacs (and
probably more).

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
  - [Available actions](#available-actions)
- [FAQ](#faq)
- [Migrating from v1.x.x](#migrating-from-v1xx)
- [Translations](#translations)
- [Special thanks](#special-thanks)
- [Support](#support)

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

- Download `xiaomi-vacuum-map-card.js` file from
  the [latest release](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/releases/latest)
- Save downloaded file somewhere in `<ha config>/www/` directory,
  e.g. `/config/www/custom_lovelace/xiaomi-vacuum-map-card.js`
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

You can use this configuration as an example: [demo config](/docs/demo_config.yaml) (configuration used in
full_demo.mp4).

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
    <td><code>action_handler_id</code></td>
    <td>string</td>
    <td>no</td>
    <td>-</td>
    <td>Enables <a href="#action-handling">action handling</a></td>
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

| Key                        | Type    | Required        | Default         | Description                                                                                       |
|----------------------------|---------|-----------------|-----------------|---------------------------------------------------------------------------------------------------|
| `preset_name`              | string  | yes<sup>1</sup> | -               | Name of the preset                                                                                |
| `entity`                   | string  | yes             | -               | Vacuum entity                                                                                     |
| `map_source`               | string  | yes             | -               | Preset's [map source](#map-source-options)                                                        |
| `calibration_source`       | object  | yes<sup>2</sup> | -               | Preset's [calibration source](#calibration-source-options)                                        |
| `vacuum_platform`          | string  | no              | `default`       | Preset's [vacuum platform](#supported-vacuum-platforms)                                           |
| `map_locked`               | boolean | no              | `false`         | Default state of pan/zoom                                                                         |
| `two_finger_pan`           | string  | no              | `false`         | Enables two finger map panning                                                                    |
| `icons`                    | list    | no              | _autogenerated_ | Preset's [icons](#icon-list-entry-options)                                                        |
| `append_icons`             | boolean | no              | `false`         | Enables appending configured icons to autogenerated ones instead of replacing them                |
| `tiles`                    | list    | no              | _autogenerated_ | Preset's [tiles](#tile-list-entry-options)                                                        |
| `append_tiles`             | boolean | no              | `false`         | Enables appending configured tiles to autogenerated ones instead of replacing them                |
| `map_modes`                | list    | no              | _autogenerated_ | Preset's [map modes](#map-modes-options)                                                          |
| `activate`                 | object  | no              | -               | [Service call](#service-call-schema-options) that should be executed after clicking preset name   |
| `activate_on_switch`       | boolean | no              | `false`         | Enables executing `activate` service call after switching map preset                              |
| `conditions`               | list    | no              | -               | List of [conditions](#condition-options) that need to be (all of them) met for preset to be shown |
| `clean_selection_on_start` | boolean | no              | `true`          | Allows to disable cleaning selection on cleanup start                                             |
| `internal_variables`       | object  | no              | -               | Allows to specify default values for internal variables                                           |

<sup>1</sup> If multiple presets are configured

<sup>2</sup> Not mandatory when used with a platform that support a default calibration

### Map source options

| Key      | Type   | Required       | Default       | Description                                  |
|----------|--------|----------------|---------------|----------------------------------------------|
| `camera` | string | no<sup>1</sup> | -             | Entity id of map camera                      |
| `image`  | string | no<sup>1</sup> | -             | URL of map image                             |
| `crop`   | object | no             | _no cropping_ | Images [cropping options](#cropping-options) |

<sup>1</sup> Exactly one of `camera` or `image` must be provided

#### Cropping options

| Key      | Type   | Required | Default | Description                                      |
|----------|--------|----------|---------|--------------------------------------------------|
| `top`    | number | no       | 0       | Image cropping value from the top (in pixels)    |
| `bottom` | number | no       | 0       | Image cropping value from the bottom (in pixels) |
| `left`   | number | no       | 0       | Image cropping value from the left (in pixels)   |
| `right`  | number | no       | 0       | Image cropping value from the right (in pixels)  |

### Calibration source options

| Key                  | Type    | Required       | Default | Description                                                                                                                                                                                      |
|----------------------|---------|----------------|---------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `camera`             | boolean | no<sup>1</sup> | -       | Enables retrieving calibration from camera defined in `map_source` ([Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor)) |
| `entity`             | string  | no<sup>1</sup> | -       | Entity with calibration returned as a state                                                                                                                                                      |
| `attribute`          | string  | no             | -       | Enables usage of a configured attribute instead of state of given entity                                                                                                                         |
| `calibration_points` | list    | no<sup>1</sup> | -       | List of 3 or 4 [calibration points](#calibration-points-options)                                                                                                                                 |
| `identity`           | boolean | no<sup>1</sup> | -       | Enables using image coordinates on map (e.g. when map is used just for rooms)                                                                                                                    |
| `platform`           | string  | no<sup>1</sup> | -       | Enables using a default calibration from a chosen platform (provided that it supports it)                                                                                                        |

<sup>1</sup> Exactly one of `camera`, `entity`, `calibration_points`, `identity` or `platform` must be provided

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

Following vacuum platforms are supported out of the box at this moment:

- [`default` (Xiaomi Miio)](/docs/templates/xiaomiMiio.md)
- [`humbertogontijo/homeassistant-roborock`](/docs/templates/humbertogontijoHomeassistantRoborock.md)
- [`Tasshack/dreame-vacuum`](/docs/templates/tasshackDreameVacuum.md)
- [`rand256/ValetudoRE`](/docs/templates/rand256ValetudoRe.md)
- [`Hypfer/Valetudo`](/docs/templates/hypferValetudo.md)
- [`marotoweb/viomi SE`](/docs/templates/marotowebViomise.md)
- [`tykarol/ViomiVacuumV8`](/docs/templates/tykarolViomiVacuumV8.md)
- [`KrzysztofHajdamowicz/miio2`](/docs/templates/krzysztofHajdamowiczMiio2.md)
- [`send_command`](/docs/templates/sendCommand.md)
- [`al-one/Xiaomi MIoT`](/docs/templates/alOneHassXiaomiMiot.md) (additional manual configuration required)
- [`Neato`](/docs/templates/neato.md)
- [`Roomba`](/docs/templates/roomba.md)
- [`DeebotUniverse/Deebot-4-Home-Assistant`](/docs/templates/DeebotUniverseDeebot4homeAssistant.md)
- [`romedtino/simple-wyze-vac`](/docs/templates/romedtinoSimpleWyze.md)
- [`BenjaminPaap/home-assistant-myneato`](/docs/templates/BenjaminPaapMyNeato.md)

[Create a request for a new built-in platform](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/issues/new?assignees=PiotrMachowski&labels=new+platform&template=new_platform_request.yml)

[Adding a new platform](CONTRIBUTING.md#adding-new-platform)

### Icon list entry options

![icons image](/docs/media/icons.png)

| Key                 | Type    | Required | Default     | Description                                                                                                                                                               |
|---------------------|---------|----------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `icon`              | string  | yes      | -           | An icon to be displayed ([mdi](https://materialdesignicons.com/))                                                                                                         |
| `icon_id`           | string  | no       | -           | Icon ID that can be used to override the configuration                                                                                                                    |
| `tap_action`        | action  | no       | _more-info_ | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is tapped. </br>**Warning:** use `service_data` instead of `data`            |
| `hold_action`       | action  | no       | -           | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is held and released. </br>**Warning:** use `service_data` instead of `data` |
| `double_tap_action` | action  | no       | -           | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when an icon is double-tapped. </br>**Warning:** use `service_data` instead of `data`     |
| `conditions`        | list    | no       | -           | List of [conditions](#condition-options) that need to be (all of them) met for an icon to be shown                                                                        |
| `tooltip`           | string  | no       | -           | Tooltip to be displayed on hoover                                                                                                                                         |
| `order`             | number  | no       | -           | Used to sort the icons                                                                                                                                                    |
| `replace_config`    | boolean | no       | `false`     | Marks that this icon should override the config of an already existing icon with the same `icon_id`                                                                       |
| `menu_id`           | string  | no       | -           | Adds this icon to the menu with given ID                                                                                                                                  |
| `label`             | string  | no       | -           | Label that should be displayed in the menu                                                                                                                                |
| `variables`         | object  | no       | -           | Variables that should be passed to to service calls                                                                                                                       |

#### Menu icon additional options

| Key                          | Type   | Required | Default | Description                                                                   |
|------------------------------|--------|----------|---------|-------------------------------------------------------------------------------|
| `type`                       | string | yes      | -       | Has to be set to `menu`                                                       |
| `menu_id`                    | string | yes      | -       | A menu ID                                                                     |
| `entity`                     | string | yes      | -       | Entity that should be used to generate the menu                               |
| `current_value_attribute`    | string | no       | -       | Changes the source of the selected value to given attribute                   |
| `available_values_attribute` | string | yes      | -       | Configures an attribute that contains all available values for the menu       |
| `icon_mapping`               | object | no       | -       | A mapping of possible entity value -> icon that should be used for the value  |
| `value_translation_keys`     | object | no       | -       | A mapping of possible entity value -> label that should be used for the value |
| `tap_action`                 | object | no       | -       | Action that should enable a specific value                                    |

Examples:
* Menu based on the `select` entity
  ```yaml
  type: "menu",
  menu_id: "water_box_mode",
  icon_id: "water_box_mode",
  entity: "select.water_box_mode"
  available_values_attribute: "options"
  icon: "mdi:water",
  icon_mapping:
      off: "mdi:water-remove"
      mild: "mdi:water-minus"
      moderate: "mdi:water"
      intense: "mdi:water-plus"
      custom: "mdi:water-sync"
  tap_action:
      action: "call-service"
      service: "select.select_option"
      service_data:
          option: "[[value]]"
          entity_id: "[[entity_id]]"
  ```

### Tile list entry options

![tiles image](/docs/media/tiles.png)

| Key                 | Type    | Required | Default     | Description                                                                                                                                                              |
|---------------------|---------|----------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `label`             | string  | no       | -           | Label of a tile                                                                                                                                                          |
| `entity`            | string  | no       | -           | Entity which should be shown on a tile                                                                                                                                   |
| `internal_variable` | string  | no       | -           | Internal variable which should be shown on a tile                                                                                                                        |
| `icon`              | string  | no       | -           | An icon to be displayed ([mdi](https://materialdesignicons.com/))                                                                                                        |
| `icon_source`       | string  | no       | -           | Source of an icon, e.g: `vacuum.xiaomi.attributes.battery_icon`                                                                                                          |
| `attribute`         | string  | no       | -           | Attribute that should be shown on a tile                                                                                                                                 |
| `multiplier`        | number  | no       | -           | Multiplier that should be used to calculate value shown on a tile                                                                                                        |
| `precision`         | number  | no       | -           | Precision that should be used to present value on a tile                                                                                                                 |
| `unit`              | string  | no       | -           | Unit to be used                                                                                                                                                          |
| `tap_action`        | action  | no       | _more-info_ | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is tapped. </br>**Warning:** use `service_data` instead of `data`            |
| `hold_action`       | action  | no       | -           | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is held and released. </br>**Warning:** use `service_data` instead of `data` |
| `double_tap_action` | action  | no       | -           | [Action](https://www.home-assistant.io/lovelace/actions) that will be triggered when a tile is double-tapped. </br>**Warning:** use `service_data` instead of `data`     |
| `conditions`        | list    | no       | -           | List of [conditions](#condition-options) that need to be (all of them) met for a tile to be shown                                                                        |
| `tooltip`           | string  | no       | -           | Tooltip to be displayed on hoover                                                                                                                                        |
| `translations`      | map     | no       | -           | Translations that should be applied to tile's value                                                                                                                      |
| `tile_id`           | string  | no       | -           | ID of an autogenerated tile that should be replaced with this one                                                                                                        |
| `order`             | number  | no       | -           | Used to sort the tiles                                                                                                                                                   |
| `replace_config`    | boolean | no       | `false`     | Marks that this tile should override the config of an already existing tile with the same `tile_id`                                                                      |
| `variables`         | object  | no       | -           | Variables that should be passed to to service calls                                                                                                                      |

### Condition options

| Key                 | Type   | Required       | Default | Description                                              |
|---------------------|--------|----------------|---------|----------------------------------------------------------|
| `entity`            | string | no             | -       | Entity ID                                                |
| `attribute`         | string | no             | -       | Attribute to use instead of entity state                 |
| `internal_variable` | string | no             | -       | Name of internal variable to use instead of entity state |
| `value`             | string | no<sup>1</sup> | -       | Entity state/attribute has to be equal to this value     |
| `value_not`         | string | no<sup>1</sup> | -       | Entity state/attribute has to be unequal to this value   |

<sup>1</sup> Exactly one of them has to be provided

### Map modes options

![map modes image](/docs/media/map_modes.png)

| Key                     | Type    | Required        | Default | Description                                                                          |
|-------------------------|---------|-----------------|---------|--------------------------------------------------------------------------------------|
| `template`              | string  | no<sup>1</sup>  | -       | Map mode template to be used ([supported templates](#supported-templates))           |
| `name`                  | string  | yes<sup>2</sup> | -       | Name of map mode                                                                     |
| `icon`                  | string  | yes<sup>2</sup> | -       | Icon of map mode ([mdi](https://materialdesignicons.com/))                           |
| `selection_type`        | string  | yes<sup>2</sup> | -       | Type of selection, one of [supported ones](#supported-selection-types)               |
| `service_call_schema`   | object  | yes<sup>2</sup> | -       | [Service call schema](#service-call-schema-options) that should be used in this mode |
| `run_immediately`       | boolean | no              | `false` | Enables calling service immediately after choosing a selection                       |
| `coordinates_rounding`  | boolean | no              | `true`  | Enables coordinates rounding                                                         |
| `max_selections`        | integer | no              | 1       | Maximal number of selections                                                         |
| `repeats_type`          | string  | no              | `NONE`  | Type of repeats inclusion, one of [supported ones](#supported-repeats-types)         |
| `max_repeats`           | integer | no              | 1       | Maximal value of repeats                                                             |
| `variables`             | object  | no              | -       | Variables that should be passed to `service_call_schema`                             |
| `predefined_selections` | list    | no<sup>3</sup>  | -       |                                                                                      |

> You can override any value from built-in template by providing it in your configuration

<sup>1</sup> Not required if all parameters with (<sup>2</sup>) are provided

<sup>2</sup> Required if `template` is not provided

<sup>3</sup> Required if `template` is not provided and `selection_type` is one
of: `PREDEFINED_RECTANGLE`, `PREDEFINED_POINT`, `ROOM`

#### Supported templates

List of supported templates depends on selected [`vacuum_platform`](#supported-vacuum-platforms)

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

| Key                         | Type    | Required | Default | Description                                          |
|-----------------------------|---------|----------|---------|------------------------------------------------------|
| `service`                   | string  | yes      | -       | Service that should be called in a given mode        |
| `service_data`              | object  | no       | -       | Data that should be passed to service call           |
| `target`                    | object  | no       | -       | Target that should be passed to service call         |
| `evaluate_data_as_template` | boolean | no       | `false` | Enables support for jinja templates in service calls |  

It is possible to use several built-in placeholders in `service_data` section. They will be replaced by:

- `[[entity_id]]`: `entity_id` defined in preset's config
- `[[selection]]`: selection made on the map (zone, point or path)
- `[[selection_size]]`: number of selections made on the map
- `[[selection_unwrapped]]`: the same as `[[selection]]`, but passed as string unwrapped from brackets
- `[[repeats]]`: selected number of repeats
- `[[point_x]]`: x coordinate of selected point (for `MANUAL_POINT` and `PREDEFINED_POINT` selection types)
- `[[point_y]]`: y coordinate of selected point (for `MANUAL_POINT` and `PREDEFINED_POINT` selection types)
- `[[variables]]`: a list of variables for all selections

It is possible to use any value from `variables` section (wrapped with double rectangular brackets):

```yaml
variables:
  test_variable: 123
service_call_schema:
  service: fake.service
  service_data:
    var: "[[test_variable]]"
```

It is possible to use following modifiers in `service_data` section:

- `|[[jsonify]]`: if value ends with this modifier it will be decoded as a JSON and attached to service call in
  unwrapped form
- `|[[jsonify_jinja]]`: behaves in the same way as `|[[jsonify]]`, but is executed after jinja templating

#### Supported repeats types

Following repeats types are supported at this moment:

- `NONE`: No repeats
- `INTERNAL`: Repeats number included in coordinates array (`[25500, 25000, 26500, 26500, 2]`)
- `EXTERNAL`: Repeats number used as a separate attribute in `service_call_schema`
- `REPEAT`: Repeats selection (repeats: `2`, selection: `[5,6]` => `[5,6,5,6]`)

#### Predefined selection options

Format of data depends on selected `selection_type`:

* `PREDEFINED_RECTANGLE`

  | Key         | Type   | Required | Default | Description                                                                                                        |
  |-------------|--------|----------|---------|--------------------------------------------------------------------------------------------------------------------|
  | `zones`     | list   | yes      | -       | List of lists containing zone's coordinates in `[x,y,width,height]` format (e.g. `[[25500, 25000, 26500, 26500]]`) |
  | `icon`      | object | no       | -       | [Icon definition](#icon-options)                                                                                   |
  | `label`     | object | no       | -       | [Label definition](#label-options)                                                                                 |
  | `variables` | object | no       | -       | Variables that should be passed to `service_call_schema`                                                           |

  > See [this page](/docs/templates/setup.md#getting-coordinates) to check how to easily retrieve zone coordinates.

* `PREDEFINED_POINT`

  | Key         | Type   | Required | Default | Description                                                   |
  |-------------|--------|----------|---------|---------------------------------------------------------------|
  | `position`  | list   | yes      | -       | Point's coordinates in `[x,y]` format (e.g. `[25500, 25000]`) |
  | `icon`      | object | no       | -       | [Icon definition](#icon-options)                              |
  | `label`     | object | no       | -       | [Label definition](#label-options)                            |
  | `variables` | object | no       | -       | Variables that should be passed to `service_call_schema`      |

  > See [this page](/docs/templates/setup.md#getting-coordinates) to check how to easily retrieve point coordinates.

* `ROOM`

 | Key         | Type             | Required | Default | Description                                                                                     |
 |-------------|------------------|----------|---------|-------------------------------------------------------------------------------------------------|
 | `id`        | string or number | yes      | -       | Room's identifier                                                                               |
 | `outline`   | list             | no       | -       | List of points forming an outline of a room (e.g. `[[25500,25500],[26500,25500],[25500,26500]]` |
 | `icon`      | object           | no       | -       | [Icon definition](#icon-options)                                                                |
 | `label`     | object           | no       | -       | [Label definition](#label-options)                                                              |
 | `variables` | object           | no       | -       | Variables that should be passed to `service_call_schema`                                        |

  > See [this page](/docs/templates/setup.md#getting-coordinates) to check how to easily create outline.

#### Icon options

| Key    | Type   | Required | Default | Description                                                       |
|--------|--------|----------|---------|-------------------------------------------------------------------|
| `name` | string | yes      | -       | An icon to be displayed ([mdi](https://materialdesignicons.com/)) |
| `x`    | number | yes      | -       | X coordinate of an icon (in vacuum's coordinate system)           |
| `y`    | number | yes      | -       | Y coordinate of an icon (in vacuum's coordinate system)           |

#### Label options

| Key        | Type   | Required | Default | Description                                                       |
|------------|--------|----------|---------|-------------------------------------------------------------------|
| `text`     | string | yes      | -       | Text to be displayed                                              |
| `x`        | number | yes      | -       | X coordinate of a label (in vacuum's coordinate system)           |
| `y`        | number | yes      | -       | Y coordinate of a label (in vacuum's coordinate system)           |
| `offset_x` | number | no       | -       | Offset that should be applied to label in X direction (in pixels) |
| `offset_y` | number | no       | -       | Offset that should be applied to label in Y direction (in pixels) |

### Action handling

To enable handling actions you have to configure `action_handler_id` in [Main options](#main-options).
This card handles following actions:

- Starts cleaning
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: cleaning.start
  ```

- Set a value of internal variable
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: internal_variable.set
        data:
          variable: variable_1
          value: "some value"
  ```

- Selects next map mode
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: map_mode.next
  ```

- Selects previous map mode
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: map_mode.previous
  ```

- Selects a specific map mode
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: map_mode.set
        data:
          index: 2 
  ```

- Decrements a number of repeats
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: repeats.decrement
  ```

- Increments a number of repeats
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: repeats.increment
  ```

- Set a number of repeats
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: repeats.set
        data:
          value: 2
  ```

- Clears current selection
  ```yaml
    tap_action:
      action: fire-dom-event
      xiaomi_vacuum_map_card:
        action_handler_id: xiaomi_vacuum_map_card_id_1
        action: selection.clear
  ```

## FAQ

- **Make sure to check
  out [FAQ section in Discussions](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/categories/faq),
  it contains a lot of useful information**

- **Does this card require rooted device?**

  No, it only utilizes features of Home Assistant.

- **How to create a map?**

  The easiest way is to
  use [Xiaomi Cloud Map Extractor](https://github.com/PiotrMachowski/Home-Assistant-custom-components-Xiaomi-Cloud-Map-Extractor),
  but you can use any image (e.g., a screenshot from Mi Home/FloleVac).

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

* `ca` - Catalan (Català)
* `cs` - Czech (Čeština)
* `da` - Danish (Dansk)
* `de` - German (Deutsch)
* `el` - Greek (Ελληνικά)
* `en` - English
* `es` - Spanish (Español)
* `fi` - Finnish (Suomi)
* `fr` - French (Français)
* `he` - Hebrew (עברית)
* `hu` - Hungarian (Magyar)
* `is` - Icelandic (Íslenska)
* `it` - Italian (Italiano)
* `nb-NO` - Norwegian Bokmål (Norsk bokmål)
* `nl` - Dutch (Nederlands)
* `pl` - Polish (Polski)
* `pt` - Portuguese (Português)
* `pt-BR` - Brazilian Portuguese (Português Brasileiro)
* `ro` - Romanian (Română)
* `ru` - Russian (Русский)
* `sk` - Slovak (Slovenčina)
* `sv` - Swedish (Svenska)
* `tr` - Turkish (Türkçe)
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

<!-- piotrmachowski_support_links_start -->

## Support

If you want to support my work with a donation you can use one of the following platforms:

<table>
  <tr>
    <th>Platform</th>
    <th>Payment methods</th>
    <th>Link</th>
    <th>Comment</th>
  </tr>
  <tr>
    <td>Ko-fi</td>
    <td>
      <li>PayPal</li>
      <li>Credit card</li>
    </td>
    <td>
      <a href='https://ko-fi.com/piotrmachowski' target='_blank'><img height='35px' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
    </td>
    <td>
      <li>No fees</li>
      <li>Single or monthly payment</li>
    </td>
  </tr>
  <tr>
    <td>buycoffee.to</td>
    <td>
      <li>BLIK</li>
      <li>Bank transfer</li>
    </td>
    <td>
      <a href="https://buycoffee.to/piotrmachowski" target="_blank"><img src="https://buycoffee.to/btn/buycoffeeto-btn-primary.svg" height="35px" alt="Postaw mi kawę na buycoffee.to"></a>
    </td>
    <td></td>
  </tr>
  <tr>
    <td>PayPal</td>
    <td>
      <li>PayPal</li>
    </td>
    <td>
      <a href="https://paypal.me/PiMachowski" target="_blank"><img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" border="0" alt="PayPal Logo" height="35px" style="height: auto !important;width: auto !important;"></a>
    </td>
    <td>
      <li>No fees</li>
    </td>
  </tr>
  <tr>
    <td>Revolut</td>
    <td>
      <li>Revolut</li>
      <li>Credit Card</li>
    </td>
    <td>
      <a href="https://revolut.me/314ma" target="_blank"><img src="https://www.revolut.com/favicon/android-chrome-192x192.png" height="35px" alt="Revolut"></a>
    </td>
    <td>
      <li>No fees</li>
    </td>
  </tr>
</table>


[ko_fi_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Ko-Fi&color=F16061&logo=ko-fi&logoColor=white

[ko_fi]: https://ko-fi.com/piotrmachowski

[buycoffee_to_shield]: https://shields.io/badge/buycoffee.to-white?style=flat&labelColor=white&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABhmlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw1AUhU9TpaIVh1YQcchQnayIijhKFYtgobQVWnUweemP0KQhSXFxFFwLDv4sVh1cnHV1cBUEwR8QVxcnRRcp8b6k0CLGC4/3cd49h/fuA4R6malmxzigapaRisfEbG5FDLzChxB6MIZ+iZl6Ir2QgWd93VM31V2UZ3n3/Vm9St5kgE8knmW6YRGvE09vWjrnfeIwK0kK8TnxqEEXJH7kuuzyG+eiwwLPDBuZ1BxxmFgstrHcxqxkqMRTxBFF1ShfyLqscN7irJarrHlP/sJgXltOc53WEOJYRAJJiJBRxQbKsBClXSPFRIrOYx7+QcefJJdMrg0wcsyjAhWS4wf/g9+zNQuTE25SMAZ0vtj2xzAQ2AUaNdv+PrbtxgngfwautJa/UgdmPkmvtbTIEdC3DVxctzR5D7jcAQaedMmQHMlPSygUgPcz+qYcELoFulfduTXPcfoAZGhWSzfAwSEwUqTsNY93d7XP7d+e5vx+AIahcq//o+yoAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5wETCy4vFNqLzwAAAVpJREFUOMvd0rFLVXEYxvHPOedKJnKJhrDLuUFREULE7YDCMYj+AydpsCWiaKu29hZxiP4Al4aWwC1EdFI4Q3hqEmkIBI8ZChWXKNLLvS0/Qcza84V3enm/7/s878t/HxGkeTaIGziP+EB918nawu7Dq1d0e1+2J2bepnk2jFEUVVF+qKV51o9neBCaugfge70keoxxUbSWjrQ+4SUyzKZ5NlnDZdzGG7w4DIh+dtZEFntDA98l8S0MYwctNGrYz9WqKJePFLq80g5Sr+EHlnATp+NA+4qLaZ7FfzMrzbMBjGEdq8GrJMZnvAvFC/8wfAwjWMQ8XmMzaW9sdevNRgd3MFhvNpbaG1u/Dk2/hOc4gadVUa7Um425qii/7Z+xH9O4jwW8Cqv24Tru4hyeVEU588cfBMgpPMI9nMFe0BkFzVOYrYqycyQgQJLwTC2cDZCPeF8V5Y7jGb8BUpRicy7OU5MAAAAASUVORK5CYII=

[buycoffee_to]: https://buycoffee.to/piotrmachowski

[buy_me_a_coffee_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Buy%20me%20a%20coffee&color=6f4e37&logo=buy%20me%20a%20coffee&logoColor=white

[buy_me_a_coffee]: https://www.buymeacoffee.com/PiotrMachowski

[paypal_me_shield]: https://img.shields.io/static/v1.svg?label=%20&message=PayPal.Me&logo=paypal

[paypal_me]: https://paypal.me/PiMachowski

[revolut_me_shield]: https://img.shields.io/static/v1.svg?label=%20&message=Revolut&logo=revolut

[revolut_me]: https://revolut.me/314ma
<!-- piotrmachowski_support_links_end -->
