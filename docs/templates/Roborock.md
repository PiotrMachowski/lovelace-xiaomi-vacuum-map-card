# Roborock

[Integration's documentation](https://www.home-assistant.io/integrations/roborock/)

> [!WARNING]
> You MUST use HA 2025.4 or later for this to work.

This platform can be used to control vacuums connected to Home Assistant using the [core Roborock integration](https://www.home-assistant.io/integrations/roborock/)


This works by using the core integration to send any needed commands, and a custom integration for passing information to the card.

If you need to setup this card using the custom component, you should use The "humbertogontijo/homeassistant-roborock" platform instead

## Installation

1. Install the [Roborock Core Integration](https://my.home-assistant.io/redirect/config_flow_start?domain=roborock) and set it up
2. It is recommended that you first disable the Image entities within the core integration. Open each image entity, hit the gear icon, then trigger the toggle by enabled.
3. Install the [Roborock Custom Map Integration](https://github.com/Lash-L/RoborockCustomMap#roborock-custom-map)
4. This integration works by piggybacking off of the Core integration, so the Core integration will do all the data updating to help prevent rate-limits. But that means that the core integration must be setup and loaded first. If you run into any issues, make sure the Roborock integration is loaded first, and then reload this one.
5. Setup this card like normal! You should select a image with the suffix _custom. An example configuration would look like
```yaml
type: custom:xiaomi-vacuum-map-card
vacuum_platform: Roborock
entity: vacuum.s7
map_source:
  camera: image.s7_downstairs_full_custom
calibration_source:
  camera: true
```
6. You can hit Generate Room Configs to allow for cleaning of rooms. It might generate extra keys, so check the yaml and make sure there are no extra 'predefined_sections'
7. There might be problems with instance that you have multiple maps. Calibration points may be missing for non-selected maps. Once you change to that map being the one selected, it should fix the calibration problems.

## Optional (Remove the custom integration)

If you would like, you can hit generate static config. Then, you can set the map_source to the core roborock image instead. Note: If your map changes significantly or if your rooms change, it will not updated, so this really shouldn't be needed.

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

  [Configuration generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317)

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `vacuum.send_command`

  <details>
  <summary>Example configuration</summary>

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

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666925-34b01cde-82ff-447b-aecc-e9ced402b1ed.mp4

  </details>

* ### Zone cleaning (`vacuum_clean_zone`)

  Uses 4 coordinates to clean rectangular zones.

  Used service: `vacuum.send_command`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_zone
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666913-d95f082d-f5bf-4ab5-a478-ba44effe6f34.mp4

  </details>

* ### Predefined zone cleaning (`vacuum_clean_zone_predefined`)

  Uses 4 coordinates to clean rectangular zones that have been defined in the configuration. Requires `predefined_selections` to be provided.

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `roborock.send_command`

  <details>
  <summary>Example configuration</summary>

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

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666920-492a000c-9a78-4c20-b4f5-9343928140c7.mp4

  </details>

* ### Going to a specified point (`vacuum_goto`)

  Uses a pair of coordinates for vacuum to get to a user-specified point.

  Used service: `roborock.roborock.set_vacuum_goto_position`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_goto
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666921-2f3d66da-6ffc-492a-8439-625da97651bd.mp4

  </details>

* ### Going to a predefined point (`vacuum_goto_predefined`)

  Uses a pair of coordinates for vacuum to go to a point that has been defined in the configuration. Requires `predefined_selections` to be provided.

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `roborock.set_vacuum_goto_position`

  <details>
  <summary>Example configuration</summary>

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

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666923-965679e9-25fb-44cd-be08-fc63e5c85ce0.mp4

  </details>

* ### Following a specified path (`vacuum_follow_path`)

  Uses a list of points to make a vacuum follow a user-defined path. Requires [`follow_path`](/docs/follow_path.yaml) script to be installed.

  Used service: `script.vacuum_follow_path`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_follow_path
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666931-48d1717f-96d0-461d-84f4-788c071f3a78.mp4

  </details>
