# Xiaomi Miio

[Integration's documentation](https://www.home-assistant.io/integrations/xiaomi_miio/#xiaomi-mi-robot-vacuum)

This platform can be used to control vacuums connected to Home Assistant using built-in Xiaomi Miio integration.

## Available templates

### Room cleaning (`vacuum_clean_segment`)
Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

[Configuration generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317)

[Getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318)

Example configuration:
```yaml
map_modes:
  - template: vacuum_clean_segment
    predefined_selections:
      - id: 14
        outline: [[ 21458, 32131 ], [ 24235, 32152 ], [ 24194, 27409 ], [ 23181, 27409 ]]
        label:
          text: "Bedroom"
          x: 22932
          y: 30339
          offset_y: 35
        icon:
          name: "mdi:bed"
          x: 22932
          y: 30339
      - id: 19
        outline: [[ 21478, 27237 ], [ 23048, 27250 ], [ 23061, 25655 ], [ 21478, 25680 ]]
        label:
          text: "Bathroom"
          x: 22282
          y: 26496
          offset_y: 35
        icon:
          name: "mdi:shower"
          x: 22282
          y: 26496
```

### Zone cleaning (`vacuum_clean_zone`)

Uses 4 coordinates to clean rectangular zones.

Example configuration:
```yaml
map_modes:
  - template: vacuum_clean_zone
```

### Predefined zone cleaning (`vacuum_clean_zone_predefined`)

Uses 4 coordinates to clean rectangular zones that have been defined in the configuration. Requires `predefined_selections` to be provided.

[Getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318)

Example configuration:
```yaml
map_modes:
  - template: vacuum_clean_zone_predefined
    predefined_selections:
      - zones: [[ 21485, 28767, 24236, 32131 ], [ 23217, 27379, 24216, 28737 ]]
        label:
          text: "Bedroom"
          x: 22932
          y: 30339
          offset_y: 35
        icon:
          name: "mdi:bed"
          x: 22932
          y: 30339
      - zones: [[ 27782, 27563, 29678, 29369 ]]
        label:
          text: "Kitchen"
          x: 28760
          y: 28403
          offset_y: 35
        icon:
          name: "mdi:pot-mix"
          x: 28760
          y: 28403
```

### Going to a specified point (`vacuum_goto`)

Uses a pair of coordinates for vacuum to get to a user-specified point.

Example configuration:
```yaml
map_modes:
  - template: vacuum_goto
```

### Going to a predefined point (`vacuum_goto_predefined`)

Uses a pair of coordinates for vacuum to go to a point that has been defined in the configuration. Requires `predefined_selections` to be provided.

[Getting coordinates](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/318)

Example configuration:
```yaml
map_modes:
  - template: vacuum_goto_predefined
    predefined_selections:
      - position: [ 28006, 28036 ]
        label:
          text: "Emptying"
          x: 28006
          y: 28036
          offset_y: 35
        icon:
          name: "mdi:broom"
          x: 28006
          y: 28036
      - position: [ 32143, 26284 ]
        label:
          text: "Sofa"
          x: 32143
          y: 26284
          offset_y: 35
        icon:
          name: "mdi:sofa"
          x: 32143
          y: 26284
```

### Following a specified path (`vacuum_follow_path`)

Uses a list of points to make a vacuum follow a user-defined path. Requires [`follow_path`](/docs/follow_path.yaml) script to be installed.

Example configuration:
```yaml
map_modes:
  - template: vacuum_follow_path
```
