// noinspection CssUnresolvedCustomProperty

import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";
import { forwardHaptic } from "custom-card-helpers";

import { Context } from "./context";
import { MapObject } from "./map-object";
import { PredefinedZoneConfig, VariablesStorage, ZoneType, ZoneWithRepeatsType } from "../../types/types";
import { deleteFromArray } from "../../utils";
import { MapMode } from "../map_mode/map-mode";
import { HomeAssistantFixed } from "../../types/fixes";

export class PredefinedMultiRectangle extends MapObject {
    private readonly _config: PredefinedZoneConfig;
    private _selected: boolean;

    constructor(config: PredefinedZoneConfig, context: Context) {
        super(context);
        this._config = config;
        this._selected = false;
    }

    public get variables(): VariablesStorage {
        return this._config.variables ?? super.variables;
    }

    public static getFromEntities(
        newMode: MapMode,
        hass: HomeAssistantFixed,
        contextCreator: () => Context,
    ): PredefinedMultiRectangle[] {
        return newMode.predefinedSelections
            .map(ps => ps as PredefinedZoneConfig)
            .filter(pzc => typeof pzc.zones === "string")
            .map(pzc => (pzc.zones as string).split(".attributes."))
            .flatMap(z => {
                const entity = hass.states[z[0]];
                const value = z.length === 2 ? entity.attributes[z[1]] : entity.state;
                let parsed;
                try {
                    parsed = JSON.parse(value) as ZoneType[];
                } catch {
                    parsed = value as ZoneType[];
                }
                return parsed;
            })
            .map(
                z =>
                    new PredefinedMultiRectangle(
                        {
                            zones: [z],
                            label: undefined,
                            icon: {
                                x: (z[0] + z[2]) / 2,
                                y: (z[1] + z[3]) / 2,
                                name: "mdi:broom",
                            },
                        },
                        contextCreator(),
                    ),
            );
    }

    public render(): SVGTemplateResult {
        let zones: ZoneType[] = [];
        if (typeof this._config.zones !== "string") {
            zones = this._config.zones;
        }
        const mappedRectangles = zones.map(z => this.vacuumToMapRect(z)[0]);
        return svg`
            <g class="predefined-rectangle-wrapper ${this._selected ? "selected" : ""}">
                ${mappedRectangles.map(
                    r => svg`
                    <polygon class="predefined-rectangle clickable"
                             points="${r.map(p => p.join(", ")).join(" ")}"
                             @click="${async (): Promise<void> => this._click()}">
                    </polygon>
                `,
                )}
                ${this.renderIcon(this._config.icon, () => this._click(), "predefined-rectangle-icon-wrapper")}
                ${this.renderLabel(this._config.label, "predefined-rectangle-label")}
            </g>
        `;
    }

    public size(): number {
        return this._config.zones.length;
    }

    public toVacuum(repeats: number | null): ZoneType[] | ZoneWithRepeatsType[] {
        if (typeof this._config.zones === "string") {
            return [];
        }
        if (repeats === null) return this._config.zones;
        return this._config.zones.map(z => [...z, repeats]);
    }

    private async _click(): Promise<void> {
        if (
            !this._selected &&
            this._context
                .selectedPredefinedRectangles()
                .map(r => r.size())
                .reduce((s, c) => s + c, 0) +
                this.size() >
                this._context.maxSelections()
        ) {
            forwardHaptic("failure");
            return;
        }
        this._selected = !this._selected;
        if (this._selected) {
            this._context.selectedPredefinedRectangles().push(this);
        } else {
            deleteFromArray(this._context.selectedPredefinedRectangles(), this);
        }
        if (await this._context.runImmediately()) {
            this._selected = false;
            deleteFromArray(this._context.selectedPredefinedRectangles(), this);
            return;
        }
        forwardHaptic("selection");
        this.update();
    }

    public static get styles(): CSSResultGroup {
        return css`
            .predefined-rectangle-wrapper {
            }

            .predefined-rectangle-wrapper.selected {
            }

            .predefined-rectangle {
                width: var(--width);
                height: var(--height);
                x: var(--x);
                y: var(--y);
                stroke: var(--map-card-internal-predefined-rectangle-line-color);
                stroke-linejoin: round;
                stroke-dasharray: calc(
                        var(--map-card-internal-predefined-rectangle-line-segment-line) / var(--map-scale)
                    ),
                    calc(var(--map-card-internal-predefined-rectangle-line-segment-gap) / var(--map-scale));
                fill: var(--map-card-internal-predefined-rectangle-fill-color);
                stroke-width: calc(var(--map-card-internal-predefined-rectangle-line-width) / var(--map-scale));
                transition: stroke var(--map-card-internal-transitions-duration) ease,
                    fill var(--map-card-internal-transitions-duration) ease;
            }

            .predefined-rectangle-icon-wrapper {
                x: var(--x-icon);
                y: var(--y-icon);
                height: var(--map-card-internal-predefined-rectangle-icon-wrapper-size);
                width: var(--map-card-internal-predefined-rectangle-icon-wrapper-size);
                border-radius: var(--map-card-internal-small-radius);
                transform-box: fill-box;
                transform: translate(
                        calc(var(--map-card-internal-predefined-rectangle-icon-wrapper-size) / -2),
                        calc(var(--map-card-internal-predefined-rectangle-icon-wrapper-size) / -2)
                    )
                    scale(calc(1 / var(--map-scale)));
                background: var(--map-card-internal-predefined-rectangle-icon-background-color);
                color: var(--map-card-internal-predefined-rectangle-icon-color);
                --mdc-icon-size: var(--map-card-internal-predefined-rectangle-icon-size);
                transition: color var(--map-card-internal-transitions-duration) ease,
                    background var(--map-card-internal-transitions-duration) ease;
            }

            .predefined-rectangle-label {
                text-anchor: middle;
                dominant-baseline: middle;
                pointer-events: none;
                font-size: calc(var(--map-card-internal-predefined-rectangle-label-font-size) / var(--map-scale));
                fill: var(--map-card-internal-predefined-rectangle-label-color);
                transition: color var(--map-card-internal-transitions-duration) ease,
                    background var(--map-card-internal-transitions-duration) ease;
            }

            .predefined-rectangle-wrapper.selected > .predefined-rectangle {
                stroke: var(--map-card-internal-predefined-rectangle-line-color-selected);
                fill: var(--map-card-internal-predefined-rectangle-fill-color-selected);
            }

            .predefined-rectangle-wrapper.selected > * > .predefined-rectangle-icon-wrapper {
                background: var(--map-card-internal-predefined-rectangle-icon-background-color-selected);
                color: var(--map-card-internal-predefined-rectangle-icon-color-selected);
            }

            .predefined-rectangle-wrapper.selected > .predefined-rectangle-label {
                fill: var(--map-card-internal-predefined-rectangle-label-color-selected);
            }
        `;
    }
}
