/* eslint-disable @typescript-eslint/no-explicit-any */
// import "@polymer/paper-item/paper-item";
// import "@polymer/paper-listbox/paper-listbox";
// import "@polymer/paper-dropdown-menu/paper-dropdown-menu";
import { css, CSSResultGroup, html, LitElement, PropertyValues, svg, SVGTemplateResult, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators";
import {
    ActionHandlerEvent,
    forwardHaptic,
    HomeAssistant,
    LovelaceCard,
    LovelaceCardEditor,
} from "custom-card-helpers";

import "./editor";
import type { PredefinedPointConfig, RoomConfig, TileConfig, XiaomiVacuumMapCardConfig } from "./types/types";
import { CalibrationPoint, CardPresetConfig, PredefinedZoneConfig, TranslatableString } from "./types/types";
import { actionHandler } from "./action-handler-directive";
import {
    CARD_CUSTOM_ELEMENT_NAME,
    CARD_VERSION,
    DISCONNECTED_IMAGE,
    DISCONNECTION_TIME,
    EDITOR_CUSTOM_ELEMENT_NAME,
} from "./const";
import { localize, localizeWithHass } from "./localize/localize";
import PinchZoom from "./pinch-zoom";
import "./pinch-zoom";
import { ManualRectangle } from "./model/map_objects/manual-rectangle";
import { Context } from "./model/map_objects/context";
import { ManualPoint } from "./model/map_objects/manual-point";
import { ManualPath } from "./model/map_objects/manual-path";
import {
    areConditionsMet,
    conditional,
    getMousePosition,
    getWatchedEntities,
    hasConfigOrAnyEntityChanged,
    stopEvent,
} from "./utils";
import { PredefinedPoint } from "./model/map_objects/predefined-point";
import { PredefinedMultiRectangle } from "./model/map_objects/predefined-multi-rectangle";
import { Room } from "./model/map_objects/room";
import { areAllEntitiesDefined, isOldConfig, validateConfig } from "./config-validators";
import { MapMode } from "./model/map_mode/map-mode";
import { SelectionType } from "./model/map_mode/selection-type";
import { RepeatsType } from "./model/map_mode/repeats-type";
import { PlatformGenerator } from "./model/generators/platform-generator";
import { TilesGenerator } from "./model/generators/tiles-generator";
import { IconListGenerator } from "./model/generators/icon-list-generator";
import { TileRenderer } from "./renderers/tile-renderer";
import { IconRenderer } from "./renderers/icon-renderer";
import { ToastRenderer } from "./renderers/toast-renderer";
import { ModesMenuRenderer } from "./renderers/modes-menu-renderer";
import { CoordinatesConverter } from "./model/map_objects/coordinates-converter";
import { MapObject } from "./model/map_objects/map-object";
import { MousePosition } from "./model/map_objects/mouse-position";
import { ServiceCallSchema } from "./model/map_mode/service-call-schema";

const line1 = "   XIAOMI-VACUUM-MAP-CARD";
const line2 = `   ${localize("common.version")} ${CARD_VERSION}`;
const length = Math.max(line1.length, line2.length) + 3;
const pad = (text: string, length: number) => text + " ".repeat(length - text.length);
/* eslint no-console: 0 */
console.info(
    `%c${pad(line1, length)}\n%c${pad(line2, length)}`,
    "color: orange; font-weight: bold; background: black",
    "color: white; font-weight: bold; background: dimgray",
);

const windowWithCards = window as unknown as Window & { customCards: unknown[] };
windowWithCards.customCards = windowWithCards.customCards || [];
windowWithCards.customCards.push({
    type: CARD_CUSTOM_ELEMENT_NAME,
    name: "Xiaomi Vacuum Map Card",
    description: localize("common.description"),
    preview: true,
});

@customElement(CARD_CUSTOM_ELEMENT_NAME)
export class XiaomiVacuumMapCard extends LitElement {
    public static async getConfigElement(): Promise<LovelaceCardEditor> {
        return document.createElement(EDITOR_CUSTOM_ELEMENT_NAME);
    }

    public static getStubConfig(hass: HomeAssistant): XiaomiVacuumMapCardConfig | undefined {
        const entities = Object.keys(hass.states);
        const cameras = entities
            .filter(e => e.substr(0, e.indexOf(".")) === "camera")
            .filter(e => hass?.states[e].attributes["calibration_points"]);
        const vacuums = entities.filter(e => e.substr(0, e.indexOf(".")) === "vacuum");
        if (cameras.length === 0 || vacuums.length === 0) {
            return undefined;
        }
        return {
            type: "custom:" + CARD_CUSTOM_ELEMENT_NAME,
            map_source: {
                camera: cameras[0],
            },
            calibration_source: {
                camera: true,
            },
            entity: vacuums[0],
            vacuum_platform: "default",
        };
    }

    @property({ attribute: false }) public _hass!: HomeAssistant;
    @state() private oldConfig = false;
    @state() private config!: XiaomiVacuumMapCardConfig;
    @state() private presetIndex!: number;
    @state() private realScale!: number;
    @state() private realImageWidth!: number;
    @state() private realImageHeight!: number;
    @state() private mapScale!: number;
    @state() private mapX!: number;
    @state() private mapY!: number;
    @state() private repeats = 1;
    @state() private selectedMode = 0;
    @state() private mapLocked = false;
    @state() private configErrors: string[] = [];
    @state() private connected = false;
    private currentPreset!: CardPresetConfig;
    private watchedEntities: string[] = [];
    private selectedManualRectangles: ManualRectangle[] = [];
    private selectedManualPoint?: ManualPoint;
    private selectedManualPath: ManualPath = new ManualPath([], this._getContext());
    private selectedPredefinedRectangles: PredefinedMultiRectangle[] = [];
    private selectedRooms: Room[] = [];
    private selectedPredefinedPoint: PredefinedPoint[] = [];
    private selectablePredefinedRectangles: PredefinedMultiRectangle[] = [];
    private selectableRooms: Room[] = [];
    private selectablePredefinedPoints: PredefinedPoint[] = [];
    private coordinatesConverter?: CoordinatesConverter;
    private modes: MapMode[] = [];
    private shouldHandleMouseUp!: boolean;
    private lastHassUpdate!: Date;

    public set hass(hass: HomeAssistant) {
        const firstHass = !this._hass && hass;
        this._hass = hass;
        this.lastHassUpdate = new Date();
        if (firstHass) {
            this._firstHass();
        }
    }

    public get hass(): HomeAssistant {
        return this._hass;
    }

    public setConfig(config: XiaomiVacuumMapCardConfig): void {
        if (!config) {
            throw new Error(this._localize("common.invalid_configuration"));
        }
        this.config = config;
        if (isOldConfig(config)) {
            this.oldConfig = true;
            return;
        }
        this.configErrors = validateConfig(this.config);
        if (this.configErrors.length > 0) {
            return;
        }
        this.watchedEntities = getWatchedEntities(this.config);
        this._setPresetIndex(0, false, true);
        this.requestUpdate("config");
    }

    public getCardSize(): number {
        return 12;
    }

    private _getCurrentPreset(): CardPresetConfig {
        return this.currentPreset;
    }

    private _getCalibration(config: CardPresetConfig): CalibrationPoint[] | undefined {
        if (config.calibration_source.identity) {
            return [
                { map: { x: 0, y: 0 }, vacuum: { x: 0, y: 0 } },
                { map: { x: 1, y: 0 }, vacuum: { x: 1, y: 0 } },
                { map: { x: 0, y: 1 }, vacuum: { x: 0, y: 1 } },
            ];
        }
        if (
            config.calibration_source.calibration_points &&
            [3, 4].includes(config.calibration_source.calibration_points.length)
        ) {
            return config.calibration_source.calibration_points;
        }
        if (!this.hass) {
            return undefined;
        }
        if (config.calibration_source.entity && !config.calibration_source?.attribute) {
            return JSON.parse(this.hass.states[config.calibration_source.entity]?.state);
        }
        if (config.calibration_source.entity && config.calibration_source?.attribute) {
            return this.hass.states[config.calibration_source.entity]?.attributes[config.calibration_source.attribute];
        }
        if (config.calibration_source.camera) {
            return this.hass.states[config.map_source?.camera ?? ""]?.attributes["calibration_points"];
        }
        return undefined;
    }

    private _firstHass(): void {
        if (this.configErrors.length === 0 && !this.oldConfig) {
            const allPresets = this._getAllPresets();
            const allAvailablePresets = this._getAllAvailablePresets();
            const index = allPresets.indexOf(allAvailablePresets[0]);
            this._setPresetIndex(index, false, true);
        }
    }

    private _getAllPresets(): Array<CardPresetConfig> {
        return [this.config, ...(this.config.additional_presets ?? [])];
    }

    private _getAllAvailablePresets(): Array<CardPresetConfig> {
        const allPresets = this._getAllPresets();
        const available = allPresets.filter(p => (p.conditions?.length ?? 0) === 0 || areConditionsMet(p, this.hass));
        return available.length === 0 ? [allPresets[0]] : available;
    }

    private _getPreviousPresetIndex(): number {
        const allPresets = this._getAllPresets();
        const previousPresets = allPresets.filter(
            (p, i) => i < this.presetIndex && ((p.conditions?.length ?? 0) === 0 || areConditionsMet(p, this.hass)),
        );
        if (previousPresets.length == 0) return -1;
        return allPresets.indexOf(previousPresets[previousPresets.length - 1]);
    }

    private _getNextPresetIndex(): number {
        const allPresets = this._getAllPresets();
        const previousPresets = allPresets.filter(
            (p, i) => i > this.presetIndex && ((p.conditions?.length ?? 0) === 0 || areConditionsMet(p, this.hass)),
        );
        if (previousPresets.length == 0) return -1;
        return allPresets.indexOf(previousPresets[0]);
    }

    private _openPreviousPreset(): void {
        const index = this._getPreviousPresetIndex();
        if (index >= 0) {
            this._setPresetIndex(index, true);
        }
    }

    private _openNextPreset(): void {
        const index = this._getNextPresetIndex();
        if (index >= 0) {
            this._setPresetIndex(index, true);
        }
    }

    private _setPresetIndex(index: number, user = false, force = false): void {
        index = Math.min(Math.max(index, 0), this.config.additional_presets?.length ?? 0);
        if (index === this.presetIndex && !force) {
            return;
        }
        const config = index === 0 ? this.config : (this.config.additional_presets ?? [])[index - 1];
        if (!this.mapLocked) this._getPinchZoom()?.setTransform({ scale: 1, x: 0, y: 0, allowChangeEvent: true });
        if (user) {
            forwardHaptic("selection");
        }
        this.mapLocked = config?.map_locked ?? false;
        this.selectedMode = 0;
        this.realScale = 1;
        this.mapScale = 1;
        this.mapX = 0;
        this.mapY = 0;
        if (this.hass) this._updateCalibration(config);
        const vacuumPlatform = config.vacuum_platform ?? "default";
        this.modes = (
            (config.map_modes?.length ?? 0) === 0
                ? PlatformGenerator.generateDefaultModes(vacuumPlatform)
                : config.map_modes ?? []
        ).map(m => new MapMode(vacuumPlatform, m, this.config.language));

        this.presetIndex = index;
        this.currentPreset = config;
        const icons =
            (config.icons?.length ?? -1) === -1
                ? IconListGenerator.generate(this.hass, config.entity, this.config.language)
                : config.append_icons
                ? [
                      ...IconListGenerator.generate(this.hass, config.entity, this.config.language),
                      ...(config.icons ?? []),
                  ]
                : config.icons;
        const tilesGenerated: Promise<TileConfig[]> =
            (config.tiles?.length ?? -1) === -1
                ? TilesGenerator.generate(this.hass, config.entity, vacuumPlatform, this.config.language)
                : config.append_tiles
                ? TilesGenerator.generate(this.hass, config.entity, vacuumPlatform, this.config.language).then(
                      tiles => [...tiles, ...(config.tiles ?? [])],
                  )
                : new Promise(resolve => resolve(config.tiles ?? []));
        tilesGenerated
            .then(tiles => this._setPreset({ ...config, tiles: tiles, icons: icons }))
            .then(() => setTimeout(() => this.requestUpdate(), 100))
            .then(() => this._setCurrentMode(0, false));

        if (user && this.currentPreset.activate_on_switch) {
            this._executePresetsActivation();
        }
    }

    private _executePresetsActivation() {
        if (this.currentPreset.activate) {
            const schema = new ServiceCallSchema(this.currentPreset.activate);
            const serviceCall = schema.apply(this.currentPreset.entity, [], 0);
            this.hass
                .callService(serviceCall.domain, serviceCall.service, serviceCall.serviceData)
                .then(() => forwardHaptic("success"));
        }
    }

    private _setPreset(config: CardPresetConfig): void {
        this.currentPreset = config;
    }

    private _updateCalibration(config: CardPresetConfig): void {
        this.coordinatesConverter = undefined;
        const calibrationPoints = this._getCalibration(config);
        this.coordinatesConverter = new CoordinatesConverter(calibrationPoints);
    }

    private _getMapSrc(config: CardPresetConfig): string {
        if (config.map_source.camera) {
            if (
                this.connected &&
                this.lastHassUpdate &&
                this.lastHassUpdate.getTime() + DISCONNECTION_TIME >= new Date().getTime()
            ) {
                return `${this.hass.states[config.map_source.camera].attributes.entity_picture}&v=${+new Date()}`;
            }
            return DISCONNECTED_IMAGE;
        }
        if (config.map_source.image) {
            return `${config.map_source.image}`;
        }
        return DISCONNECTED_IMAGE;
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this.config) {
            return false;
        }
        return hasConfigOrAnyEntityChanged(this.watchedEntities, changedProps, false, this.hass);
    }

    protected render(): TemplateResult | void {
        if (this.oldConfig) {
            return this._showOldConfig();
        }
        if (this.configErrors.length > 0) {
            return this._showConfigErrors(this.configErrors);
        }
        const invalidEntities = areAllEntitiesDefined(this.watchedEntities, this.hass);
        if (invalidEntities.length > 0) {
            return this._showInvalidEntities(invalidEntities);
        }

        const rtl = getComputedStyle(this)?.getPropertyValue("direction") === "rtl";

        let preset = this._getCurrentPreset();
        const allPresets = this._getAllPresets();
        let availablePresets = this._getAllAvailablePresets();
        let availablePresetIndex = availablePresets.indexOf(allPresets[this.presetIndex]);
        if (availablePresetIndex === -1) {
            this._firstHass();
            preset = this._getCurrentPreset();
            availablePresets = this._getAllAvailablePresets();
            availablePresetIndex = availablePresets.indexOf(allPresets[this.presetIndex]);
        }
        this._updateCalibration(preset);

        const tiles = preset.tiles;
        const icons = preset.icons;
        const modes = this.modes;

        const mapSrc = this._getMapSrc(preset);
        const validCalibration = !!this.coordinatesConverter && this.coordinatesConverter.calibrated;
        const mapControls = validCalibration ? this._createMapControls() : [];

        const mapZoomerContent = html`
            <div
                id="map-zoomer-content"
                style="
                 margin-top: ${(preset.map_source.crop?.top ?? 0) * -1}px;
                 margin-bottom: ${(preset.map_source.crop?.bottom ?? 0) * -1}px;
                 margin-left: ${(preset.map_source.crop?.left ?? 0) * -1}px;
                 margin-right: ${(preset.map_source.crop?.right ?? 0) * -1}px;">
                <img
                    id="map-image"
                    alt="camera_image"
                    class="${this.mapScale * this.realScale > 1 ? "zoomed" : ""}"
                    src="${mapSrc}"
                    @load="${() => this._calculateBasicScale()}" />
                <div id="map-image-overlay">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        version="2.0"
                        id="svg-wrapper"
                        width="100%"
                        height="100%"
                        @mousedown="${(e: MouseEvent): void => this._mouseDown(e)}"
                        @mousemove="${(e: MouseEvent): void => this._mouseMove(e)}"
                        @mouseup="${(e: PointerEvent): void => this._mouseUp(e)}">
                        ${validCalibration ? this._drawSelection() : null}
                    </svg>
                </div>
            </div>
        `;
        return html`
            <ha-card style="--map-scale: ${this.mapScale}; --real-scale: ${this.realScale};">
                ${conditional(
                    (this.config.title ?? "").length > 0,
                    () => html`<h1 class="card-header">${this.config.title}</h1>`,
                )}
                ${conditional(
                    availablePresets.length > 1,
                    () => html`
                        <div class="preset-selector-wrapper">
                            <div
                                class="preset-selector-icon-wrapper"
                                @click="${(): void => this._openPreviousPreset()}">
                                <ha-icon
                                    icon="mdi:chevron-${rtl ? "right" : "left"}"
                                    class="preset-selector-icon ${this._getPreviousPresetIndex() === -1
                                        ? "disabled"
                                        : ""}">
                                </ha-icon>
                            </div>
                            <div
                                class="preset-label-wrapper ${preset.activate ? "clickable" : ""}"
                                @click="${(): void => this._executePresetsActivation()}">
                                <div class="preset-label">${preset.preset_name}</div>
                                <div class="preset-indicator">
                                    ${new Array(availablePresets.length)
                                        .fill(0)
                                        .map((_, i) => (i === availablePresetIndex ? "●" : "○"))}
                                </div>
                            </div>
                            <div class="preset-selector-icon-wrapper" @click="${(): void => this._openNextPreset()}">
                                <ha-icon
                                    icon="mdi:chevron-${rtl ? "left" : "right"}"
                                    class="preset-selector-icon ${this._getNextPresetIndex() === -1 ? "disabled" : ""}">
                                </ha-icon>
                            </div>
                        </div>
                    `,
                )}
                <div class="map-wrapper">
                    <pinch-zoom
                        min-scale="0.5"
                        id="map-zoomer"
                        @change="${this._calculateScale}"
                        two-finger-pan="${preset.two_finger_pan}"
                        locked="${this.mapLocked}"
                        style="touch-action: none;">
                        ${mapZoomerContent}
                    </pinch-zoom>
                    <div id="map-zoomer-overlay">
                        <div style="right: 0; top: 0; position: absolute;">
                            <ha-icon
                                icon="${this.mapLocked ? "mdi:lock" : "mdi:lock-open"}"
                                class="standalone-icon-on-map clickable ripple"
                                @click="${this._toggleLock}"></ha-icon>
                        </div>
                        <div class="map-zoom-icons" style="visibility: ${this.mapLocked ? "hidden" : "visible"}">
                            <ha-icon
                                icon="mdi:restore"
                                class="icon-on-map clickable ripple"
                                @click="${this._restoreMap}"></ha-icon>
                            <div class="map-zoom-icons-main">
                                <ha-icon
                                    icon="mdi:magnify-minus"
                                    class="icon-on-map clickable ripple"
                                    @click="${this._zoomOut}"></ha-icon>
                                <ha-icon
                                    icon="mdi:magnify-plus"
                                    class="icon-on-map clickable ripple"
                                    @click="${this._zoomIn}"></ha-icon>
                            </div>
                        </div>
                    </div>
                </div>
                ${conditional(!validCalibration, () => this._showInvalidCalibrationWarning())}
                <div class="controls-wrapper">
                    ${conditional(
                        validCalibration && (modes.length > 1 || mapControls.length > 0),
                        () => html`
                            <div class="map-controls-wrapper">
                                <div class="map-controls">
                                    ${conditional(modes.length > 1, () =>
                                        ModesMenuRenderer.render(modes, this.selectedMode, selected =>
                                            this._setCurrentMode(selected),
                                        ),
                                    )}
                                    ${conditional(
                                        mapControls.length > 0,
                                        () => html` <div class="map-actions-list">${mapControls}</div> `,
                                    )}
                                </div>
                            </div>
                        `,
                    )}
                    ${conditional(
                        (icons?.length ?? 0) !== 0,
                        () => html`
                            <div class="vacuum-controls">
                                <div class="vacuum-actions-list">
                                    ${icons
                                        ?.filter(icon => areConditionsMet(icon, this.hass))
                                        .map(icon => IconRenderer.render(icon, this))}
                                </div>
                            </div>
                        `,
                    )}
                    ${conditional(
                        (tiles?.length ?? 0) !== 0,
                        () => html`
                            <div class="tiles-wrapper">
                                ${tiles
                                    ?.filter(sensor => areConditionsMet(sensor, this.hass))
                                    .map(sensor => TileRenderer.render(sensor, this))}
                            </div>
                        `,
                    )}
                </div>
                ${ToastRenderer.render()}
            </ha-card>
        `;
    }

    private _createMapControls(): TemplateResult[] {
        const controls: TemplateResult[] = [];
        const currentMode = this._getCurrentMode();
        if (currentMode.selectionType === SelectionType.MANUAL_RECTANGLE) {
            controls.push(html`
                <paper-button class="map-actions-item clickable ripple" @click="${(): void => this._addRectangle()}">
                    <ha-icon icon="mdi:plus"></ha-icon>
                </paper-button>
            `);
        }
        if (currentMode.selectionType === SelectionType.MANUAL_PATH) {
            controls.push(html`
                <paper-button
                    class="map-actions-item clickable ripple"
                    @click="${(): void => {
                        this.selectedManualPath.removeLast();
                        forwardHaptic("selection");
                        this.requestUpdate();
                    }}">
                    <ha-icon icon="mdi:undo-variant"></ha-icon>
                </paper-button>
                <paper-button
                    class="map-actions-item clickable ripple"
                    @click="${(): void => {
                        this.selectedManualPath.clear();
                        forwardHaptic("selection");
                        this.requestUpdate();
                    }}">
                    <ha-icon icon="mdi:delete-empty"></ha-icon>
                </paper-button>
            `);
        }
        if (currentMode.repeatsType !== RepeatsType.NONE) {
            controls.push(html`
                <paper-button
                    class="map-actions-item clickable ripple"
                    @click="${(): void => {
                        this.repeats = (this.repeats % currentMode.maxRepeats) + 1;
                        forwardHaptic("selection");
                    }}">
                    <div>×${this.repeats}</div>
                </paper-button>
            `);
        }
        if (!currentMode.runImmediately) {
            controls.push(html`
                <paper-button
                    class="map-actions-item main clickable ripple"
                    @action="${this._handleRunAction()}"
                    .actionHandler="${actionHandler({
                        hasHold: true,
                        hasDoubleClick: true,
                    })}">
                    <ha-icon icon="mdi:play"></ha-icon>
                    <ha-icon
                        icon="${currentMode.icon}"
                        style="position: absolute; transform: scale(0.5) translate(15px, -20px)"></ha-icon>
                </paper-button>
            `);
        }

        return controls;
    }

    private _getContext(): Context {
        return new Context(
            () => this.mapScale,
            () => this.realScale,
            event => this._getMousePosition(event),
            () => this.requestUpdate(),
            () => this.coordinatesConverter,
            () => this.selectedManualRectangles,
            () => this.selectedPredefinedRectangles,
            () => this.selectedRooms,
            () => this.selectedPredefinedPoint,
            () => this._getCurrentMode().coordinatesRounding,
            () => this._getCurrentMode().maxSelections,
            property => this._getCssProperty(property),
            () => this._runImmediately(),
            string => this._localize(string),
        );
    }

    private _getMousePosition(event: MouseEvent | TouchEvent): MousePosition {
        return getMousePosition(event, this._getSvgWrapper(), this.mapScale);
    }

    private _setCurrentMode(newModeIndex: number, manual = true): void {
        const newMode = this.modes[newModeIndex];
        this.selectedManualRectangles = [];
        this.selectedManualPoint = undefined;
        this.selectedManualPath.clear();
        this.selectedPredefinedRectangles = [];
        this.selectedRooms = [];
        this.selectedPredefinedPoint = [];
        this.selectablePredefinedRectangles = [];
        this.selectableRooms = [];
        this.selectablePredefinedPoints = [];

        switch (newMode.selectionType) {
            case SelectionType.PREDEFINED_RECTANGLE:
                const zonesFromEntities = PredefinedMultiRectangle.getFromEntities(newMode, this.hass, () =>
                    this._getContext(),
                );
                const manualZones = newMode.predefinedSelections
                    .map(ps => ps as PredefinedZoneConfig)
                    .filter(pzc => typeof pzc.zones !== "string")
                    .map(pzc => new PredefinedMultiRectangle(pzc, this._getContext()));
                this.selectablePredefinedRectangles = zonesFromEntities.concat(manualZones);
                break;
            case SelectionType.ROOM:
                this.selectableRooms = newMode.predefinedSelections.map(
                    ps => new Room(ps as RoomConfig, this._getContext()),
                );
                break;
            case SelectionType.PREDEFINED_POINT:
                const pointsFromEntities = PredefinedPoint.getFromEntities(newMode, this.hass, () =>
                    this._getContext(),
                );
                const manualPoints = newMode.predefinedSelections
                    .map(ps => ps as PredefinedPointConfig)
                    .filter(ppc => typeof ppc.position !== "string")
                    .map(ppc => new PredefinedPoint(ppc, this._getContext()));
                this.selectablePredefinedPoints = pointsFromEntities.concat(manualPoints);
                break;
        }
        if (this.selectedMode != newModeIndex && manual) forwardHaptic("selection");
        this.selectedMode = newModeIndex;
    }

    private _getCurrentMode(): MapMode {
        return this.modes[this.selectedMode];
    }

    private _getSelection(mode: MapMode): unknown[] {
        const repeats = mode.repeatsType === RepeatsType.INTERNAL ? this.repeats : null;
        let selection: unknown[] = [];
        switch (mode.selectionType) {
            case SelectionType.MANUAL_RECTANGLE:
                selection = this.selectedManualRectangles.map(r => r.toVacuum(repeats));
                break;
            case SelectionType.PREDEFINED_RECTANGLE:
                selection = this.selectedPredefinedRectangles
                    .map(r => r.toVacuum(repeats))
                    .reduce((a, v) => a.concat(v), [] as unknown[]);
                break;
            case SelectionType.ROOM:
                const selectedRooms = this.selectedRooms.map(r => r.toVacuum());
                selection = [...selectedRooms, ...(repeats && selectedRooms.length > 0 ? [repeats] : [])];
                break;
            case SelectionType.MANUAL_PATH:
                selection = this.selectedManualPath.toVacuum(repeats);
                break;
            case SelectionType.MANUAL_POINT:
                selection = this.selectedManualPoint?.toVacuum(repeats) ?? [];
                break;
            case SelectionType.PREDEFINED_POINT:
                selection = this.selectedPredefinedPoint
                    .map(p => p.toVacuum(repeats))
                    .reduce((a, v) => a.concat(v), [] as unknown[]);
                break;
        }
        if (mode.repeatsType === RepeatsType.REPEAT) {
            selection = Array(this.repeats)
                .fill(0)
                .flatMap(() => selection);
        }
        return selection;
    }

    private _runImmediately(): boolean {
        if (this._getCurrentMode().runImmediately) {
            this._run(false);
            return true;
        }
        return false;
    }

    private _run(debug: boolean): void {
        const currentPreset = this._getCurrentPreset();
        const currentMode = this._getCurrentMode();
        const selection = this._getSelection(currentMode);
        if ((selection as any[]).length == 0) {
            this._showToast("popups.no_selection", "mdi:close", false);
            forwardHaptic("failure");
        } else {
            const repeats = this.repeats;
            const serviceCall = currentMode.getServiceCall(currentPreset.entity, selection, repeats);
            const message = JSON.stringify(serviceCall, null, 2);
            if (debug || (this.config.debug ?? false)) {
                this._showToast("popups.success", "mdi:check", true);
                console.log(message);
                window.alert(message);
                forwardHaptic("success");
            } else {
                this.hass.callService(serviceCall.domain, serviceCall.service, serviceCall.serviceData).then(
                    () => {
                        this._showToast("popups.success", "mdi:check", true);
                        forwardHaptic("success");
                    },
                    e => {
                        this._showToast("popups.failed", "mdi:close", false, e.message);
                        forwardHaptic("failure");
                    },
                );
            }
        }
        if (currentPreset.clean_selection_on_start ?? true) {
            this._setCurrentMode(this.selectedMode);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected updated(_changedProperties: PropertyValues): void {
        this._updateElements();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.connected = true;
        this._updateElements();
        this._delay(100).then(() => this.requestUpdate());
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.connected = false;
    }

    private _updateElements(): void {
        const s = this.shadowRoot
            ?.querySelector(".modes-dropdown-menu")
            ?.shadowRoot?.querySelector(".dropdown-content") as HTMLElement;
        if (s) {
            s.style.borderRadius = this._getCssProperty("--map-card-internal-big-radius");
        }
        this._delay(100).then(() => this._calculateBasicScale());
    }

    private _drawSelection(): SVGTemplateResult {
        switch (this._getCurrentMode().selectionType) {
            case SelectionType.MANUAL_RECTANGLE:
                return svg`${this.selectedManualRectangles.map(r => r.render())}`;
            case SelectionType.PREDEFINED_RECTANGLE:
                return svg`${this.selectablePredefinedRectangles.map(r => r.render())}`;
            case SelectionType.ROOM:
                return svg`${this.selectableRooms.map(r => r.render())}`;
            case SelectionType.MANUAL_PATH:
                return svg`${this.selectedManualPath?.render()}`;
            case SelectionType.MANUAL_POINT:
                return svg`${this.selectedManualPoint?.render()}`;
            case SelectionType.PREDEFINED_POINT:
                return svg`${this.selectablePredefinedPoints.map(p => p.render())}`;
        }
    }

    private _toggleLock(): void {
        this.mapLocked = !this.mapLocked;
        forwardHaptic("selection");
        this._delay(500).then(() => this.requestUpdate());
    }

    private _addRectangle(): void {
        const preset = this._getCurrentPreset();
        const marginTop = preset.map_source.crop?.top ?? 0;
        const marginBottom = preset.map_source.crop?.bottom ?? 0;
        const marginLeft = preset.map_source.crop?.left ?? 0;
        const marginRight = preset.map_source.crop?.right ?? 0;
        this._calculateBasicScale();
        if (this.selectedManualRectangles.length >= this._getCurrentMode().maxSelections) {
            forwardHaptic("failure");
            return;
        }
        const actualHeight = this.realImageHeight * this.realScale - marginTop - marginBottom;
        const actualWidth = this.realImageWidth * this.realScale - marginLeft - marginRight;
        const name = (this.selectedManualRectangles.length + 1).toString();
        const x = (actualWidth / 3 + marginLeft - this.mapX) / this.mapScale;
        const y = (actualHeight / 3 + marginTop - this.mapY) / this.mapScale;
        const width = actualWidth / 3 / this.mapScale;
        const height = actualHeight / 3 / this.mapScale;
        this.selectedManualRectangles.push(new ManualRectangle(x, y, width, height, name, this._getContext()));
        forwardHaptic("selection");
        this.requestUpdate();
    }

    private _mouseDown(event: PointerEvent | MouseEvent | TouchEvent): void {
        if (event instanceof MouseEvent && event.button != 0) {
            return;
        }
        this.shouldHandleMouseUp = true;
    }

    private _mouseMove(event: MouseEvent | TouchEvent): void {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        if ((<Element>event.target).classList.contains("draggable")) {
            return;
        }
        this.selectedManualRectangles.filter(r => r.isSelected()).forEach(r => r.externalDrag(event));
        this.shouldHandleMouseUp = false;
    }

    private _mouseUp(event: PointerEvent | MouseEvent | TouchEvent): void {
        if (!(event instanceof MouseEvent && event.button != 0) && this.shouldHandleMouseUp) {
            const { x, y } = getMousePosition(event, this._getSvgWrapper(), 1);
            switch (this._getCurrentMode().selectionType) {
                case SelectionType.MANUAL_PATH:
                    forwardHaptic("selection");
                    this.selectedManualPath.addPoint(x, y);
                    break;
                case SelectionType.MANUAL_POINT:
                    forwardHaptic("selection");
                    this.selectedManualPoint = new ManualPoint(x, y, this._getContext());
                    break;
                default:
                    return;
            }
            stopEvent(event);
            this.requestUpdate();
        }
        this.shouldHandleMouseUp = false;
    }

    private _handleRunAction(): (ev: ActionHandlerEvent) => void {
        return (ev: ActionHandlerEvent): void => {
            if (this.hass && ev.detail.action) {
                switch (ev.detail.action) {
                    case "tap":
                        this._run(false);
                        break;
                    case "hold":
                        this._run(true);
                        break;
                    case "double_tap":
                        console.log(
                            JSON.stringify(
                                {
                                    ...this._getCurrentPreset(),
                                    additional_presets: undefined,
                                    title: undefined,
                                    type: undefined,
                                },
                                null,
                                2,
                            ),
                        );
                        window.alert("Configuration available in browser's console");
                        forwardHaptic("success");
                        break;
                }
            }
        };
    }

    private _restoreMap(): void {
        const zoomerContent = this._getMapZoomerContent();
        zoomerContent.style.transitionDuration = this._getCssProperty("--map-card-internal-transitions-duration");
        this._getPinchZoom().setTransform({ scale: 1, x: 0, y: 0, allowChangeEvent: true });
        this.mapScale = 1;
        forwardHaptic("selection");
        this._delay(300).then(() => (zoomerContent.style.transitionDuration = "0s"));
    }

    private _getCssProperty(property: string): string {
        return getComputedStyle(this._getMapImage()).getPropertyValue(property);
    }

    private _zoomIn(): void {
        forwardHaptic("selection");
        this._updateScale(1.5);
    }

    private _zoomOut(): void {
        forwardHaptic("selection");
        this._updateScale(1 / 1.5);
    }

    private _updateScale(diff: number): void {
        const zoomerContent = this._getMapZoomerContent();
        const pinchZoom = this._getPinchZoom();
        const zoomerRect = this._getPinchZoom().getBoundingClientRect();
        this.mapScale = Math.max(this.mapScale * diff, 0.5);
        zoomerContent.style.transitionDuration = "200ms";
        pinchZoom.scaleTo(this.mapScale, {
            originX: zoomerRect.left + zoomerRect.width / 2,
            originY: zoomerRect.top + zoomerRect.height / 2,
            relativeTo: "container",
            allowChangeEvent: true,
        });
        this._delay(300).then(() => (zoomerContent.style.transitionDuration = "0s"));
    }

    private _calculateBasicScale(): void {
        const mapImage = this._getMapImage();
        if (mapImage && mapImage.naturalWidth > 0) {
            this.realImageWidth = mapImage.naturalWidth;
            this.realImageHeight = mapImage.naturalHeight;
            this.realScale = mapImage.width / mapImage.naturalWidth;
        }
    }

    private _calculateScale(): void {
        const pinchZoom = this._getPinchZoom();
        this.mapScale = pinchZoom.scale;
        this.mapX = pinchZoom.x;
        this.mapY = pinchZoom.y;
    }

    private _getPinchZoom(): PinchZoom {
        return this.shadowRoot?.getElementById("map-zoomer") as PinchZoom;
    }

    private _getMapImage(): HTMLImageElement {
        return this.shadowRoot?.getElementById("map-image") as HTMLImageElement;
    }

    private _getMapZoomerContent(): HTMLElement {
        return this.shadowRoot?.getElementById("map-zoomer-content") as HTMLElement;
    }

    private _getSvgWrapper(): SVGGraphicsElement {
        return this.shadowRoot?.querySelector("#svg-wrapper") as SVGGraphicsElement;
    }

    private _showConfigErrors(errors: string[]): TemplateResult {
        errors.forEach(e => console.error(e));
        const errorCard = document.createElement("hui-error-card") as LovelaceCard;
        errorCard.setConfig({
            type: "error",
            error: errors[0],
            origConfig: this.config,
        });

        return html` ${errorCard} `;
    }

    private _showOldConfig(): TemplateResult {
        return html`
            <hui-warning>
                <h1>Xiaomi Vacuum Map Card ${CARD_VERSION}</h1>
                <p>${this._localize("common.old_configuration")}</p>
                <p>
                    <a
                        href="https://github.com/PiotrMachowski/lovelace-xiaomi-vacuum-map-card#migrating-from-v1xx"
                        target="_blank"
                        >${this._localize("common.old_configuration_migration_link")}</a
                    >
                </p>
            </hui-warning>
        `;
    }

    private _showInvalidEntities(entities: string[]): TemplateResult {
        return html`
            <hui-warning>
                <h1>${this._localize("validation.invalid_entities")}</h1>
                <ul>
                    ${entities.map(
                        e => html` <li>
                            <pre>${e}</pre>
                        </li>`,
                    )}
                </ul>
            </hui-warning>
        `;
    }

    private _showInvalidCalibrationWarning(): TemplateResult {
        return html` <hui-warning>${this._localize("validation.invalid_calibration")}</hui-warning> `;
    }

    private _localize(ts: TranslatableString): string {
        return localizeWithHass(ts, this.hass, this.config);
    }

    private async _delay(ms: number): Promise<void> {
        await new Promise<void>(resolve => setTimeout(() => resolve(), ms));
    }

    private _showToast(text: string, icon: string, successful: boolean, additionalText = ""): void {
        const toast = this.shadowRoot?.getElementById("toast");
        const toastText = this.shadowRoot?.getElementById("toast-text");
        const toastIcon = this.shadowRoot?.getElementById("toast-icon");
        if (toast && toastText && toastIcon) {
            toast.className = "show";
            toastText.innerText = this._localize(text) + (additionalText ? `\n${additionalText}` : "");
            toastIcon.children[0].setAttribute("icon", icon);
            toastIcon.style.color = successful
                ? "var(--map-card-internal-toast-successful-icon-color)"
                : "var(--map-card-internal-toast-unsuccessful-icon-color)";
            this._delay(2000).then(() => (toast.className = toast.className.replace("show", "")));
        }
    }

    static get styles(): CSSResultGroup {
        return css`
            ha-card {
                overflow: hidden;
                display: flow-root;
                --map-card-internal-primary-color: var(--map-card-primary-color, var(--slider-color));
                --map-card-internal-primary-text-color: var(--map-card-primary-text-color, var(--primary-text-color));
                --map-card-internal-secondary-color: var(--map-card-secondary-color, var(--slider-secondary-color));
                --map-card-internal-secondary-text-color: var(
                    --map-card-secondary-text-color,
                    var(--text-light-primary-color)
                );
                --map-card-internal-tertiary-color: var(--map-card-tertiary-color, var(--secondary-background-color));
                --map-card-internal-tertiary-text-color: var(--map-card-tertiary-text-color, var(--primary-text-color));
                --map-card-internal-disabled-text-color: var(
                    --map-card-disabled-text-color,
                    var(--disabled-text-color)
                );
                --map-card-internal-zoomer-background: var(
                    --map-card-zoomer-background,
                    var(--map-card-internal-tertiary-color)
                );
                --map-card-internal-ripple-color: var(--map-card-ripple-color, #7a7f87);
                --map-card-internal-big-radius: var(--map-card-big-radius, 25px);
                --map-card-internal-small-radius: var(--map-card-small-radius, 18px);
                --map-card-internal-predefined-point-icon-wrapper-size: var(
                    --map-card-predefined-point-icon-wrapper-size,
                    36px
                );
                --map-card-internal-predefined-point-icon-size: var(--map-card-predefined-point-icon-size, 24px);
                --map-card-internal-predefined-point-icon-color: var(
                    --map-card-predefined-point-icon-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-predefined-point-icon-color-selected: var(
                    --map-card-predefined-point-icon-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-predefined-point-icon-background-color: var(
                    --map-card-predefined-point-icon-background-color,
                    var(--map-card-internal-secondary-color)
                );
                --map-card-internal-predefined-point-icon-background-color-selected: var(
                    --map-card-predefined-point-icon-background-color-selected,
                    var(--map-card-internal-primary-color)
                );
                --map-card-internal-predefined-point-label-color: var(
                    --map-card-predefined-point-label-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-predefined-point-label-color-selected: var(
                    --map-card-predefined-point-label-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-predefined-point-label-font-size: var(
                    --map-card-predefined-point-label-font-size,
                    12px
                );
                --map-card-internal-manual-point-radius: var(--map-card-manual-point-radius, 5px);
                --map-card-internal-manual-point-line-color: var(--map-card-manual-point-line-color, yellow);
                --map-card-internal-manual-point-fill-color: var(--map-card-manual-point-fill-color, transparent);
                --map-card-internal-manual-point-line-width: var(--map-card-manual-point-line-width, 1px);
                --map-card-internal-manual-path-point-radius: var(--map-card-manual-path-point-radius, 5px);
                --map-card-internal-manual-path-point-line-color: var(--map-card-manual-path-point-line-color, yellow);
                --map-card-internal-manual-path-point-fill-color: var(
                    --map-card-manual-path-point-fill-color,
                    transparent
                );
                --map-card-internal-manual-path-point-line-width: var(--map-card-manual-path-point-line-width, 1px);
                --map-card-internal-manual-path-line-color: var(--map-card-manual-path-line-color, yellow);
                --map-card-internal-manual-path-line-width: var(--map-card-manual-path-line-width, 1px);
                --map-card-internal-predefined-rectangle-line-width: var(
                    --map-card-predefined-rectangle-line-width,
                    1px
                );
                --map-card-internal-predefined-rectangle-line-color: var(
                    --map-card-predefined-rectangle-line-color,
                    white
                );
                --map-card-internal-predefined-rectangle-fill-color: var(
                    --map-card-predefined-rectangle-fill-color,
                    transparent
                );
                --map-card-internal-predefined-rectangle-line-color-selected: var(
                    --map-card-predefined-rectangle-line-color-selected,
                    white
                );
                --map-card-internal-predefined-rectangle-fill-color-selected: var(
                    --map-card-predefined-rectangle-fill-color-selected,
                    rgba(255, 255, 255, 0.2)
                );
                --map-card-internal-predefined-rectangle-line-segment-line: var(
                    --map-card-predefined-rectangle-line-segment-line,
                    10px
                );
                --map-card-internal-predefined-rectangle-line-segment-gap: var(
                    --map-card-predefined-rectangle-line-segment-gap,
                    5px
                );
                --map-card-internal-predefined-rectangle-icon-wrapper-size: var(
                    --map-card-predefined-rectangle-icon-wrapper-size,
                    36px
                );
                --map-card-internal-predefined-rectangle-icon-size: var(
                    --map-card-predefined-rectangle-icon-size,
                    24px
                );
                --map-card-internal-predefined-rectangle-icon-color: var(
                    --map-card-predefined-rectangle-icon-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-predefined-rectangle-icon-color-selected: var(
                    --map-card-predefined-rectangle-icon-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-predefined-rectangle-icon-background-color: var(
                    --map-card-predefined-rectangle-icon-background-color,
                    var(--map-card-internal-secondary-color)
                );
                --map-card-internal-predefined-rectangle-icon-background-color-selected: var(
                    --map-card-predefined-rectangle-icon-background-color-selected,
                    var(--map-card-internal-primary-color)
                );
                --map-card-internal-predefined-rectangle-label-color: var(
                    --map-card-predefined-rectangle-label-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-predefined-rectangle-label-color-selected: var(
                    --map-card-predefined-rectangle-label-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-predefined-rectangle-label-font-size: var(
                    --map-card-predefined-rectangle-label-font-size,
                    12px
                );
                --map-card-internal-manual-rectangle-line-width: var(--map-card-manual-rectangle-line-width, 1px);
                --map-card-internal-manual-rectangle-line-color: var(--map-card-manual-rectangle-line-color, white);
                --map-card-internal-manual-rectangle-fill-color: var(
                    --map-card-manual-rectangle-fill-color,
                    rgba(255, 255, 255, 0.2)
                );
                --map-card-internal-manual-rectangle-line-color-selected: var(
                    --map-card-manual-rectangle-line-color-selected,
                    white
                );
                --map-card-internal-manual-rectangle-fill-color-selected: var(
                    --map-card-manual-rectangle-fill-color-selected,
                    transparent
                );
                --map-card-internal-manual-rectangle-line-segment-line: var(
                    --map-card-manual-rectangle-line-segment-line,
                    10px
                );
                --map-card-internal-manual-rectangle-line-segment-gap: var(
                    --map-card-manual-rectangle-line-segment-gap,
                    5px
                );
                --map-card-internal-manual-rectangle-description-color: var(
                    --map-card-manual-rectangle-description-color,
                    white
                );
                --map-card-internal-manual-rectangle-description-font-size: var(
                    --map-card-manual-rectangle-description-font-size,
                    12px
                );
                --map-card-internal-manual-rectangle-description-offset-x: var(
                    --map-card-manual-rectangle-description-offset-x,
                    2px
                );
                --map-card-internal-manual-rectangle-description-offset-y: var(
                    --map-card-manual-rectangle-description-offset-y,
                    -8px
                );
                --map-card-internal-manual-rectangle-delete-circle-radius: var(
                    --map-card-manual-rectangle-delete-circle-radius,
                    13px
                );
                --map-card-internal-manual-rectangle-delete-circle-line-color: var(
                    --map-card-manual-rectangle-delete-circle-line-color,
                    white
                );
                --map-card-internal-manual-rectangle-delete-circle-fill-color: var(
                    --map-card-manual-rectangle-delete-circle-fill-color,
                    var(--map-card-internal-secondary-color)
                );
                --map-card-internal-manual-rectangle-delete-circle-line-color-selected: var(
                    --map-card-manual-rectangle-delete-circle-line-color-selected,
                    white
                );
                --map-card-internal-manual-rectangle-delete-circle-fill-color-selected: var(
                    --map-card-manual-rectangle-delete-circle-fill-color-selected,
                    var(--map-card-internal-primary-color)
                );
                --map-card-internal-manual-rectangle-delete-circle-line-width: var(
                    --map-card-manual-rectangle-delete-circle-line-width,
                    1px
                );
                --map-card-internal-manual-rectangle-delete-icon-color: var(
                    --map-card-manual-rectangle-delete-icon-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-manual-rectangle-delete-icon-color-selected: var(
                    --map-card-manual-rectangle-delete-icon-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-manual-rectangle-resize-circle-radius: var(
                    --map-card-manual-rectangle-resize-circle-radius,
                    13px
                );
                --map-card-internal-manual-rectangle-resize-circle-line-color: var(
                    --map-card-manual-rectangle-resize-circle-line-color,
                    white
                );
                --map-card-internal-manual-rectangle-resize-circle-fill-color: var(
                    --map-card-manual-rectangle-resize-circle-fill-color,
                    var(--map-card-internal-secondary-color)
                );
                --map-card-internal-manual-rectangle-resize-circle-line-color-selected: var(
                    --map-card-manual-rectangle-resize-circle-line-color-selected,
                    white
                );
                --map-card-internal-manual-rectangle-resize-circle-fill-color-selected: var(
                    --map-card-manual-rectangle-resize-circle-fill-color-selected,
                    var(--map-card-internal-primary-color)
                );
                --map-card-internal-manual-rectangle-resize-circle-line-width: var(
                    --map-card-manual-rectangle-resize-circle-line-width,
                    1px
                );
                --map-card-internal-manual-rectangle-resize-icon-color: var(
                    --map-card-manual-rectangle-resize-icon-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-manual-rectangle-resize-icon-color-selected: var(
                    --map-card-manual-rectangle-resize-icon-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-room-outline-line-color: var(--map-card-room-outline-line-color, white);
                --map-card-internal-room-outline-line-width: var(--map-card-room-outline-line-width, 1px);
                --map-card-internal-room-outline-line-segment-line: var(
                    --map-card-room-outline-line-segment-line,
                    10px
                );
                --map-card-internal-room-outline-line-segment-gap: var(--map-card-room-outline-line-segment-gap, 5px);
                --map-card-internal-room-outline-fill-color: var(--map-card-room-outline-fill-color, transparent);
                --map-card-internal-room-outline-line-color-selected: var(
                    --map-card-room-outline-line-color-selected,
                    white
                );
                --map-card-internal-room-outline-fill-color-selected: var(
                    --map-card-room-outline-fill-color-selected,
                    rgba(255, 255, 255, 0.3)
                );
                --map-card-internal-room-icon-wrapper-size: var(--map-card-room-icon-wrapper-size, 36px);
                --map-card-internal-room-icon-size: var(--map-card-room-icon-size, 24px);
                --map-card-internal-room-icon-color: var(
                    --map-card-room-icon-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-room-icon-color-selected: var(
                    --map-card-room-icon-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-room-icon-background-color: var(
                    --map-card-room-icon-background-color,
                    var(--map-card-internal-secondary-color)
                );
                --map-card-internal-room-icon-background-color-selected: var(
                    --map-card-room-icon-background-color-selected,
                    var(--map-card-internal-primary-color)
                );
                --map-card-internal-room-label-color: var(
                    --map-card-room-color,
                    var(--map-card-internal-secondary-text-color)
                );
                --map-card-internal-room-label-color-selected: var(
                    --map-card-room-label-color-selected,
                    var(--map-card-internal-primary-text-color)
                );
                --map-card-internal-room-label-font-size: var(--map-card-room-label-font-size, 12px);
                --map-card-internal-toast-successful-icon-color: var(
                    --map-card-toast-successful-icon-color,
                    rgb(0, 255, 0)
                );
                --map-card-internal-toast-unsuccessful-icon-color: var(
                    --map-card-toast-unsuccessful-icon-color,
                    rgb(255, 0, 0)
                );
                --map-card-internal-transitions-duration: var(--map-card-transitions-duration, 200ms);
            }

            .clickable {
                cursor: pointer;
            }

            .preset-selector-wrapper {
                width: 100%;
                display: inline-flex;
                align-content: center;
                justify-content: space-between;
                align-items: center;
            }

            .preset-selector-icon-wrapper {
                height: 44px;
                width: 44px;
                display: grid;
                place-items: center;
            }

            .preset-selector-icon {
                cursor: pointer;
            }

            .preset-selector-icon.disabled {
                color: var(--map-card-internal-disabled-text-color);
                cursor: default;
            }

            .preset-label-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .preset-indicator {
                line-height: 50%;
            }

            .map-wrapper {
                position: relative;
                height: max-content;
            }

            #map-zoomer {
                overflow: hidden;
                display: block;
                --scale: 1;
                --x: 0;
                --y: 0;
                background: var(--map-card-internal-zoomer-background);
            }

            #map-zoomer-content {
                transform: translate(var(--x), var(--y)) scale(var(--scale));
                transform-origin: 0 0;
                position: relative;
            }

            #map-image {
                width: 100%;
                margin-bottom: -6px;
            }

            #map-image.zoomed {
                image-rendering: pixelated;
            }

            #map-image-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }

            .standalone-icon-on-map {
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
                border-radius: var(--map-card-internal-small-radius);
                margin: 5px;
                width: 36px;
                height: 36px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .map-zoom-icons {
                right: 0;
                bottom: 0;
                position: absolute;
                display: inline-flex;
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
                border-radius: var(--map-card-internal-small-radius);
                margin: 5px;
                direction: ltr;
            }

            .map-zoom-icons-main {
                display: inline-flex;
                border-radius: var(--map-card-internal-small-radius);
                background-color: var(--map-card-internal-primary-color);
                color: var(--map-card-internal-primary-text-color);
            }

            .icon-on-map {
                touch-action: auto;
                pointer-events: auto;
                height: 36px;
                width: 36px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .controls-wrapper {
                margin: 15px;
            }

            .controls-wrapper > * {
                margin-top: 10px;
                margin-bottom: 10px;
            }

            .map-controls {
                width: 100%;
                display: inline-flex;
                gap: 10px;
                place-content: space-between;
                flex-wrap: wrap;
            }

            .map-actions-list {
                border-radius: var(--map-card-internal-big-radius);
                overflow: hidden;
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
                margin-inline-start: auto;
                display: inline-flex;
            }

            .map-actions-item.main {
                border-radius: var(--map-card-internal-big-radius);
                background-color: var(--map-card-internal-primary-color);
                color: var(--map-card-internal-primary-text-color);
            }

            .map-actions-item {
                width: 50px;
                height: 50px;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: transparent;
            }

            .vacuum-controls {
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .vacuum-actions-list {
                float: right;
                border-radius: var(--map-card-internal-big-radius);
                overflow: hidden;
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
            }

            .tiles-wrapper {
                display: flex;
                flex-wrap: wrap;
                justify-content: space-evenly;
                align-items: stretch;
                gap: 5px;
            }

            .ripple {
                position: relative;
                overflow: hidden;
                transform: translate3d(0, 0, 0);
            }

            .ripple:after {
                content: "";
                display: block;
                position: absolute;
                border-radius: 50%;
                width: 100%;
                height: 100%;
                top: 0;
                left: 0;
                pointer-events: none;
                background-image: radial-gradient(circle, var(--map-card-internal-ripple-color) 2%, transparent 10.01%);
                background-repeat: no-repeat;
                background-position: 50%;
                transform: scale(10, 10);
                opacity: 0;
                transition: transform 0.5s, opacity 1s;
            }

            .ripple:active:after {
                transform: scale(0, 0);
                opacity: 0.7;
                transition: 0s;
            }

            ${MapObject.styles}
            ${ManualRectangle.styles}
            ${PredefinedMultiRectangle.styles}
            ${ManualPath.styles}
            ${ManualPoint.styles}
            ${PredefinedPoint.styles}
            ${Room.styles}
            ${ModesMenuRenderer.styles}
            ${IconRenderer.styles}
            ${TileRenderer.styles}
            ${ToastRenderer.styles}
        `;
    }
}
