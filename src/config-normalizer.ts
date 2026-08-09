import {
    CalibrationPoint,
    CardPresetConfig,
    IconConfig,
    LabelConfig,
    Point,
    PredefinedSelectionConfig,
    XiaomiVacuumMapCardConfig,
} from "./types/types";

type Coordinate = Point | IconConfig | LabelConfig;

function normalizeCoordinate<T extends Coordinate>(coordinate: T): T {
    const rawCoordinate = coordinate as unknown as Record<string, unknown>;

    if (coordinate.y !== undefined || rawCoordinate.true === undefined) {
        return coordinate;
    }

    const { true: yaml11Y, ...rest } = rawCoordinate;
    return { ...rest, y: yaml11Y } as unknown as T;
}

function normalizeCalibrationPoint(point: CalibrationPoint): CalibrationPoint {
    return {
        ...point,
        map: normalizeCoordinate(point.map),
        vacuum: normalizeCoordinate(point.vacuum),
    };
}

function normalizePredefinedSelection(selection: PredefinedSelectionConfig): PredefinedSelectionConfig {
    return {
        ...selection,
        ...(selection.icon && { icon: normalizeCoordinate(selection.icon) }),
        ...(selection.label && { label: normalizeCoordinate(selection.label) }),
    };
}

function normalizePreset<T extends CardPresetConfig>(preset: T): T {
    return {
        ...preset,
        ...(preset.calibration_source?.calibration_points && {
            calibration_source: {
                ...preset.calibration_source,
                calibration_points: preset.calibration_source.calibration_points.map(normalizeCalibrationPoint),
            },
        }),
        ...(preset.map_modes && {
            map_modes: preset.map_modes.map(mode => ({
                ...mode,
                ...(mode.predefined_selections && {
                    predefined_selections: mode.predefined_selections.map(normalizePredefinedSelection),
                }),
            })),
        }),
    };
}

/** Restore y coordinate keys parsed as boolean true by Home Assistant's YAML 1.1 editor. */
export function normalizeConfig(config: XiaomiVacuumMapCardConfig): XiaomiVacuumMapCardConfig {
    return {
        ...normalizePreset(config),
        ...(config.additional_presets && {
            additional_presets: config.additional_presets.map(normalizePreset),
        }),
    };
}
