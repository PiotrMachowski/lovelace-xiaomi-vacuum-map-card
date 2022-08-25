# Viomi Vacuum V8 by [@tykarol](https://github.com/tykarol)

[Integration's documentation](https://github.com/tykarol/home-assistant-viomi-vacuum-v8)

This platform can be used to control vacuums connected to Home Assistant using Viomi Vacuum V8 integration created by [@tykarol](https://github.com/tykarol).

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

  [Configuration generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317)

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `viomi_vacuum_v8.clean_segment`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      predefined_selections:
        - id: 14
          outline: [[ 2.1458, 3.2131 ], [ 2.4235, 3.2152 ], [ 2.4194, 2.7409 ], [ 2.3181, 2.7409 ]]
          label:
            text: "Bedroom"
            x: 2.2932
            y: 3.0339
            offset_y: 35
          icon:
            name: "mdi:bed"
            x: 2.2932
            y: 3.0339
        - id: 19
          outline: [[ 2.1478, 2.7237 ], [ 2.3048, 2.7250 ], [ 2.3061, 2.5655 ], [ 2.1478, 2.5680 ]]
          label:
            text: "Bathroom"
            x: 2.2282
            y: 2.6496
            offset_y: 35
          icon:
            name: "mdi:shower"
            x: 2.2282
            y: 2.6496
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666925-34b01cde-82ff-447b-aecc-e9ced402b1ed.mp4

  </details>

* ### Zone cleaning (`vacuum_clean_zone`)

  Uses 4 coordinates to clean rectangular zones.

  Used service: `viomi_vacuum_v8.clean_zone`

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

  Used service: `viomi_vacuum_v8.clean_zone`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_zone_predefined
      predefined_selections:
        - zones: [[ 2.1485, 2.8767, 2.4236, 3.2131 ], [ 2.3217, 2.7379, 2.4216, 2.8737 ]]
          label:
            text: "Bedroom"
            x: 2.2932
            y: 3.0339
            offset_y: 35
          icon:
            name: "mdi:bed"
            x: 2.2932
            y: 3.0339
        - zones: [[ 2.7782, 2.7563, 2.9678, 2.9369 ]]
          label:
            text: "Kitchen"
            x: 2.8760
            y: 2.8403
            offset_y: 35
          icon:
            name: "mdi:pot-mix"
            x: 2.8760
            y: 2.8403
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666920-492a000c-9a78-4c20-b4f5-9343928140c7.mp4

  </details>

* ### Cleaning a specified point (`vacuum_clean_point`)

  Uses a pair of coordinates for vacuum to clean a user-specified point.

  Used service: `viomi_vacuum_v8.clean_point`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_point
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666921-2f3d66da-6ffc-492a-8439-625da97651bd.mp4

  </details>


* ### Cleaning a predefined point (`vacuum_clean_point_predefined`)

  Uses a pair of coordinates for vacuum to clean a point that has been defined in the configuration. Requires `predefined_selections` to be provided.

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `viomi_vacuum_v8.clean_point`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_point_predefined
      predefined_selections:
        - position: [ 2.8006, 2.8036 ]
          label:
            text: "Emptying"
            x: 2.8006
            y: 2.8036
            offset_y: 35
          icon:
            name: "mdi:broom"
            x: 2.8006
            y: 2.8036
        - position: [ 3.2143, 2.6284 ]
          label:
            text: "Sofa"
            x: 3.2143
            y: 2.6284
            offset_y: 35
          icon:
            name: "mdi:sofa"
            x: 3.2143
            y: 2.6284
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666923-965679e9-25fb-44cd-be08-fc63e5c85ce0.mp4

  </details>
