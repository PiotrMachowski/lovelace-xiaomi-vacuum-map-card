# Deebot 4 Home Assistant

[Integration's documentation](https://deebot.readthedocs.io/)

This platform can be used to control vacuums connected to Home Assistant using Deebot 4 Home Assistant integration created by [@DeebotUniverse](https://github.com/DeebotUniverse).

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

  [Configuration generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317)

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `xiaomi_miio.vacuum_clean_segment`

  [Documentation](https://deebot.readthedocs.io/integrations/home-assistant/examples/commands/#clean-only-certain-rooms)

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      predefined_selections:
        - id: 14
          outline: [[ 214, 321 ], [ 242, 321 ], [ 241, 274 ], [ 231, 274 ]]
          label:
            text: "Bedroom"
            x: 229
            y: 303
            offset_y: 35
          icon:
            name: "mdi:bed"
            x: 229
            y: 303
        - id: 19
          outline: [[ 214, 272 ], [ 230, 272 ], [ 230, 256 ], [ 214, 256 ]]
          label:
            text: "Bathroom"
            x: 222
            y: 264
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

  [Documentation](https://deebot.readthedocs.io/integrations/home-assistant/examples/commands/#clean-custom-area)

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

  Used service: `vacuum.send_command`

  [Documentation](https://deebot.readthedocs.io/integrations/home-assistant/examples/commands/#clean-custom-area)

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
