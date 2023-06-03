# Neato

[Integration's documentation](https://www.home-assistant.io/integrations/neato)

This platform can be used to control vacuums connected to Home Assistant using built-in Neato integration.

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `neato.custom_cleaning`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      predefined_selections:
        - id: Bedroom
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
        - id: Bathroom
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
