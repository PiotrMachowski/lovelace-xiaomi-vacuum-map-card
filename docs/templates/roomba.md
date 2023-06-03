# Roomba

[Integration's documentation](https://www.home-assistant.io/integrations/roomba)

This platform can be used to control vacuums connected to Home Assistant using built-in Roomba integration.

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.
  
  [Retrieving room IDs and types](https://blog.hessindustria.com/home-assistant-roomba-s9-integration/)

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `vacuum.send_command`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      variables:
        pmap_id: abc123def456
      predefined_selections:
        - id: 9
          variables:
            type: rid
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
        - id: 0
          variables:
            type: zid
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
