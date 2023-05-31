# Simple Wyze Vacuum

[Integration's documentation](https://github.com/romedtino/simple-wyze-vac)

This platform can be used to control vacuums connected to Home Assistant using custom Simple Wyze Vacuum integration created by [@romedtino](https://github.com/romedtino).

To reset a value for a given consumable press and hold a matching tile.

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
        - id: Bedroom
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
        - id: Bathroom
          outline: [[ 214, 272 ], [ 230, 272 ], [ 230, 256 ], [ 214, 256 ]]
          label:
            text: "Bathroom"
            x: 222
            y: 264
            offset_y: 35
          icon:
            name: "mdi:shower"
            x: 222
            y: 264
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666925-34b01cde-82ff-447b-aecc-e9ced402b1ed.mp4

  </details>
