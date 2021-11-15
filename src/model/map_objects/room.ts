// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";
import { forwardHaptic } from "custom-card-helpers";

import { Context } from "./context";
import { MapObject } from "./map-object";
import { deleteFromArray } from "../../utils";
import { RoomConfig } from "../../types/types";

export class Room extends MapObject {
    private _selected: boolean;
    private readonly _config: RoomConfig;

    constructor(config: RoomConfig, context: Context) {
        super(context);
        this._config = config;
        this._selected = false;
    }

    public render(): SVGTemplateResult {
        const poly = (this._config?.outline ?? []).map(p => this.vacuumToScaledMap(p[0], p[1]));
        return svg`
            <g class="room-wrapper ${this._selected ? "selected" : ""} room-${this._config.id}-wrapper">
                <polygon class="room-outline"
                         points="${poly.map(p => p.join(", ")).join(" ")}"
                         @click="${(): void => this._click()}">
                </polygon>
                ${this.renderIcon(this._config.icon, () => this._click(), "room-icon-wrapper")}
                ${this.renderLabel(this._config.label, "room-label")}
            </g>
        `;
    }

    public toVacuum(): number | string {
        return this._config.id;
    }

    private _click(): void {
        if (!this._selected && this._context.selectedRooms().length >= this._context.maxSelections()) {
            forwardHaptic("failure");
            return;
        }
        this._selected = !this._selected;
        if (this._selected) {
            this._context.selectedRooms().push(this);
        } else {
            deleteFromArray(this._context.selectedRooms(), this);
        }
        if (this._context.runImmediately()) {
            this._selected = false;
            deleteFromArray(this._context.selectedRooms(), this);
            return;
        }
        forwardHaptic("selection");
        this.update();
    }

    static get styles(): CSSResultGroup {
        return css`
            .room-wrapper {
            }

            .room-outline {
                stroke: var(--map-card-internal-room-outline-line-color);
                stroke-width: calc(var(--map-card-internal-room-outline-line-width) / var(--map-scale));
                fill: var(--map-card-internal-room-outline-fill-color);
                stroke-linejoin: round;
                stroke-dasharray: calc(var(--map-card-internal-room-outline-line-segment-line) / var(--map-scale)),
                    calc(var(--map-card-internal-room-outline-line-segment-gap) / var(--map-scale));
                transition: stroke var(--map-card-internal-transitions-duration) ease,
                    fill var(--map-card-internal-transitions-duration) ease;
            }

            .room-icon-wrapper {
                x: var(--x-icon);
                y: var(--y-icon);
                height: var(--map-card-internal-room-icon-size);
                width: var(--map-card-internal-room-icon-size);
                border-radius: calc(var(--map-card-internal-room-icon-size) / 2);
                transform-box: fill-box;
                transform: scale(calc(1 / var(--map-scale)))
                    translate(
                        calc(var(--map-card-internal-room-icon-size) / -2),
                        calc(var(--map-card-internal-room-icon-size) / -2)
                    );
                background: var(--map-card-internal-room-icon-background-color);
                color: var(--map-card-internal-room-icon-color);
                padding: var(--map-card-internal-room-icon-padding);
                --mdc-icon-size: calc(
                    var(--map-card-internal-room-icon-size) - var(--map-card-internal-room-icon-padding) * 2
                );
                transition: color var(--map-card-internal-transitions-duration) ease,
                    background var(--map-card-internal-transitions-duration) ease;
            }

            .room-label {
                text-anchor: middle;
                dominant-baseline: middle;
                pointer-events: none;
                transform: translate(
                    calc(var(--offset-x) / var(--map-scale)),
                    calc(var(--offset-y) / var(--map-scale))
                );
                font-size: calc(var(--map-card-internal-room-label-font-size) / var(--map-scale));
                fill: var(--map-card-internal-room-label-color);
                transition: color var(--map-card-internal-transitions-duration) ease,
                    background var(--map-card-internal-transitions-duration) ease;
            }

            .room-wrapper.selected > .room-outline {
                stroke: var(--map-card-internal-room-outline-line-color-selected);
                fill: var(--map-card-internal-room-outline-fill-color-selected);
            }

            .room-wrapper.selected > .room-icon-wrapper {
                background: var(--map-card-internal-room-icon-background-color-selected);
                color: var(--map-card-internal-room-icon-color-selected);
            }

            .room-wrapper.selected > .room-label {
                fill: var(--map-card-internal-room-label-color-selected);
            }
        `;
    }
}
