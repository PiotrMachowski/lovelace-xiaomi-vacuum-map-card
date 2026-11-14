/* eslint-disable @typescript-eslint/no-explicit-any */
import { state } from "lit/decorators";
import { forwardHaptic } from "custom-card-helpers";
import type { XiaomiVacuumMapCardConfig } from "../types/types";
import { CalibrationPoint, CardPresetConfig } from "../types/types";
import { MAP_ROTATION_SNAP_THRESHOLD, MAP_ROTATION_STEP, MAP_VIEW_ID_ATTRIBUTES, MAP_VIEW_SAVE_DEBOUNCE } from "../const";
import { getMapView, hashString, MapView, normalizeAngle, resolveMapView, setMapView } from "../model/map-view-store";
import { RotateEventDetail } from "../pinch-zoom/pinch-zoom";
import { calculateRealScale } from "../model/map-scale";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { getAllPresets } from "./presets";

export function toggleLock(card: XiaomiVacuumMapCard): void {
    card.mapLocked = !card.mapLocked;
    forwardHaptic("selection");
    persistMapView(card);
    card._scheduleDelayedCallback(() => card.requestUpdate(), 500);
}

/**
 * Returns the map to its default view: the configured `map_view` when there is one, otherwise
 * the neutral view the card started at before B9 — scale 1, no offset, `map_rotation`.
 *
 * Deliberately ignores the stored view: reset means "go back to the configured starting point",
 * not "go back to what was last saved". The result is then persisted and flushed through the
 * same debounced path as a pan, zoom or rotation, so a reload keeps the reset view and the map
 * refresh policy sees no additional work. A transition makes the move visible, exactly like the
 * pre-B9 reset control.
 */
export function resetMapView(card: XiaomiVacuumMapCard): void {
    const zoomerContent = card._getMapZoomerContent();
    if (zoomerContent) {
        zoomerContent.style.transitionDuration = card._getCssProperty("--map-card-internal-transitions-duration");
    }
    const neutral = getNeutralMapView(card);
    // A configured view is centred like the zoom control; the neutral fallback must stay the
    // pre-B9 top-left anchoring, so only convert when there is a `map_view`.
    const view = card.config?.map_view
        ? centreConfiguredView(card, resolveMapView(undefined, card.config.map_view, neutral) ?? neutral)
        : neutral;
    // Set the angle before the transform: the transform's change event persists the view, and it
    // must persist the angle the reset is going to, not the one it is leaving.
    card.mapRotation = view.rotation;
    const pinchZoom = card._getPinchZoom();
    if (pinchZoom) {
        pinchZoom.setTransform({ scale: view.scale, x: view.x, y: view.y, allowChangeEvent: true });
        card.mapScale = pinchZoom.scale;
        card.mapX = pinchZoom.x;
        card.mapY = pinchZoom.y;
    }
    forwardHaptic("selection");
    // The transform is a no-op when the card is already at the default, so the change event does
    // not fire and cannot be relied on to save the reset view.
    persistMapView(card);
    if (zoomerContent) {
        card._scheduleDelayedCallback(() => (zoomerContent.style.transitionDuration = "0s"), 300);
    }
    card.requestUpdate();
}

/** The neutral view: the state the card renders before any stored or configured view applies. */
export function getNeutralMapView(card: XiaomiVacuumMapCard): MapView {
    return { scale: 1, x: 0, y: 0, rotation: getConfiguredRotation(card._getCurrentPreset()) };
}

/**
 * Converts a configured view into the pinch-zoom transform.
 *
 * A configured `x`/`y` is an offset from the centred view, so `map_view: {scale: 1.5}` opens
 * exactly where one press of the zoom-in control leaves the map, at any card width. The
 * transform, on the other hand, positions the content's top-left corner, so the centred view has
 * to be expressed in that space: put the content centre in the viewport centre, then add the
 * configured offset. Rotation needs no extra term because the CSS transform already pivots on
 * the content centre, which makes the converted offsets screen offsets at any angle.
 *
 * Stored views are deliberately not passed through here: a gesture's offsets are already
 * transform values.
 */
export function centreConfiguredView(card: XiaomiVacuumMapCard, view: MapView): MapView {
    const pinchZoom = card._getPinchZoom();
    const content = card._getMapZoomerContent();
    if (!pinchZoom || !content) {
        return view;
    }
    const bounds = pinchZoom.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
        return view;
    }
    return {
        ...view,
        x: bounds.width / 2 - (view.scale * content.offsetWidth) / 2 + view.x,
        y: bounds.height / 2 - (view.scale * content.offsetHeight) / 2 + view.y,
    };
}

export function renderMapImage(card: XiaomiVacuumMapCard, transparentBackground: boolean): void {
    const image = card._getMapImage();
    const canvas = card._getMapCanvas();
    if (!image?.naturalWidth || !image.naturalHeight || !canvas) return;

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0);
    if (!transparentBackground) return;

    try {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let offset = 0; offset < imageData.data.length; offset += 4) {
            const red = imageData.data[offset];
            const green = imageData.data[offset + 1];
            const blue = imageData.data[offset + 2];
            const minimum = Math.min(red, green, blue);
            const maximum = Math.max(red, green, blue);
            if (minimum >= 250 && maximum - minimum <= 6) imageData.data[offset + 3] = 0;
        }
        context.putImageData(imageData, 0, 0);
    } catch (_error) {
        // Keep the source map visible if the browser does not allow pixel access.
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
    }
}

export function zoomIn(card: XiaomiVacuumMapCard): void {
    forwardHaptic("selection");
    updateScale(card, 1.5);
}

export function zoomOut(card: XiaomiVacuumMapCard): void {
    forwardHaptic("selection");
    updateScale(card, 1 / 1.5);
}

export function updateScale(card: XiaomiVacuumMapCard, diff: number): void {
    const zoomerContent = card._getMapZoomerContent();
    const pinchZoom = card._getPinchZoom();
    const zoomerRect = card._getPinchZoom().getBoundingClientRect();
    card.mapScale = Math.max(card.mapScale * diff, 0.5);
    zoomerContent.style.transitionDuration = "200ms";
    pinchZoom.scaleTo(card.mapScale, {
        originX: zoomerRect.left + zoomerRect.width / 2,
        originY: zoomerRect.top + zoomerRect.height / 2,
        relativeTo: "container",
        allowChangeEvent: true,
    });
    card._scheduleDelayedCallback(() => (zoomerContent.style.transitionDuration = "0s"), 300);
}

export function calculateBasicScale(card: XiaomiVacuumMapCard): void {
    const mapImage = card._getMapImage();
    const mapCanvas = card._getMapCanvas();
    if (mapImage && mapCanvas && mapImage.naturalWidth > 0) {
        card.realImageWidth = mapImage.naturalWidth;
        card.realImageHeight = mapImage.naturalHeight;
        card.realScale = calculateRealScale(mapCanvas, mapImage.naturalWidth);
    }
}

/**
 * Recalculates the base scale when the canvas is laid out at a new width.
 *
 * `realScale` converts image pixels to the canvas's untransformed layout width, so it is stale
 * after a sections-view resize (or any container width change). The image is CSS-scaled to the
 * new width, while the SVG overlay keeps drawing room outlines at the old scale, which visibly
 * detaches the overlays from the map. The observer reads layout only; it never asks for a map
 * refresh, so the refresh policy is untouched.
 */
export function updateMapResizeObserver(card: XiaomiVacuumMapCard): void {
    if (typeof ResizeObserver === "undefined") {
        return;
    }
    const mapCanvas = card._getMapCanvas();
    if (!mapCanvas) {
        return;
    }
    if (card.observedMapCanvas === mapCanvas) {
        return;
    }
    card.mapResizeObserver?.disconnect();
    card.observedMapCanvas = mapCanvas;
    card.mapResizeObserver = new ResizeObserver(() => {
        const image = card._getMapImage();
        if (image?.naturalWidth) {
            calculateBasicScale(card);
        }
    });
    card.mapResizeObserver.observe(mapCanvas);
}

export function calculateScale(card: XiaomiVacuumMapCard): void {
    const pinchZoom = card._getPinchZoom();
    card.mapScale = pinchZoom.scale;
    card.mapX = pinchZoom.x;
    card.mapY = pinchZoom.y;
    persistMapView(card);
}

export function isRotationGestureEnabled(card: XiaomiVacuumMapCard): boolean {
    return !card.mapLocked && (card._getCurrentPreset()?.map_rotation_gesture ?? true);
}

export function getConfiguredRotation(config?: CardPresetConfig): number {
    const configured = Number(config?.map_rotation);
    return Number.isFinite(configured) ? normalizeAngle(configured) : 0;
}

export function rotateMap(card: XiaomiVacuumMapCard): void {
    forwardHaptic("selection");
    const zoomerContent = card._getMapZoomerContent();
    if (zoomerContent) {
        zoomerContent.style.transitionDuration = card._getCssProperty("--map-card-internal-transitions-duration");
        card._scheduleDelayedCallback(() => (zoomerContent.style.transitionDuration = "0s"), 300);
    }
    // step from the nearest right angle, so a button press after a free rotation still lands square
    card._setRotation(Math.round(card.mapRotation / MAP_ROTATION_STEP) * MAP_ROTATION_STEP + MAP_ROTATION_STEP);
}

export function handleRotateGesture(card: XiaomiVacuumMapCard, event: CustomEvent<RotateEventDetail>): void {
    const angleDiff = event.detail?.angleDiff;
    if (!Number.isFinite(angleDiff)) {
        return;
    }
    card._setRotation(card.mapRotation + angleDiff);
}

export function handleRotateGestureEnd(card: XiaomiVacuumMapCard): void {
    const step = Math.round(card.mapRotation / MAP_ROTATION_STEP) * MAP_ROTATION_STEP;
    if (Math.abs(normalizeAngle(card.mapRotation - step + 180) - 180) <= MAP_ROTATION_SNAP_THRESHOLD) {
        card._setRotation(step);
    }
    persistMapView(card);
}

/**
 * Rotates around the middle of the visible area rather than the middle of the map, so whatever
 * the user is looking at stays put. The rotation itself is a plain CSS transform on the map
 * content; pan/zoom is nudged here to compensate.
 */
export function setRotation(card: XiaomiVacuumMapCard, degrees: number): void {
    // Keep the visual angle unwrapped so the fourth 90° button press animates 270° → 360°
    // instead of taking the long way back to 0°. Persisted/configured angles are normalized.
    const rotation = degrees;
    if (normalizeAngle(rotation) === normalizeAngle(card.mapRotation)) {
        return;
    }
    const pinchZoom = card._getPinchZoom();
    const zoomerContent = card._getMapZoomerContent();
    const previousRotation = card.mapRotation;
    card.mapRotation = rotation;

    if (pinchZoom && zoomerContent) {
        const bounds = pinchZoom.getBoundingClientRect();
        const scale = pinchZoom.scale;
        if (bounds.width && bounds.height && scale) {
            // centre of the map content and of the viewport, both in unrotated content pixels
            const centerX = zoomerContent.offsetWidth / 2;
            const centerY = zoomerContent.offsetHeight / 2;
            const viewX = bounds.width / 2;
            const viewY = bounds.height / 2;
            const offsetX = (viewX - pinchZoom.x) / scale - centerX;
            const offsetY = (viewY - pinchZoom.y) / scale - centerY;
            const radians = ((rotation - previousRotation) * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            pinchZoom.setTransform({
                scale,
                x: viewX - scale * (centerX + offsetX * cos - offsetY * sin),
                y: viewY - scale * (centerY + offsetX * sin + offsetY * cos),
                allowChangeEvent: true,
            });
        }
    }
    persistMapView(card);
    card.requestUpdate();
}

export function isMapViewPersistenceEnabled(card: XiaomiVacuumMapCard): boolean {
    return card.config?.persist_map_view !== false && !card.isInEditor;
}

export function isMapLockPersistenceEnabled(card: XiaomiVacuumMapCard): boolean {
    return card.config?.persist_map_lock !== false;
}

/**
 * The dashboard path is part of the key, so the same card placed on two views keeps a view per
 * view. Set `map_view_storage_key` to opt out of that, either to survive a dashboard rename or
 * to deliberately share one view between pages.
 */
export function getMapViewDashboardPath(): string {
    return (window.location?.pathname ?? "").replace(/\/+$/, "");
}

export function getMapViewCardKey(card: XiaomiVacuumMapCard): string {
    const path = getMapViewDashboardPath();
    if (card.mapViewCardKey && card.mapViewCardKeyPath === path) {
        return card.mapViewCardKey;
    }
    const config = card.config ?? ({} as XiaomiVacuumMapCardConfig);
    card.mapViewCardKeyPath = path;
    if (config.map_view_storage_key) {
        card.mapViewCardKey = String(config.map_view_storage_key);
        return card.mapViewCardKey;
    }
    const signature = JSON.stringify([
        path,
        config.title ?? "",
        config.entity ?? "",
        getAllPresets(card).map(preset => [
            preset?.preset_name ?? "",
            preset?.map_source?.camera ?? "",
            preset?.map_source?.image ?? "",
            preset?.entity ?? "",
        ]),
    ]);
    card.mapViewCardKey = hashString(signature);
    return card.mapViewCardKey;
}

export function getMapViewMapId(card: XiaomiVacuumMapCard, camera: string): string {
    if (!camera || !card.hass) {
        return "";
    }
    const state = card.hass.states[camera];
    if (!state) {
        return "";
    }
    const attributes = state.attributes ?? {};
    for (const attribute of MAP_VIEW_ID_ATTRIBUTES) {
        const value = attributes[attribute];
        if (value !== null && value !== undefined && ["string", "number", "boolean"].includes(typeof value)) {
            const asString = String(value);
            if (asString.length > 0) {
                return `${attribute}=${asString.length > 32 ? hashString(asString) : asString}`;
            }
        }
    }
    const calibrationPoints = attributes.calibration_points;
    if (Array.isArray(calibrationPoints) && calibrationPoints.length > 0) {
        const normalized = calibrationPoints.map((point: CalibrationPoint) => [
            Math.round(Number(point?.map?.x)) || 0,
            Math.round(Number(point?.map?.y)) || 0,
            Math.round(Number(point?.vacuum?.x)) || 0,
            Math.round(Number(point?.vacuum?.y)) || 0,
        ]);
        return `cal=${hashString(JSON.stringify(normalized))}`;
    }
    return "";
}

export function getMapViewKey(card: XiaomiVacuumMapCard): string {
    const preset = card._getCurrentPreset() ?? ({} as CardPresetConfig);
    const camera = preset.map_source?.camera ?? "";
    const image = preset.map_source?.image ?? "";
    // The configured default is part of the key. Without it a stored view—which almost always
    // exists once the reset has run—would keep winning over an edited `map_view` forever, and
    // the new default would only appear after another reset. A changed default is a changed
    // starting point, so it gets its own entry. The explicit `map_view_storage_key` still
    // replaces only the card part of the key.
    // Only a configured default extends the key. Appending a constant when it is absent would
    // change the storage key of every existing card, so every user with `persist_map_view`
    // (on by default) would silently lose the view they had saved once after upgrading.
    const mapView = card.config?.map_view;
    const parts = [
        getMapViewCardKey(card),
        card.presetIndex ?? 0,
        camera || image,
        getMapViewMapId(card, camera),
    ];
    if (mapView) {
        parts.push(
            hashString(
                JSON.stringify([
                    mapView.scale ?? null,
                    mapView.x ?? null,
                    mapView.y ?? null,
                    mapView.rotation ?? null,
                ]),
            ),
        );
    }
    return parts.join("|");
}

/**
 * Applies the view for the current key: a stored view when persistence is on, otherwise the
 * configured `map_view`, otherwise nothing and the neutral view the render already started from.
 *
 * The configured default is intentionally independent of `persist_map_view`: that flag controls
 * remembering what the user does, while `map_view` states where the card starts. A card with
 * persistence disabled therefore still opens at the configured view and simply never stores one.
 *
 * The default is also applied only at the start of a card or preset session (that is, the first
 * time this card resolves any key since `setConfig`, a preset switch or the mount). A camera
 * whose map id changes mid-session—a re-map, or the calibration-points fallback that some
 * integrations only expose—produces a new key; a default applied there would yank the map away
 * from whatever the user is looking at. On such a later key change the current view is kept
 * unless the new key has a stored view of its own.
 */
export function restoreMapView(card: XiaomiVacuumMapCard): void {
    const pinchZoom = card._getPinchZoom();
    if (!pinchZoom) {
        return;
    }
    const key = card._getMapViewKey();
    if (card.restoredMapViewKey === key) {
        return;
    }
    const zoomerRect = pinchZoom.getBoundingClientRect();
    if (!zoomerRect.width || !zoomerRect.height) {
        return;
    }
    // A camera map can be mid-load when the restore runs: a refresh after the interval or after
    // a camera change replaces the src, and only those now cause a reload. Waiting for
    // `complete` alone would starve the restore during that load; once we have measured a real
    // image the laid out content box is enough to position against.
    const mapImage = card._getMapImage();
    const imageReady = mapImage && ((mapImage.complete && mapImage.naturalWidth > 0) || card.realImageWidth > 0);
    if (!imageReady) {
        return;
    }
    const zoomerContent = card._getMapZoomerContent();
    if (!zoomerContent) {
        return;
    }
    const contentRect = zoomerContent.getBoundingClientRect();
    if (!contentRect.width || !contentRect.height) {
        return;
    }
    // The mount, `setConfig` and a preset switch clear the key, so an undefined value is the
    // start of a card or preset session: the only moment the configured default may take over.
    const sessionStart = card.restoredMapViewKey === undefined;
    card.restoredMapViewKey = key;
    const stored = isMapViewPersistenceEnabled(card) ? getMapView(key) : undefined;
    const view = resolveMapView(
        stored,
        sessionStart ? card.config?.map_view : undefined,
        getNeutralMapView(card),
    );
    if (!view) {
        // A later key change with nothing stored for it keeps the current view, which is exactly
        // the pre-B9 behaviour when no default is configured.
        return;
    }
    // Stored offsets are already pinch-zoom transform values; a configured view states its
    // offsets from the centred view and has to be converted first.
    const transformView = stored ? view : centreConfiguredView(card, view);
    if (isMapLockPersistenceEnabled(card) && typeof view.locked === "boolean") {
        card.mapLocked = view.locked;
    }
    // set directly rather than through _setRotation: the stored x/y already match this angle
    card.mapRotation = transformView.rotation;
    pinchZoom.setTransform({
        scale: transformView.scale,
        x: transformView.x,
        y: transformView.y,
        allowChangeEvent: false,
    });
    card.mapScale = pinchZoom.scale;
    card.mapX = pinchZoom.x;
    card.mapY = pinchZoom.y;
    card.requestUpdate();
}

export function persistMapView(card: XiaomiVacuumMapCard): void {
    if (!isMapViewPersistenceEnabled(card)) {
        return;
    }
    const pinchZoom = card._getPinchZoom();
    if (!pinchZoom) {
        return;
    }
    const key = card._getMapViewKey();
    if (card.restoredMapViewKey !== key) {
        return;
    }
    card.pendingMapViewKey = key;
    card.pendingMapView = {
        scale: pinchZoom.scale,
        x: pinchZoom.x,
        y: pinchZoom.y,
        rotation: card.mapRotation,
        locked: isMapLockPersistenceEnabled(card) ? card.mapLocked : undefined,
    };
    if (card.mapViewSaveTimer) {
        clearTimeout(card.mapViewSaveTimer);
    }
    card.mapViewSaveTimer = window.setTimeout(card._flushMapView, MAP_VIEW_SAVE_DEBOUNCE);
}

export function flushMapView(card: XiaomiVacuumMapCard): void {
    if (card.mapViewSaveTimer) {
        clearTimeout(card.mapViewSaveTimer);
        card.mapViewSaveTimer = undefined;
    }
    const key = card.pendingMapViewKey;
    const view = card.pendingMapView;
    card.pendingMapViewKey = undefined;
    card.pendingMapView = undefined;
    if (key && view) {
        setMapView(key, view);
    }
}
