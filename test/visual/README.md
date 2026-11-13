# Visual regression harness

Playwright renders the **built** `dist/xiaomi-vacuum-map-card.js` in Chromium against the committed
synthetic fixture (`test/fixtures/synthetic/`) and compares screenshots. No Home Assistant frontend
is involved: `index.html` plus `harness.js` mount the card element with a mock `hass`, and
`server.cjs` serves the bundle, the fixture and the camera-proxy image path.

`npm test` (Vitest) does not run this suite. It runs in `.github/workflows/visual.yml`, which is
triggered only by `workflow_dispatch` or by labelling a pull request `visual`.

## Scenarios

| Test | What it locks down |
| --- | --- |
| `overlay alignment at zoom 1 and rotation 0` | detected room outlines, labels and the map image agree at rest |
| `overlay alignment at zoom 1 and rotation 90` | rotation is applied once, to image and overlay together |
| `overlay alignment at zoom 2.5 and rotation 0` | `realScale` stays in untransformed layout pixels when zoomed |
| `overlay alignment at zoom 2.5 and rotation 90` | both at once, the case that historically drifted |
| `room hit-testing selects the clicked room at zoom 1` | clicking a room's colour selects that room |
| `default vertical layout` | header, preset selector, map and controls stack vertically |
| `horizontal layout once B10 exists` | **skipped**: the horizontal layout is batch B10 and does not exist yet |

## Baselines

The PNGs in `__screenshots__/` were generated in `mcr.microsoft.com/playwright:v1.65.0-jammy`, which
is the image the workflow runs in. Regenerate them there, never on macOS:

```sh
npm ci
npm run build
docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.65.0-jammy \
    npx playwright test --update-snapshots
```

Then run the same command without `--update-snapshots` to prove the new baselines are stable. A
baseline generated on another platform will make the job permanently red. Every `--update-snapshots`
commit needs a sentence in the pull request explaining what changed in the image.

Threshold is `maxDiffPixelRatio: 0.001` with `animations: "disabled"` and `caret: "hide"`; see
`playwright.config.ts`.
