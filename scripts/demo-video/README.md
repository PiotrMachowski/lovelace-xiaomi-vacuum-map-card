# README demo video

`docs/media/demo.mp4` (and the `demo.webp` the README shows) is recorded from a real Home Assistant frontend driving the built card. The
vacuum and maps are simulated, so the video can show two floors, every map mode and a moving robot
without a real robot or a real home.

## What is simulated

`ha/config/custom_components/demo_robot` is a demo-only integration. It is never part of the card.

- **Two map cameras** (`camera.ground_floor_map`, `camera.first_floor_map`) render an invented
  floor plan with Pillow and expose `calibration_points` and `rooms`, as map-extractor cameras do.
  Each room has one flat colour, so the card traces its outline from the image.
- **`vacuum.robot_vacuum`** carries the attributes the Xiaomi Miio tiles read. The
  `xiaomi_miio.vacuum_clean_segment`, `vacuum_clean_zone` and `vacuum_goto` services and the
  `script.vacuum_follow_path` script drive the simulated robot around the map. Its path and position
  are drawn into the map image.

## Recording

```sh
npm run build
docker compose -f scripts/demo-video/compose.yaml up -d   # Home Assistant 2026.11.0 on :8130
node scripts/demo-video/setup.cjs                         # onboarding, card resource, dashboard
node scripts/demo-video/record.cjs                        # writes docs/media/demo.mp4
```

GitHub does not play a video committed to the repository inside a README, so the README shows an
animated WebP made from the mp4 and links to the mp4 for full quality (`img2webp` comes with
`libwebp`):

```sh
mkdir -p scripts/demo-video/out/webp
ffmpeg -i docs/media/demo.mp4 -vf "fps=15,scale=640:-1:flags=lanczos" scripts/demo-video/out/webp/f%04d.png
img2webp -loop 0 -lossy -q 75 -m 4 -d 67 scripts/demo-video/out/webp/*.png -o docs/media/demo.webp
```

`record.cjs` needs `ffmpeg` on the `PATH`. It returns the robot to its dock, plays the storyboard
with a drawn pointer (and two drawn fingers for the rotate gesture), captures every painted frame
through Chromium's screencast at 2x, and crops the result to the card. Pass a path to write the
video somewhere else. Frames are kept in the ignored `out/` folder.

The storyboard is the sequence of steps at the end of `record.cjs`. Click targets are given in
floor-plan pixels (`floorplan.py`), so they stay on the same room when the card's size changes.
Avoid the grey furniture: it is not part of any room.
