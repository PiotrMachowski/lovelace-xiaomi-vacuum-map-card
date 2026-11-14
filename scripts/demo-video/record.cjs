#!/usr/bin/env node
/**
 * Records the README demo video against the demo Home Assistant (see README.md in this folder).
 *
 * Chromium's screencast captures every painted frame at device-pixel resolution; ffmpeg then crops
 * the frames to the card and encodes `docs/media/demo.mp4`. The pointer and the two fingers of the
 * rotate gesture are drawn by an overlay, because a headless browser has no visible cursor.
 *
 * Usage: node scripts/demo-video/record.cjs [output.mp4]
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../..");
const BASE = process.env.DEMO_HA_URL || "http://localhost:8130";
const OUT_DIR = path.join(__dirname, "out");
const FRAMES = path.join(OUT_DIR, "frames");
const TARGET = path.resolve(process.argv[2] || path.join(ROOT, "docs/media/demo.mp4"));
const VIEWPORT = { width: 480, height: 820 };
const DPR = 2;
const CARD = "xiaomi-vacuum-map-card";

/** Draws the pointer, click ripples and touch points; injected into every page. */
function pointerOverlay() {
    const install = () => {
        const style = document.createElement("style");
        style.textContent = `
            #demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647;
                pointer-events: none; transform: translate(-100px, -100px); filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
            .demo-ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 36px; height: 36px;
                margin: -18px 0 0 -18px; border-radius: 50%; border: 3px solid rgba(255,255,255,.9);
                animation: demo-ripple .45s ease-out forwards; }
            .demo-finger { position: fixed; z-index: 2147483647; pointer-events: none; width: 34px; height: 34px;
                margin: -17px 0 0 -17px; border-radius: 50%; background: rgba(255,255,255,.45);
                border: 2px solid rgba(255,255,255,.95); box-shadow: 0 1px 6px rgba(0,0,0,.5); }
            @keyframes demo-ripple { from { transform: scale(.4); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }`;
        document.head.appendChild(style);
        const cursor = document.createElement("div");
        cursor.id = "demo-cursor";
        cursor.innerHTML =
            '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M3 2 L3 18 L7.5 13.8 L10.6 20.4 L13.4 19.1 L10.4 12.7 L16.6 12.7 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
        document.body.appendChild(cursor);
        const fingers = new Map();
        window.addEventListener("mousemove", e => {
            cursor.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 2}px)`;
        }, true);
        window.addEventListener("mousedown", e => {
            const ripple = document.createElement("div");
            ripple.className = "demo-ripple";
            ripple.style.left = `${e.clientX}px`;
            ripple.style.top = `${e.clientY}px`;
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 500);
        }, true);
        const touches = e => {
            cursor.style.visibility = e.touches.length ? "hidden" : "visible";
            const live = new Set();
            for (const touch of e.touches) {
                live.add(touch.identifier);
                let finger = fingers.get(touch.identifier);
                if (!finger) {
                    finger = document.createElement("div");
                    finger.className = "demo-finger";
                    document.body.appendChild(finger);
                    fingers.set(touch.identifier, finger);
                }
                finger.style.left = `${touch.clientX}px`;
                finger.style.top = `${touch.clientY}px`;
            }
            for (const [id, finger] of fingers) {
                if (!live.has(id)) {
                    finger.remove();
                    fingers.delete(id);
                }
            }
        };
        for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"]) {
            window.addEventListener(type, touches, { capture: true, passive: true });
        }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else install();
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function main() {
    const token = JSON.parse(fs.readFileSync(path.join(__dirname, ".auth", "token.json"), "utf8"));
    fs.rmSync(FRAMES, { recursive: true, force: true });
    fs.mkdirSync(FRAMES, { recursive: true });

    // Without the flag the headless screencast is captured in CSS pixels, not device pixels.
    const browser = await chromium.launch({ args: [`--force-device-scale-factor=${DPR}`] });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR, hasTouch: true, colorScheme: "dark" });
    await context.addInitScript(
        ([tokens, base]) => {
            localStorage.setItem(
                "hassTokens",
                JSON.stringify({ ...tokens, hassUrl: base, clientId: `${base}/`, expires: Date.now() - 60_000 }),
            );
            localStorage.setItem("selectedTheme", JSON.stringify({ theme: "default", dark: true }));
        },
        [token, BASE],
    );
    await context.addInitScript(pointerOverlay);
    const page = await context.newPage();

    // Start from a docked robot and the default view, whatever an earlier run left behind.
    await page.goto(`${BASE}/vacuum-demo/map`);
    await page.locator(CARD).waitFor({ timeout: 120_000 });
    await page.evaluate(async () => {
        const hass = document.querySelector("home-assistant").hass;
        await hass.callService("vacuum", "return_to_base", { entity_id: "vacuum.robot_vacuum" });
        for (const key of Object.keys(localStorage)) if (/xiaomi|xvmc|map.?view/i.test(key)) localStorage.removeItem(key);
    });
    await page.waitForFunction(
        () => document.querySelector("home-assistant").hass.states["vacuum.robot_vacuum"].state === "docked",
        null,
        { timeout: 120_000 },
    );
    await page.reload();
    await page.locator(CARD).waitFor({ timeout: 120_000 });
    await page.locator(`${CARD} .room-wrapper`).first().waitFor();
    await sleep(2500);

    const card = page.locator(`${CARD} ha-card`).first();
    const cardBox = await card.boundingBox();

    // Mouse helpers: smooth, eased movement so the pointer reads as a hand, not a teleport.
    let pointer = { x: VIEWPORT.width / 2, y: VIEWPORT.height - 40 };
    await page.mouse.move(pointer.x, pointer.y);
    const moveTo = async (x, y, duration = 550) => {
        const from = { ...pointer };
        const steps = Math.max(8, Math.round(duration / 16));
        for (let i = 1; i <= steps; i++) {
            const t = ease(i / steps);
            await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
            await sleep(duration / steps);
        }
        pointer = { x, y };
    };
    const click = async (x, y, after = 450) => {
        await moveTo(x, y);
        await sleep(120);
        await page.mouse.down();
        await sleep(70);
        await page.mouse.up();
        await sleep(after);
    };
    const center = async locator => {
        const box = await locator.boundingBox();
        if (!box) throw new Error(`not visible: ${locator}`);
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const clickOn = async (locator, after) => {
        const c = await center(locator);
        await click(c.x, c.y, after);
    };
    const drag = async (from, to, duration = 700) => {
        await moveTo(from.x, from.y);
        await sleep(100);
        await page.mouse.down();
        await moveTo(to.x, to.y, duration);
        await sleep(80);
        await page.mouse.up();
        await sleep(300);
    };
    /** A point on the untransformed map, from floor-plan pixels (the PNG is drawn at 2x). */
    const mapPoint = async (x, y) => {
        // The canvas keeps the source image's pixel size, also while a newer map image loads.
        const geometry = await page.locator(`${CARD} #map-image`).evaluate(canvas => {
            const rect = canvas.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, w: canvas.width, h: canvas.height };
        });
        if (!geometry.w || !geometry.h) throw new Error("the map canvas has no size");
        return { x: geometry.x + (x * 2 * geometry.width) / geometry.w, y: geometry.y + (y * 2 * geometry.height) / geometry.h };
    };
    const selectMode = async name => {
        await clickOn(page.locator(`${CARD} .map-controls .dropdown-menu-button`), 600);
        await clickOn(page.locator(`${CARD} .dropdown-menu-entry`).filter({ hasText: name }).first(), 700);
    };
    const runButton = page.locator(`${CARD} .map-actions-item.main`);

    // Screencast every painted frame with its timestamp.
    const cdp = await context.newCDPSession(page);
    const frames = [];
    cdp.on("Page.screencastFrame", async frame => {
        const file = path.join(FRAMES, `${String(frames.length).padStart(5, "0")}.jpg`);
        fs.writeFileSync(file, Buffer.from(frame.data, "base64"));
        frames.push({ file, at: frame.metadata.timestamp });
        await cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 95,
        maxWidth: VIEWPORT.width * DPR,
        maxHeight: VIEWPORT.height * DPR,
    });
    await sleep(1200);

    // 1. Rooms come from the map: tap three, see the cleaning order, start.
    await click(...Object.values(await mapPoint(150, 300)));
    await click(...Object.values(await mapPoint(385, 160)));
    await click(...Object.values(await mapPoint(480, 425)), 900);
    await clickOn(runButton, 2600);

    // 2. Zoom, pan and a two-finger twist while the robot drives; then reset the view.
    const zoomAt = await mapPoint(220, 280);
    await moveTo(zoomAt.x, zoomAt.y, 700);
    for (let i = 0; i < 2; i++) {
        await page.mouse.wheel(0, -100);
        await sleep(140);
    }
    await sleep(900);
    await drag({ x: zoomAt.x, y: zoomAt.y }, { x: zoomAt.x + 70, y: zoomAt.y - 30 }, 900);
    await sleep(700);
    await moveTo(VIEWPORT.width - 20, zoomAt.y + 180, 500);
    const mapBox = await page.locator(`${CARD} #map-zoomer`).boundingBox();
    const pivot = { x: mapBox.x + mapBox.width / 2, y: mapBox.y + mapBox.height / 2 };
    const radius = 70;
    const fingersAt = angle => [0, Math.PI].map((offset, id) => ({
        x: pivot.x + Math.cos(angle + offset) * radius,
        y: pivot.y + Math.sin(angle + offset) * radius,
        id,
        radiusX: 12,
        radiusY: 12,
        force: 1,
    }));
    const start = -0.5;
    const twist = 0.75;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingersAt(start) });
    await sleep(250);
    for (let i = 1; i <= 45; i++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingersAt(start + twist * ease(i / 45)) });
        await sleep(22);
    }
    await sleep(250);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(1800);
    await clickOn(page.locator(`${CARD} .map-zoom-icons ha-icon[icon="mdi:image-filter-center-focus"]`), 1600);

    // 3. Zones: add one, move it and resize it.
    await selectMode("Zone cleanup");
    await clickOn(page.locator(`${CARD} .map-actions-item`).filter({ has: page.locator('ha-icon[icon="mdi:plus"]') }), 700);
    const zone = page.locator(`${CARD} polygon.manual-rectangle`).first();
    const zoneCenter = await center(zone);
    const target = await mapPoint(450, 130);
    await drag(zoneCenter, target, 900);
    const resizer = page.locator(`${CARD} .resizer`).first();
    const handle = await center(resizer);
    await drag(handle, { x: handle.x + 30, y: handle.y + 45 }, 700);
    await sleep(900);

    // 4. Send the robot to a spot.
    await selectMode("Pin & Go");
    await click(...Object.values(await mapPoint(330, 400)), 1200);

    // 5. Draw a path for it to follow.
    await selectMode("Path");
    for (const [x, y] of [[90, 120], [250, 120], [250, 220], [450, 270], [640, 300]]) {
        await click(...Object.values(await mapPoint(x, y)), 280);
    }
    await sleep(900);

    // 6. The other floor: a second map whose rooms are detected the same way.
    await clickOn(page.locator(`${CARD} .preset-selector-icon-wrapper`).last(), 1800);
    await click(...Object.values(await mapPoint(240, 210)));
    await click(...Object.values(await mapPoint(450, 100)), 2200);

    await cdp.send("Page.stopScreencast");
    await sleep(300);
    await browser.close();

    // Turn the timestamped frames into a constant-rate video cropped to the card.
    const list = frames
        .map((frame, index) => {
            const next = frames[index + 1];
            const duration = next ? Math.max(0.001, next.at - frame.at) : 1;
            return `file '${frame.file}'\nduration ${duration.toFixed(4)}`;
        })
        .join("\n");
    const listFile = path.join(OUT_DIR, "frames.txt");
    fs.writeFileSync(listFile, `${list}\nfile '${frames[frames.length - 1].file}'\n`);
    const pad = 8;
    const crop = {
        x: Math.max(0, Math.round((cardBox.x - pad) * DPR)),
        y: Math.max(0, Math.round((cardBox.y - pad) * DPR)),
        w: Math.round((cardBox.width + pad * 2) * DPR),
        h: Math.round((cardBox.height + pad * 2) * DPR),
    };
    crop.w = Math.min(crop.w, VIEWPORT.width * DPR - crop.x) & ~1;
    crop.h = Math.min(crop.h, VIEWPORT.height * DPR - crop.y) & ~1;
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    execFileSync(
        "ffmpeg",
        [
            "-y", "-v", "error",
            "-f", "concat", "-safe", "0", "-i", listFile,
            "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},fps=30,format=yuv420p`,
            "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-movflags", "+faststart",
            TARGET,
        ],
        { stdio: "inherit" },
    );
    console.log(`${frames.length} frames -> ${path.relative(ROOT, TARGET)} (${crop.w}x${crop.h})`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
