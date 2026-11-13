# own-setup fixture (batch P0d, user action)

This directory is intentionally empty of captured data. It will hold a scrubbed snapshot of the
real Home Assistant instance so the tests describe the actual vacuum instead of only a mock.

**Status:** waiting on batch P0d. The smoke test in `test/smoke.test.ts` skips with a visible
message while any of the files below is missing, so P0d only has to drop the files in.

## Files to capture

Copy these four files into `test/fixtures/own-setup/`:

| File | What it is | How to capture |
|---|---|---|
| `states.json` | Home Assistant entity states used by the card: the vacuum and every entity of the same device that the icon/tile generators read | Developer tools → Templates, or the `states` object of the card's `hass` in the browser console |
| `camera.json` | The camera (or image) entity state object, including `attributes.rooms`, `attributes.calibration_points` and `attributes.entity_picture` | Same as above, copy the camera entity's whole state object |
| `registry.json` | The full entity-registry entries for the vacuum's device, including `unique_id` | Card editor → **Copy entity info** with `debug: true` (dumps `getAllEntitiesFromTheSameDevice`), or `config/entity_registry/list` |
| `map.png` | The map image the camera serves (the `entity_picture` target) | Open the entity picture URL and save the PNG |

The formats match `test/fixtures/synthetic/`: `states.json` maps `entity_id` to a state object,
`camera.json` is one state object, `registry.json` is an array of registry entries.

## Scrubbing rules

The fixture is committed to a public repository. Before copying, replace:

- **Access tokens:** every `access_token` and the `token=` query parameter in `entity_picture`.
  Replace the whole value with `REDACTED_TOKEN` and keep the path shape
  `/api/camera_proxy/<camera entity>?token=REDACTED_TOKEN`.
- **IP addresses and hostnames:** local URLs, the HA base URL, MQTT brokers, device hosts.
  Replace with `homeassistant.local` or remove the attribute.
- **Serials and MAC addresses:** `serial`, `mac`, `did`, `device_id` values that identify the
  physical robot. Keep the *shape* (so joins still work) and replace the value with a stable
  pseudonym such as `device-roborock-s7`.
- **Home layout:** GPS coordinates, zone names that reveal the address, room names if they are
  personal. Keep room IDs stable; renaming a room is fine, changing an ID makes the fixture lie
  about the ID-drift work in batch B8.
- **Account data:** usernames, e-mail addresses, user IDs, area/floor names.

Do not reorder or reshape anything else. The point is a truthful capture with only the
identifying values replaced.

## Notes

- Do not invent a capture and do not present the synthetic fixture as real.
- If a re-map is acceptable later, a second `camera.json` captured after it is the fixture for the
  room-ID drift work in B8. Record that as `camera-after-remap.json` next to this file.
