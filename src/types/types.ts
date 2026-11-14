import {
    ActionConfig,
    ActionHandlerEvent,
    LovelaceCard,
    LovelaceCardConfig,
    LovelaceCardEditor,
} from "custom-card-helpers";
import { ACTION_HANDLER_CUSTOM_ELEMENT_NAME, CARD_CUSTOM_ELEMENT_NAME, EDITOR_CUSTOM_ELEMENT_NAME } from "../const";
import { XiaomiVacuumMapCardActionHandler } from "../action-handler-directive";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { Tile } from "../components/tile";

declare global {
    interface HTMLElementTagNameMap {
        [CARD_CUSTOM_ELEMENT_NAME]: XiaomiVacuumMapCard;
        [EDITOR_CUSTOM_ELEMENT_NAME]: LovelaceCardEditor;
        [ACTION_HANDLER_CUSTOM_ELEMENT_NAME]: XiaomiVacuumMapCardActionHandler;
        "hui-error-card": LovelaceCard;
        "xvmc-tile": Tile;
    }
}

export type RectangleType = [PointType, PointType, PointType, PointType];
export type ZoneType = [number, number, number, number];
export type ZoneWithRepeatsType = [number, number, number, number, number];
export type PointType = [number, number];
export type OutlineType = PointType[];
export type PointWithRepeatsType = [number, number, number];
export type PredefinedSelectionConfig = PredefinedZoneConfig | PredefinedPointConfig | RoomConfig;
export type TranslatableString = string | [string, string, string];
export type Language = string | undefined;
export type ReplacedKey = string | Record<string, unknown> | number | unknown[];
export type VariablesStorage = Record<string, ReplacedKey>;
export type KeyReplacer = (key: string) => ReplacedKey;
export type LovelaceDomEvent = CustomEvent<Record<string, never>>;
export type DropdownIconActionConfig = DropdownEntryIconActionConfig[];
export type ActionHandlerFunction = ((_?: ActionHandlerEvent) => void);
export type ActionHandlerFunctionCreator = (_: ActionableObjectConfig) => ActionHandlerFunction;

export type EntityRegistryEntry = {
    entity_id: string;
    original_icon: string;
    icon?: string;
    unique_id: string;
    disabled_by?: string;
};

/**
 * How the card arranges the map and the controls below/beside it.
 *
 * `vertical` is the upstream arrangement and the default: map first, then modes, icons and tiles.
 * `horizontal` puts the map and the controls side by side, with the controls column scrolling
 * inside the card when it is taller than the map.
 */
export type CardLayout = "vertical" | "horizontal";

/**
 * The subset of Home Assistant's `LovelaceGridOptions` this card returns from `getGridOptions()`.
 *
 * HA's interface is declared in `home-assistant/frontend` at `src/panels/lovelace/types.ts`:
 * `columns?: number | "full"`, `rows?: number | "auto"`, `max_columns?`, `min_columns?`,
 * `min_rows?` and `max_rows?`. Sections divide a section into 12 columns, and `computeCardGridSize`
 * in `src/panels/lovelace/common/compute-card-grid-size.ts` defaults a missing `columns` to 12 and
 * a missing `rows` to `"auto"`, so an auto-height cell fits the card's content. The vertical layout
 * omits `rows` and the row clamps, keeping that default (issue #943 is fixed by the card filling
 * the cell it is given, not by requesting a numeric height). Only the horizontal layout asks for a
 * numeric default height; it deliberately has no `max_rows`, so a user's `grid_options` override
 * can make the card as tall as they need.
 */
export interface CardGridOptions {
    columns?: number | "full";
    rows?: number | "auto";
    max_columns?: number;
    min_columns?: number;
    min_rows?: number;
    max_rows?: number;
}

export interface XiaomiVacuumMapCardConfig extends LovelaceCardConfig, CardPresetConfig {
    readonly title?: string;
    readonly layout?: CardLayout;
    readonly additional_presets?: CardPresetConfig[];
    readonly language?: Language;
    readonly debug?: boolean;
    readonly action_handler_id?: string;
    readonly persist_map_view?: boolean;
    readonly persist_map_lock?: boolean;
    readonly map_view_storage_key?: string;
    readonly map_view?: MapViewConfig;
}

/**
 * The view the card starts at when nothing is stored for it, and returns to on reset.
 *
 * Every field is optional. An omitted field keeps its neutral value — scale 1, no offset, the
 * preset's `map_rotation` — so `map_view: {scale: 2.5}` is a complete configuration. A field that
 * is present must be a finite number and `scale` must be inside the card's zoom range; anything
 * else is reported by the config validation instead of being applied.
 */
export interface MapViewConfig {
    readonly scale?: number;
    readonly x?: number;
    readonly y?: number;
    readonly rotation?: number;
}

export interface CardPresetConfig extends ConditionalObjectConfig {
    readonly preset_name?: string;
    readonly entity: string;
    readonly vacuum_platform?: string;
    readonly map_source: MapSourceConfig;
    readonly map_locked?: boolean;
    readonly two_finger_pan?: boolean;
    readonly map_rotation?: number;
    readonly map_rotation_gesture?: boolean;
    readonly calibration_source?: CalibrationSourceConfig;
    readonly icons?: IconActionConfig[];
    readonly append_icons?: boolean;
    readonly tiles?: TileConfig[];
    readonly append_tiles?: boolean;
    readonly map_modes?: MapModeConfig[];
    readonly activate?: ServiceCallSchemaConfig;
    readonly activate_on_switch?: boolean;
    readonly clean_selection_on_start?: boolean;
    readonly internal_variables?: VariablesStorage;
}

export interface MapSourceConfig {
    readonly camera?: string;
    readonly image?: string;
    readonly crop?: MapCroppingConfig;
    readonly transparent_background?: boolean;
}

export interface CalibrationSourceConfig {
    readonly camera?: boolean;
    readonly identity?: boolean;
    readonly platform?: string;
    readonly entity?: string;
    readonly attribute?: string;
    readonly calibration_points?: CalibrationPoint[];
}

export interface MapModeConfig {
    readonly template?: string;
    readonly name?: string;
    readonly icon?: string;
    readonly run_immediately?: boolean;
    readonly coordinates_rounding?: boolean;
    readonly id_type?: "number" | "string";
    readonly coordinates_to_meters_divider?: number;
    readonly selection_type?: string;
    readonly max_selections?: number;
    readonly repeats_type?: string;
    readonly max_repeats?: number;
    readonly service_call_schema?: ServiceCallSchemaConfig;
    readonly predefined_selections?: PredefinedSelectionConfig[];
    readonly variables?: VariablesStorage;
}

export interface PlatformTemplate {
    readonly map_modes: {
        readonly default_templates: string[];
        readonly templates: { [templateName: string]: MapModeConfig };
    };
    readonly tiles?: {
        readonly from_attributes?: TileFromAttributeTemplate[];
        readonly from_sensors?: TileFromSensorTemplate[];
    };
    readonly icons?: IconTemplate[];
    readonly calibration_points?: CalibrationPoint[];
    readonly internal_variables?: VariablesStorage;
}

export interface TileTemplate extends TileConfig {
    readonly translation_keys?: Array<string>;
    readonly duration_unit?: string;
}

export interface TileFromAttributeTemplate extends TileTemplate {
    readonly attribute: string;
    readonly icon: string;
}

export interface TileFromSensorTemplate extends TileTemplate {
    readonly unique_id_regex: string;
}

export interface IconTemplate extends Omit<IconActionConfig, "icon"> {
    readonly type: "single" | "menu";
}

export interface SingleIconTemplate extends IconTemplate {
    readonly type: "single";
    readonly icon: string;
    readonly unique_id_regex: string;
}

export interface MenuIconTemplate extends IconTemplate {
    readonly type: "menu";
    readonly menu_id: string;
    readonly icon?: string;
    readonly unique_id_regex: string;
    readonly current_value_attribute?: string;
    readonly available_values_attribute: string;
    readonly icon_mapping?: Record<string, string>;
    readonly value_translation_keys?: Record<string, string>;
}

export interface IconActionConfig extends ActionableObjectConfig, ConditionalObjectConfig {
    readonly type?: "menu" | "single";
    readonly icon_id?: string;
    readonly icon?: string;
    readonly tooltip?: string;
    readonly order?: number;
    readonly menu_id?: string;
    readonly replace_config?: boolean;
    readonly label?: string;
}

export interface MenuIconActionConfig extends IconActionConfig {
    readonly type: "menu";
    readonly menu_id: string;
    readonly entity: string;
    readonly current_value_attribute?: string;
    readonly available_values_attribute: string;
    readonly icon_mapping?: Record<string, string>;
    readonly value_translation_keys?: Record<string, string>;
}

export interface DropdownEntryIconActionConfig extends IconActionConfig {
    readonly isSelected: boolean;
}

export interface TileConfig extends ActionableObjectConfig, ConditionalObjectConfig {
    readonly tile_id?: string;
    readonly label?: string;
    readonly tooltip?: string;
    readonly icon?: string;
    readonly icon_source?: string;
    readonly internal_variable?: string;
    readonly entity?: string;
    readonly attribute?: string;
    readonly unit?: string;
    readonly multiplier?: number;
    readonly precision?: number;
    readonly translations?: Record<string, string>;
    readonly replace_config?: boolean;
    readonly order?: number;
}

export interface ActionableObjectConfig {
    readonly tap_action?: ActionConfig;
    readonly hold_action?: ActionConfig;
    readonly double_tap_action?: ActionConfig;
    readonly variables?: VariablesStorage;
    readonly remove?: boolean;
}

export interface ConditionalObjectConfig {
    readonly conditions?: ConditionConfig[];
}

export interface ConditionConfig {
    readonly entity?: string;
    readonly internal_variable?: string;
    readonly attribute?: string;
    readonly value?: string;
    readonly value_not?: string;
}

export interface CalibrationPoint {
    readonly vacuum: Point;
    readonly map: Point;
}

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface PredefinedSelectionCommonConfig {
    readonly label?: LabelConfig;
    readonly icon?: IconConfig;
    readonly variables?: VariablesStorage;
    readonly default_state?: SelectionState;
    readonly state_entity?: string;
}

export interface PredefinedZoneConfig extends PredefinedSelectionCommonConfig {
    readonly zones: ZoneType[] | string;
}

export interface PredefinedPointConfig extends PredefinedSelectionCommonConfig {
    readonly position: PointType | string;
}

export interface RoomConfig extends PredefinedSelectionCommonConfig {
    readonly id: number | string;
    readonly outline?: OutlineType;
}

export interface LabelConfig {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly offset_x?: number;
    readonly offset_y?: number;
}

export interface IconConfig {
    readonly name: string;
    readonly x: number;
    readonly y: number;
}

export interface ServiceCallSchemaConfig {
    readonly service: string;
    readonly service_data?: Record<string, unknown>;
    readonly target?: Record<string, unknown>;
    readonly evaluate_data_as_template?: boolean;
}

export interface MapCroppingConfig {
    readonly top?: number;
    readonly bottom?: number;
    readonly left?: number;
    readonly right?: number;
}

export interface MapExtractorRoom {
    readonly x0: number | undefined;
    readonly y0: number | undefined;
    readonly x1: number | undefined;
    readonly y1: number | undefined;
    readonly outline: OutlineType | undefined;
    readonly name: string | undefined;
    readonly icon: string | undefined;
    readonly x: number | undefined;
    readonly y: number | undefined;
}

export interface RoomConfigRequestEventData {
    readonly entity?: string;
    readonly camera?: string;
    readonly requestId?: string;
}

export interface RoomConfigEventData {
    readonly modeIndex: number;
    readonly rooms: Array<RoomConfig>;
    // Identifies which card's entity this response belongs to. EVENT_ROOM_CONFIG_GET and
    // EVENT_ROOM_CONFIG are dispatched on `window` with no built-in scoping: with more than one
    // card mounted every card receives the broadcast request and every one replies. This field lets
    // the editor reject another card's answer. See _handleRoomsConfigGet/_handleRoomConfig.
    readonly entity: string | undefined;
    readonly camera?: string;
    // Echoes the request id from RoomConfigRequestEventData so only the editor that asked accepts
    // the response, even when two editors configure the same entity/camera.
    readonly requestId?: string;
}

export interface EntityConfig {
    entity: string;
    attribute?: string;
    unit?: string;
}

export enum ActionType {
    CLEANING_START = "cleaning.start",
    INTERNAL_VARIABLE_SET = "internal_variable.set",
    MAP_MODE_NEXT = "map_mode.next",
    MAP_MODE_PREVIOUS = "map_mode.previous",
    MAP_MODE_SET = "map_mode.set",
    MAP_VIEW_RESET = "map_view.reset",
    REPEATS_DECREMENT = "repeats.decrement",
    REPEATS_INCREMENT = "repeats.increment",
    REPEATS_SET = "repeats.set",
    SELECTION_CLEAR = "selection.clear",
}

export enum SelectionState {
    SELECTED = "selected",
    UNSELECTED = "unselected",
}
