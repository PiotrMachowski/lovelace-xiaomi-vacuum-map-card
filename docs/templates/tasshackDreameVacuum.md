# Dreame Vacuum

[Integration's documentation](https://github.com/Tasshack/dreame-vacuum)

This platform can be used to control vacuums connected to Home Assistant using Dreame Vacuum integration created by [@Tasshack](https://github.com/Tasshack).

## Available templates

* ### Room cleaning (`vacuum_clean_segment`)

  Uses IDs to clean specific rooms. Requires `predefined_selections` to be provided.

  [Configuration generator](https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card/discussions/317)

  [Getting coordinates](/docs/templates/setup.md#getting-coordinates)

  Used service: `dreame_vacuum.vacuum_clean_segment`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_segment
      predefined_selections:
      - id: '1'
        outline:
          - - 850
            - -5400
          - - 3950
            - -5400
          - - 3950
            - -500
          - - 850
            - -500
      - id: '2'
        outline:
          - - -2650
            - -5250
          - - 850
            - -5250
          - - 850
            - 850
          - - -2650
            - 850
      - id: '3'
        outline:
          - - 2050
            - -8550
          - - 3950
            - -8550
          - - 3950
            - -5550
          - - 2050
            - -5550
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666925-34b01cde-82ff-447b-aecc-e9ced402b1ed.mp4

  </details>

* ### Zone cleaning (`vacuum_clean_zone`)

  Uses 4 coordinates to clean rectangular zones.

  Used service: `dreame_vacuum.vacuum_clean_zone`

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

  Used service: `dreame_vacuum.vacuum_clean_zone`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_zone_predefined
      predefined_selections:
        - zones: 
            - - -350
              - -8200
              - 2050
              - -8200
            - - 5250
              - -350
              - 5250
              - -8200
          label:
            text: "Bedroom"
            x: 2292
            y: 3039
            offset_y: 35
          icon:
            name: "mdi:bed"
            x: 2292
            y: 3039
        - zones:
            - - -2650
              - 5250
              - -850
              - -5250
          label:
            text: "Kitchen"
            x: -900
            y: -2200
            offset_y: 35
          icon:
            name: "mdi:chef-hat"
            x: -900
            y: -2200
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666920-492a000c-9a78-4c20-b4f5-9343928140c7.mp4

  </details>


* ### Cleaning a specified point (`vacuum_clean_point`)

  Uses a pair of coordinates for vacuum to clean a user-specified point.

  Used service: `dreame_vacuum.vacuum_clean_spot`

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

  Used service: `dreame_vacuum.vacuum_clean_spot`

  <details>
  <summary>Example configuration</summary>

  ```yaml
  map_modes:
    - template: vacuum_clean_point_predefined
      predefined_selections:
        - position: [ 2806, 2836 ]
          label:
            text: "Emptying"
            x: 2806
            y: 2803
            offset_y: 35
          icon:
            name: "mdi:broom"
            x: 2800
            y: 2803
        - position: [ 3.2143, 2.6284 ]
          label:
            text: "Sofa"
            x: 3214
            y: 2628
            offset_y: 35
          icon:
            name: "mdi:sofa"
            x: 3214
            y: 2628
  ```

  </details>
  <details>
  <summary>Example video</summary>

  https://user-images.githubusercontent.com/6118709/141666923-965679e9-25fb-44cd-be08-fc63e5c85ce0.mp4

  </details>
