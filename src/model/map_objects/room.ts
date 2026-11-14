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
    /** The configured id is absent from the live camera metadata (issue #928). */
    readonly stale?: boolean;
}

export class Room extends PredefinedMapObject {
    private readonly _config: RoomConfig;
    private readonly _imageOutline?: Array<[number, number]>;
    private readonly _stale: boolean;

    constructor(config: RoomConfig, context: Context, options: RoomRenderOptions = {}) {
        super(config, context);
        this._config = config;
        this._imageOutline = options.imageOutline;
        this._stale = options.stale === true;
        // A stale room exists only to show which configured id no longer matches the map. It must
        // never be selected, including through `default_state` or a state entity, or a service
        // call would clean a room id the camera no longer reports (issue #928).
        if (this._stale) {
            this._selected = false;
        } else if (options.selected !== undefined && !config.state_entity) {
            this._selected = options.selected;
        }
    }

    /** True when the configured id is absent from the live camera metadata. */
    public get stale(): boolean {
        return this._stale;
    }

    public render(): SVGTemplateResult {
        const poly = this._imageOutline
            ? this._imageOutline.map(p => this.realScaled2Point(p))
            : (this._config?.outline ?? []).map(p => this.vacuumToScaledMap(p[0], p[1]));
        // Rooms are sent in click order, so a selected room shows its position in that order. Once
        // a run has started and the selection is cleared, the rooms of that run look exactly as they
        // did when selected, numbers included, until the vacuum is done. Rooms are locked meanwhile
        // (see `click`), so the two sources never mix.
        const runOrder = this._selected ? 0 : this._context.activeRoomOrder().indexOf(String(this._config.id)) + 1;
        const order = this._selected ? this._context.selectedRooms().indexOf(this) + 1 : runOrder;
        const highlighted = this._selected || runOrder > 0;
        const iconContent = order > 0 ? html`<span class="room-order">${order}</span>` : undefined;
        return svg`
            <g class="room-wrapper ${highlighted ? "selected" : ""} ${runOrder > 0 ? "running" : ""} ${this._stale ? "room-stale" : ""}
            room-${`${this._config.id}`.replace(/[^a-zA-Z0-9_\-]/gm, "_")}-wrapper">
                <polygon class="room-outline ${this._imageOutline || this._stale ? "" : "clickable"}"
                         points="${poly.map(p => p.join(", ")).join(" ")}"
                         @click="${this._imageOutline || this._stale
                             ? undefined
                             : async (): Promise<void> => this.click()}">
                </polygon>
                ${this.renderIcon(this._config.icon, () => this.click(), "room-icon-wrapper", iconContent, !this._stale)}
                ${this.renderOrderBadge(order)}
                ${this.renderStaleMarker()}
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

    /**
     * A configured room whose id is no longer in the camera metadata. The room is drawn from its
     * stored outline and marked with an exclamation mark above the label; the card's warning names
     * the ids. It is never clickable or selected (issue #928).
     */
    private renderStaleMarker(): SVGTemplateResult {
        if (!this._stale) return svg``;
        const anchor = this._config.label ?? this._outlineCenter();
        if (!anchor) return svg``;
        return this.renderLabel(
            { ...anchor, text: "!", offset_y: (anchor.offset_y ?? 0) - ORDER_BADGE_LABEL_OFFSET },
            "room-stale-marker",
        );
    }

    /**
     * An anchor for the badge of a configured room that has neither an icon nor a label: the average
     * of the outline's vertices, which is close to the middle of the convex outlines a configured
     * room has. It is not a true centroid, and the caller still lifts the badge
     * ORDER_BADGE_LABEL_OFFSET above this point, exactly as it lifts it above a label.
     */
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
        // A stale room is a warning, not a target: its id is absent from the live camera metadata.
        if (this._stale) return;
        // While a started run is in progress the map shows its order, and the rooms are locked so
        // that order cannot be changed or mixed with a new selection until the vacuum is done.
        if (this._context.activeRoomOrder().length > 0) {
            forwardHaptic("failure");
            return;
        }
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

            /* A badge drawn above an icon-less room's label reuses .label-text, which supplies the
               counter-rotation and the offset. Centring and the outline belong to .room-label, not to
               .label-text, so they are repeated here: without them a single digit sits several pixels
               right of the room centre, and the number is unreadable on a light room. The badge is
               heavier and larger than the room name, and it ignores pointer events so the outline
               underneath stays clickable. */
            text.room-order {
                font-size: calc(var(--map-card-internal-room-label-font-size) * 1.4 / var(--map-scale));
                font-weight: 700;
                text-anchor: middle;
                dominant-baseline: middle;
                stroke: var(--map-card-internal-room-label-outline-color);
                stroke-width: calc(var(--map-card-internal-room-label-outline-width) / var(--map-scale));
                stroke-linejoin: round;
                paint-order: stroke fill;
                pointer-events: none;
            }

            /* A configured room whose id is no longer in the camera metadata. The marker reuses
               .label-text for its counter-rotation and offset, and repeats the centring the room
               label gets from .room-label. */
            text.room-stale-marker {
                font-size: calc(var(--map-card-internal-room-label-font-size) * 1.4 / var(--map-scale));
                font-weight: 700;
                text-anchor: middle;
                dominant-baseline: middle;
                fill: var(--map-card-internal-room-label-color-stale, var(--error-color, #db4437));
                stroke: var(--map-card-internal-room-label-outline-color);
                stroke-width: calc(var(--map-card-internal-room-label-outline-width) / var(--map-scale));
                stroke-linejoin: round;
                paint-order: stroke fill;
                pointer-events: none;
            }

            .room-wrapper.room-stale > .room-outline {
                stroke: var(--map-card-internal-room-outline-line-color-stale, var(--error-color, #db4437));
                fill: var(--map-card-internal-room-outline-fill-color-stale, rgba(219, 68, 55, 0.12));
            }

            /* A stale room is a warning, not a hit target. After an id shift its stored outline can
               cover a live room with the same geometry, and its fill would swallow the click meant
               for the room underneath. The pointer-events property inherits, so the outline, label and
               marker are all transparent; the icon's own pointer-events: auto rule in .map-icon-wrapper
               needs the more specific rule below to be covered too. */
            .room-wrapper.room-stale,
            .room-wrapper.room-stale .map-icon-wrapper {
                pointer-events: none;
            }

            .room-wrapper.room-stale > .room-label {
                fill: var(--map-card-internal-room-label-color-stale, var(--error-color, #db4437));
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
