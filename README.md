# Lovelace Xiaomi Vacuum Map card

This card enables you to specify target or start zoned cleanup using map, just like in Mi Home app. Additionally you can define a list of zones and choose ones to be cleaned.

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
| `map_image` | `string` | `True` | - | Path to image of map |
| `base_position` | `string` | `True` | - | Coordinates of pixel corresponding to base position (25500, 25500) on map image |
| `reference_point` | `string` | `True` | - | Coordinates of pixel corresponding to reference point (26500, 26500) on map image |
| `zones` | `List` | `False` | Empty | List of predefined zones |

## Example usage:
```yaml
views:
- name: Example
  cards:
    - type: custom:xiaomi-vacuum-map-card
      entity: vacuum.xiaomi_vacuum
      map_image: '/local/custom_lovelace/xiaomi_vacuum_map_card/map.png'
      base_position:
        x: 1889
        y: 1600
      reference_point:
        x: 1625
        y: 1336
      zones:
        - [[25500, 25500, 26500, 26500]]
        - [[24215, 28125, 29465, 32175]]
        - [[24245, 25190, 27495, 27940], [27492, 26789, 28942, 27889]]
        - [[28972, 26715, 31072, 27915], [29457, 27903, 31107, 29203], [30198, 29215, 31498, 31215], [29461, 31228, 31511, 32478]]
```

## Installation
1. Download [*xiaomi-vacuum-map-card.js*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/xiaomi-vacuum-map-card.js), [*texts.js*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/texts.js) and [style.js](Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/style.js) to `/www/custom_lovelace/xiaomi_vacuum_map_card` directory:
    ```bash
    mkdir -p www/custom_lovelace/xiaomi_vacuum_map_card
    cd www/custom_lovelace/xiaomi_vacuum_map_card/
    wget https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/xiaomi-vacuum-map-card.js
    wget https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/texts.js
    wget https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/style.js
    ```
2. Add card to resources in `ui-lovelace.yaml` or in raw editor if you are using frontend UI editor:
    ```yaml
    resources:
      - url: /local/custom_lovelace/xiaomi_vacuum_map_card/xiaomi-vacuum-map-card.js
        type: module
    ```

### Hints
* To find out values for `base_position` and `reference_point` use service `vacuum.send_command` with data:
  * `base_postion`:
    ```json
    {
      "entity_id": "vacuum.xiaomi_vacuum",
      "command": "app_goto_target",
      "params": [25500, 25500]
    }
    ```
  * `reference_point`:
    ```json
    {
      "entity_id": "vacuum.xiaomi_vacuum",
      "command": "app_goto_target",
      "params": [26500, 26500]
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
* You can find out coordinates for zones using app [*FloleVac*](https://play.google.com/store/apps/details?id=de.flole.xiaomi)

* For Polish version download [*textsPL.js*](https://github.com/PiotrMachowski/Home-Assistant-Lovelace-Xiaomi-Vacuum-Map-card/raw/master/dist/textsPL.js) and change filename to `texts.js`

## FAQ
* **Does this card show live map?**
  
  No, you have to prepare your own map in an image
  
* **Does this card require rooted device?**

  No, as it only utilises features already existing in Home Assistant integration
  