# Visual regression harness

Playwright renders the **built** `dist/xiaomi-vacuum-map-card.js` in Chromium against the committed
synthetic fixture (`test/fixtures/synthetic/`) and compares screenshots. No Home Assistant frontend
is involved: `index.html` plus `harness.js` mount the card element with a mock `hass`, and
`server.cjs` serves the bundle, the fixture and the camera-proxy image path.

`npm test` (Vitest) does not run this suite. It runs in `.github/workflows/visual.yml` on
`workflow_dispatch` and on every push to a pull request that carries the `visual` label
(`opened`, `synchronize`, `reopened` and `labeled` events). Unlabelled pull requests skip the job.

## Scenarios

| Test | What it locks down |
| --- | --- |
| `overlay alignment at zoom 1 and rotation 0` | detected room outlines, labels and the map image agree at rest |
| `overlay alignment at zoom 1 and rotation 90` | rotation is applied once, to image and overlay together |
| `overlay alignment at zoom 2.5 and rotation 0` | `realScale` stays in untransformed layout pixels when zoomed |
| `overlay alignment at zoom 2.5 and rotation 90` | both at once, the case that historically drifted |
| `a configured map_view is the rendered starting view` | a configured default opens the card at its centred scale and offset, and a later user zoom still wins |
| `a configured map_view is centred at rotation 90` | rotation pivots on the content centre, so a scale-only default keeps the map centred and overlays aligned |
| `a stored view beats the configured default after a remount` | a real browser pan/zoom is written to the store and read back over `map_view` |
| `room hit-testing selects the clicked room at zoom 1` | clicking a room's colour selects that room, and the selected room's cleaning-order badge is centred above its label |
| `default vertical layout` | header, preset selector, map and controls stack vertically |
| `layout geometry at 400 and 800 px` | vertical stacks the controls below the map; horizontal puts them beside it at both widths |
| `horizontal layout at 400 px`, `... 800 px`, `... 1200 px` | side-by-side geometry at three widths, map and controls inside the card, the controls column wrapping and scrolling instead of overflowing, one screenshot each |
| `a long mode name ellipsizes inside the controls column at 400 px` | a 42-character mode name does not widen the dropdown or clip the mode icon: the controls column does not scroll sideways, the icon stays inside it, and the collapsed name is ellipsized |
| `horizontal layout adapts when the container is resized` | resizing the container to 1200 px widens the map and moves the controls, the room overlay is recalculated to the new scale, and resizing back restores the narrow geometry |
| `a sections-view grid cell makes the card fill its height and scroll` | the reflected `layout="grid"` hook makes the card fill a fixed-height cell and scroll inside it instead of overflowing |
| `horizontal layout keeps room, mode and tile interactions` | room hit-testing, opening the mode dropdown and selecting a mode (the mode changes), a tile click and the map-before-controls DOM/focus order in the horizontal arrangement |

The horizontal scenarios mount a fixture with three modes, four icons and eight tiles so the
clamped controls column has to wrap and scroll. `#card-root` is 400 px wide by default, so each
scenario sets the root width explicitly; the vertical baseline keeps the default width and is
unchanged by B10. The resize scenario asserts the room overlay against the CSS-scaled image box as
well as the map/control boxes, so a stale `realScale` after a resize fails the geometry instead of
only the screenshot.

The four overlay scenarios also assert numeric geometry, not just pixels: the framed room's
outline bounding box, in source-image pixels, must equal the rectangle in
`test/fixtures/synthetic/map.png` within 0.75 px (`LIVING_ROOM_IMAGE_RECT` in `visual.spec.ts`).
That check covers the detected outline and the calibration conversion, and it names the failing edge
so a broken outline is readable without comparing images. It is **not** the guard for scale or
transform alignment: the box is derived with `getBBox()` divided by `realScale`, which cancels a
base-scale error and ignores the zoom and rotation transforms, so those regressions are caught by
the screenshots. The tolerance is deliberately below one image pixel; a 1 layout-pixel drift can
therefore pass, and the measured values currently land exactly on the rectangle.

The room hit test asserts the cleaning-order badge the same way, because the screenshot cannot: at
400 x 398 px, `maxDiffPixelRatio: 0.001` tolerates 159 differing pixels while a missing or shifted
badge changes only about 104. The badge's centre must stay within 1 px of its room label's centre and
its bottom above the label's top, and its computed `text-anchor` must be `middle` with a `stroke`
that is not `none`. The screenshot of that test covers the surrounding frame, not the badge.

## Baselines

The PNGs in `__screenshots__/` were generated in `mcr.microsoft.com/playwright:v1.65.0-jammy`, the
image CI runs in. Everything — dependency install, bundle build and test run — must happen **inside
that image**. Running the tests on the host uses the host's Chromium, and running only the test step
in the container against a host `npm ci`/`npm run build` still renders with a different browser and
font stack than CI.

Regenerate from the repository root:

```sh
docker run --rm --platform linux/amd64 \
    -v "$PWD":/work \
    -w /work \
    -e HOME=/tmp \
    --user "$(id -u):$(id -g)" \
    mcr.microsoft.com/playwright:v1.65.0-jammy \
    bash -lc 'npm ci && npm run build && npx playwright test --update-snapshots'
```

Then run the same command without `--update-snapshots` to prove the new baselines are stable. A
baseline generated on another platform will make the job permanently red. Every `--update-snapshots`
commit needs a sentence in the pull request explaining what changed in the image.

- **Apple Silicon:** `--platform linux/amd64` is required when generating. Without it Docker pulls
  the arm64 image, whose font rasterisation differs, and the amd64 CI job fails on the new baseline.
- **Ownership:** `--user "$(id -u):$(id -g)"` with `-e HOME=/tmp` makes `node_modules`, `dist` and
  the reports owned by you, like CI's `--user 1001`. Without it the container runs as root and
  leaves root-owned files in the checkout, which needs a `sudo chown -R` to clean up. The container
  user does not need to own `/ms-playwright`: the image's browsers are readable by every user.
- **Version bump:** bumping `@playwright/test` means bumping the image tag and `PLAYWRIGHT_VERSION`
  in `.github/workflows/visual.yml` and regenerating **every** baseline in the new image. The
  workflow deliberately has no `playwright install` step, so a version mismatch fails loudly
  (`Executable doesn't exist`, or the explicit guard step) instead of silently downloading a
  different Chromium into the old image and comparing against older baselines.

Threshold is `maxDiffPixelRatio: 0.001` with `animations: "disabled"` and `caret: "hide"`; see
`playwright.config.ts`.
