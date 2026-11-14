import { forwardHaptic } from "custom-card-helpers";
import type { ReplacedKey } from "../types/types";
import { CalibrationPoint, CardPresetConfig, VariablesStorage } from "../types/types";
import { EMPTY_MAP_MODE } from "../const";
import { areConditionsMet, getWatchedEntities } from "../utils";
import { MapMode } from "../model/map_mode/map-mode";
import { PlatformGenerator } from "../model/generators/platform-generator";
import { CoordinatesConverter } from "../model/map_objects/coordinates-converter";
import { ServiceCallSchema } from "../model/map_mode/service-call-schema";
import type { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { getConfiguredRotation } from "./map-view";
import { selectionChanged } from "./selection";
import { setCurrentMode } from "./selection";

export function getCalibration(card: XiaomiVacuumMapCard, config: CardPresetConfig): CalibrationPoint[] | undefined {
    if (config.calibration_source?.identity) {
        return [
            { map: { x: 0, y: 0 }, vacuum: { x: 0, y: 0 } },
            { map: { x: 1, y: 0 }, vacuum: { x: 1, y: 0 } },
            { map: { x: 0, y: 1 }, vacuum: { x: 0, y: 1 } },
        ];
    }
    if (
        config.calibration_source?.calibration_points &&
        [3, 4].includes(config.calibration_source.calibration_points.length)
    ) {
        return config.calibration_source.calibration_points;
    }
    if (!card.hass) {
        return undefined;
    }
    if (config.calibration_source?.entity && !config.calibration_source?.attribute) {
        return JSON.parse(card.hass.states[config.calibration_source.entity]?.state);
    }
    if (config.calibration_source?.entity && config.calibration_source?.attribute) {
        return card.hass.states[config.calibration_source.entity]?.attributes[config.calibration_source.attribute];
    }
    if (config.calibration_source?.camera) {
        return card.hass.states[config.map_source?.camera ?? ""]?.attributes["calibration_points"];
    }
    if (config.calibration_source?.platform) {
        return PlatformGenerator.getCalibration(config.calibration_source.platform);
    }
    const platformCalibration = PlatformGenerator.getCalibration(config.vacuum_platform);
    if (platformCalibration) {
        return platformCalibration;
    }
    return undefined;
}

export function getAllPresets(card: XiaomiVacuumMapCard): CardPresetConfig[] {
    return [card.config, ...(card.config.additional_presets ?? [])];
}

export function getAllAvailablePresets(card: XiaomiVacuumMapCard): CardPresetConfig[] {
    const allPresets = getAllPresets(card);
    const available = allPresets.filter(
        p => (p.conditions?.length ?? 0) === 0 || areConditionsMet(p, card.internalVariables, card.hass),
    );
    return available.length === 0 ? [allPresets[0]] : available;
}

export function getPreviousPresetIndex(card: XiaomiVacuumMapCard): number {
    const allPresets = getAllPresets(card);
    const previousPresets = allPresets.filter(
        (p, i) =>
            i < card.presetIndex &&
            ((p.conditions?.length ?? 0) === 0 || areConditionsMet(p, card.internalVariables, card.hass)),
    );
    if (previousPresets.length == 0) return -1;
    return allPresets.indexOf(previousPresets[previousPresets.length - 1]);
}

export function getNextPresetIndex(card: XiaomiVacuumMapCard): number {
    const allPresets = getAllPresets(card);
    const previousPresets = allPresets.filter(
        (p, i) =>
            i > card.presetIndex &&
            ((p.conditions?.length ?? 0) === 0 || areConditionsMet(p, card.internalVariables, card.hass)),
    );
    if (previousPresets.length == 0) return -1;
    return allPresets.indexOf(previousPresets[0]);
}

export function openPreviousPreset(card: XiaomiVacuumMapCard): void {
    const index = getPreviousPresetIndex(card);
    if (index >= 0) {
        setPresetIndex(card, index, true);
    }
}

export function openNextPreset(card: XiaomiVacuumMapCard): void {
    const index = getNextPresetIndex(card);
    if (index >= 0) {
        setPresetIndex(card, index, true);
    }
}

export function setPresetIndex(card: XiaomiVacuumMapCard, index: number, user = false, force = false): void {
    index = Math.min(Math.max(index, 0), card.config.additional_presets?.length ?? 0);
    if (index === card.presetIndex && !force) {
        return;
    }
    const config = index === 0 ? card.config : (card.config.additional_presets ?? [])[index - 1];
    // must happen before the reset below, so that the reset is not persisted for the preset we are leaving
    card.restoredMapViewKey = undefined;
    // the angle and the pan/zoom belong together - the offsets only make sense for the angle they
    // were taken at - so a locked map has to keep both or neither
    if (!card.mapLocked) {
        card._getPinchZoom()?.setTransform({ scale: 1, x: 0, y: 0, allowChangeEvent: true });
        card.mapRotation = getConfiguredRotation(config);
    }
    if (user) {
        forwardHaptic("selection");
    }
    card.mapLocked = config?.map_locked ?? false;
    card.selectedMode = 0;
    card.realScale = 1;
    card.mapScale = 1;
    card.mapX = 0;
    card.mapY = 0;
    if (card.hass) updateCalibration(card, config);
    card.modes = getModes(card, config);

    card.presetIndex = index;
    card.currentPreset = config;
    card.internalVariables = getInternalVariables(config);

    card._getIconsAndTiles(config, card.internalVariables)
        .then(([icons, tiles]) => setPreset(card, { ...config, tiles: tiles, icons: icons }))
        .then(() => card._scheduleDelayedCallback(() => card.requestUpdate(), 100))
        .then(() => setCurrentMode(card, 0, false));

    if (user && card.currentPreset.activate_on_switch) {
        executePresetsActivation(card);
    }
    selectionChanged(card);
}

export function getInternalVariables(config: CardPresetConfig): VariablesStorage {
    return {
        ...(PlatformGenerator.getVariables(config.vacuum_platform) ?? {}),
        ...(config.internal_variables ?? {}),
    };
}

export function getModes(card: XiaomiVacuumMapCard, config: CardPresetConfig) {
    const vacuumPlatform = PlatformGenerator.getPlatformName(config.vacuum_platform);
    return (
        (config.map_modes?.length ?? -1) === -1 || vacuumPlatform.startsWith("Setup")
            ? PlatformGenerator.generateDefaultModes(vacuumPlatform)
            : config.map_modes ?? [EMPTY_MAP_MODE]
    ).map(m => new MapMode(vacuumPlatform, m, card.config.language));
}

export function executePresetsActivation(card: XiaomiVacuumMapCard) {
    if (card.currentPreset.activate) {
        const schema = new ServiceCallSchema(card.currentPreset.activate);
        const serviceCall = schema.apply(card.currentPreset.entity, [], 0, {});
        card.hass
            .callService(serviceCall.domain, serviceCall.service, serviceCall.serviceData, serviceCall.target)
            .then(() => forwardHaptic("success"));
    }
}

export function setPreset(card: XiaomiVacuumMapCard, config: CardPresetConfig): void {
    card.currentPreset = config;
    card.watchedEntities = getWatchedEntities({type: "", ...config});
}

export function updateCalibration(card: XiaomiVacuumMapCard, config: CardPresetConfig): void {
    card.coordinatesConverter = undefined;
    const calibrationPoints = getCalibration(card, config);
    card.coordinatesConverter = new CoordinatesConverter(calibrationPoints);
}

export function setInternalVariable(card: XiaomiVacuumMapCard, variable: string, value: ReplacedKey) {
    const newValues = { ...card.internalVariables };
    newValues[variable] = value;
    card.internalVariables = newValues;
    card.requestUpdate();
}
