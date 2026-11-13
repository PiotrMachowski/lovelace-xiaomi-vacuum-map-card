// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, html, svg, SVGTemplateResult } from "lit";
import { forwardHaptic } from "custom-card-helpers";

import { Context } from "./context";
import { deleteFromArray } from "../../utils";
import { LabelConfig, RoomConfig } from "../../types/types";
import {PredefinedMapObject} from "./predefined-map-object";

/**
 * Distance in CSS pixels between a room's label and the cleaning-order badge drawn above it when
 * the room has no icon. It clears the label's own text and stays inside small room outlines.
 */
const ORDER_BADGE_LABEL_OFFSET = 20;

export interface RoomRenderOptions {
    readonly imageOutline?: Array<[number, number]>;
    readonly selected?: boolean;
}

export class Room extends PredefinedMapObject {
    private readonly _config: RoomConfig;
    private readonly _imageOutline?: Array<[number, number]>;

    constructor(config: RoomConfig, context: Context, options: RoomRenderOptions = {}) {
        super(config, context);
        this._config = config;
        this._imageOutline = options.imageOutline;
        if (options.selected !== undefined && !config.state_entity) this._selected = options.selected;
    }

    public render(): SVGTemplateResult {
        const poly = this._imageOutline
            ? this._imageOutline.map(p => this.realScaled2Point(p))
            : (this._config?.outline ?? []).map(p => this.vacuumToScaledMap(p[0], p[1]));
        // Rooms are sent in click order, so a selected room shows its position in that order.
        const order = this._selected ? this._context.selectedRooms().indexOf(this) + 1 : 0;
        const iconContent = order > 0 ? html`<span class="room-order">${order}</span>` : undefined;
        return svg`
            <g class="room-wrapper ${this._selected ? "selected" : ""} 
            room-${`${this._config.id}`.replace(/[^a-zA-Z0-9_\-]/gm, "_")}-wrapper">
                <polygon class="room-outline ${this._imageOutline ? "" : "clickable"}"
                         points="${poly.map(p => p.join(", ")).join(" ")}"
                         @click="${this._imageOutline ? undefined : async (): Promise<void> => this.click()}">
                </polygon>
                ${this.renderIcon(this._config.icon, () => this.click(), "room-icon-wrapper", iconContent)}
                ${this.renderOrderBadge(order)}
                ${this.renderLabel(this._config.label, "room-label", this._config.icon)}
            </g>
        `;
    }

    /**
     * The order badge for a selected room that has no icon. Upstream draws the number in the icon
     * slot, but rooms detected from the map colours carry no icon, so for them the number is drawn
     * above the room label instead of being dropped. A room with an icon keeps the upstream
     * behaviour: the number replaces the icon.
     */
    private renderOrderBadge(order: number): SVGTemplateResult {
        if (order <= 0 || this._config.icon) return svg``;
        const anchor = this._config.label ?? this._outlineCenter();
        if (!anchor) return svg``;
        return this.renderLabel(
            { ...anchor, text: `${order}`, offset_y: (anchor.offset_y ?? 0) - ORDER_BADGE_LABEL_OFFSET },
            "room-order",
        );
    }

    /** Centres the badge on the room when a configured room has neither an icon nor a label. */
    private _outlineCenter(): LabelConfig | undefined {
        const outline = this._config.outline;
        if (!outline?.length) return undefined;
        const sum = outline.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0]);
        return { text: "", x: sum[0] / outline.length, y: sum[1] / outline.length };
    }

    public toVacuum(): number | string {
        return this._config.id;
    }

    public async click(): Promise<void> {
        if (!this._selected && this._context.selectedRooms().length >= this._context.maxSelections()) {
            forwardHaptic("failure");
            return;
        }
        this._toggleSelected();
        if (this._selected) {
            this._context.selectedRooms().push(this);
        } else {
            deleteFromArray(this._context.selectedRooms(), this);
        }
        this._context.selectionChanged();
        if (await this._context.runImmediately()) {
            this._selected = false;
            deleteFromArray(this._context.selectedRooms(), this);
            this._context.selectionChanged();
            return;
        }
        forwardHaptic("selection");
        this.update();
    }

    public static get styles(): CSSResultGroup {
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
                height: var(--map-card-internal-room-icon-wrapper-size);
                width: var(--map-card-internal-room-icon-wrapper-size);
                border-radius: var(--map-card-internal-small-radius);
                transform-box: fill-box;
                overflow: hidden;
                transform: translate(
                        calc(var(--map-card-internal-room-icon-wrapper-size) / -2),
                        calc(var(--map-card-internal-room-icon-wrapper-size) / -2)
                    )
                    scale(calc(1 / var(--map-scale)))
                    rotate(calc(-1 * var(--map-rotation, 0deg)));
                background: var(--map-card-internal-room-icon-background-color);
                color: var(--map-card-internal-room-icon-color);
                --mdc-icon-size: var(--map-card-internal-room-icon-size);
                transition: color var(--map-card-internal-transitions-duration) ease,
                    background var(--map-card-internal-transitions-duration) ease;
            }

            .room-order {
                font-size: calc(var(--map-card-internal-room-icon-size) * 0.75);
                font-weight: bold;
                line-height: 1;
            }

            /* A badge drawn above an icon-less room's label reuses .label-text, so it already inherits
               the label's centring, size scaling and counter-rotation. Only the weight, a size that
               stands out from the room name and the click-through are added here: the room outline
               underneath the badge stays clickable. */
            text.room-order {
                font-size: calc(var(--map-card-internal-room-label-font-size) * 1.4 / var(--map-scale));
                font-weight: 700;
                pointer-events: none;
            }

            .room-label {
                text-anchor: middle;
                dominant-baseline: middle;
                pointer-events: none;
                font-size: calc(var(--map-card-internal-room-label-font-size) / var(--map-scale));
                font-weight: 600;
                fill: var(--map-card-internal-room-label-color);
                stroke: var(--map-card-internal-room-label-outline-color);
                stroke-width: calc(var(--map-card-internal-room-label-outline-width) / var(--map-scale));
                stroke-linejoin: round;
                paint-order: stroke fill;
                transition: fill var(--map-card-internal-transitions-duration) ease;
            }

            .room-wrapper.selected > .room-outline {
                stroke: var(--map-card-internal-room-outline-line-color-selected);
                fill: var(--map-card-internal-room-outline-fill-color-selected);
            }

            .room-wrapper.selected > * > .room-icon-wrapper {
                background: var(--map-card-internal-room-icon-background-color-selected);
                color: var(--map-card-internal-room-icon-color-selected);
            }

            .room-wrapper.selected > .room-label {
                fill: var(--map-card-internal-room-label-color-selected);
            }

            .room-wrapper.selected > text.room-order {
                fill: var(--map-card-internal-room-label-color-selected);
            }
        `;
    }
}
