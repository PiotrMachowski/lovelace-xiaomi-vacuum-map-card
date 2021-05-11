## Go to target
![Go to target](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/blob/master/s1.gif)

## Zoned cleanup
![Zoned cleanup](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/blob/master/s2.gif)

## Defined zones
![Defined zones](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/blob/master/s3.gif)

## Configuration options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `entity` | `string` | `True` | - | ID of Xiaomi vacuum entity |
| `map_image` | `string` | `False` | - | Path to image of map |
| `map_camera` | `string` | `False` | - | ID of map camera entity |
| `camera_refresh_interval` | `integer` | `False` | 5 | Update interval for map camera in seconds |
| `calibration_points` | `list` | `True` | - | Pairs of coordinates: in vacuum system and on map image. See: [Calibration](#calibration)  |
| `zones` | `list` | `False` | Empty | List of predefined zones |
| `modes` | `list` | `False` | `[go_to_target, zoned_cleanup, predefined_zones]` | List of displayed modes. Possible values: `go_to_target`, `zoned_cleanup`, `predefined_zones` |
| `default_mode` | `string` | `False` | - | Default selected mode. Possible values: `go_to_target`, `zoned_cleanup`, `predefined_zones` |
| `debug` | `boolean` | `False` | `false` | Enables alerts with coordinates after holding `Start` button. Possible values: `true`, `false` |
| `service` | `string` | `False` | `vacuum.send_command` | Allows to define service used after clicking `Start` button. See: [Defining service](#defining-service) |
| `ignore_zones_limit` | `boolean` | `False` | `false` | Disables 5 zones limit. Possible values: `true`, `false`. See: [Defining service](#defining-service) |
| `language` | `string` | `False` | `en` | Language used in the card. Possible values: `cz`, `en`, `de`, `dk`, `es`, `fr`, `it`, `nl`, `no`, `pl`, `pt`, `ru`, `se`, `sk`, `uk` |

## Example usage:
```yaml
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
  - [[24215, 28125, 29465, 32175]]
  - [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
  - [[28972, 26715, 31072, 27915], [29457, 27903, 31107, 29203], [30198, 29215, 31498, 31215], [29461, 31228, 31511, 32478]]
```

## Calibration

To calibrate this card follow instructions from [this](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/wiki) guide.

## Defining service

You can use a `service` parameter for example to run a script instead of starting a vacuum directly. Provided service will be run with following parameters:
* `entity_id` - id of a vacuum
* `command` - one of two:
  * `app_goto_target` - for _Go to target_ mode
  * `zoned_cleanup` - for _Zoned cleanup_ and _Predefined zones_ modes
* `params` - point or a list of zones (the same value as displayed in `debug` mode)

| WARNING: In the current version of Home Assistant the service `vacuum.send_command` does not support templates! |
| --- |
| To overcome this issue you can use a [*script*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/examples/vacuum_send_command_multiple_zones.yaml) and a [*python script*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/examples/vacuum_send_command.py). |

Example HA script that can be used with this card is available [*here*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/examples/vacuum_send_command.yaml).

## Hints
* To find out values for `calibration_points` you can use the service `vacuum.send_command` with data:
  ```json
  {
    "entity_id": "vacuum.xiaomi_vacuum",
    "command": "app_goto_target",
    "params": [25500, 25500]
  }
  ```
  Alternatively you can use `vacuum.xiaomi_clean_zone`:
    ```json
    {
      "entity_id": "vacuum.xiaomi_vacuum",
      "zone": [[25500, 25500, 26500, 26500]],
      "repeats": 1
    }
    ```
* You can find out coordinates for zones using two methods:
  * Enabling `debug` in settings, drawing zone in `Zoned cleanup` mode and holding `Start` button. Note: this method also works for other modes.
  * Android App [*FloleVac*](https://play.google.com/store/apps/details?id=de.flole.xiaomi)

* To add another language modify file [*texts.js*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/texts.js) and set the `language` parameter in cards configuration.

## FAQ
* **Can this card show a live map?**

  Yes, to show a camera feed as a background set property `map_camera` in configuration. This only works if you have rooted your device.

* **Does this card require rooted device?**

  No, in the basic version it uses a static image as a map. Root is required to create camera that will show a live map.

* **How to create a map?**

  You can use any image you want, the easiest way is to use a screenshot from Mi Home/FloleVac.

  
## Community
Thread on [community.home-assistant.io](https://community.home-assistant.io/): [Xiaomi Vacuum Interactive Map Card](https://community.home-assistant.io/t/xiaomi-vacuum-interactive-map-card/)


<a href="https://www.buymeacoffee.com/PiotrMachowski" target="_blank"><img src="https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>
