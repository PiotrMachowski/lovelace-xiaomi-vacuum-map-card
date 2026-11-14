import { css } from "lit";
import { ManualRectangle } from "../model/map_objects/manual-rectangle";
import { ManualPoint } from "../model/map_objects/manual-point";
import { ManualPath } from "../model/map_objects/manual-path";
import { PredefinedPoint } from "../model/map_objects/predefined-point";
import { PredefinedMultiRectangle } from "../model/map_objects/predefined-multi-rectangle";
import { Room } from "../model/map_objects/room";
import { ToastRenderer } from "../renderers/toast-renderer";
import { MapObject } from "../model/map_objects/map-object";
import { DropdownMenu } from "../components/dropdown-menu";
import { TilesWrapper } from "../components/tiles-wrapper";
import { IconsWrapper } from "../components/icons-wrapper";
import { PresetSelector } from "../components/preset-selector";

export const cardStyles = css`
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
            /* The map viewport follows the card surface, so transparent map pixels blend into
               the card in both themes instead of revealing Home Assistant's secondary grey. */
            --map-card-internal-zoomer-background: var(--map-card-zoomer-background, transparent);
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
                --map-card-room-label-color,
                #fff
            );
            --map-card-internal-room-label-color-selected: var(
                --map-card-room-label-color-selected,
                #fff
            );
            --map-card-internal-room-label-font-size: var(--map-card-room-label-font-size, 12px);
            --map-card-internal-room-label-outline-color: var(
                --map-card-room-label-outline-color,
                rgba(0, 0, 0, 0.95)
            );
            --map-card-internal-room-label-outline-width: var(--map-card-room-label-outline-width, 2px);
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

        /*
         * Sections view: hui-card sets layout = "grid" and the cell has the height the section
         * gives it - content-sized for the default rows: "auto", or fixed when the user picks
         * a row count. Fill that cell instead of letting the content overflow into the next
         * card, and scroll inside the card when the map and controls need more height than the
         * cell allows (issue #943). In an auto-height cell height:100% resolves against the
         * content height, so a vertical card renders exactly as it did before this rule.
         */
        :host([layout="grid"]) {
            display: block;
            height: 100%;
        }

        :host([layout="grid"]) ha-card {
            height: 100%;
            overflow-y: auto;
        }

        /*
         * Horizontal arrangement (issue #183): the map keeps the flexible first column and the
         * controls get a clamped second column. minmax(0, 1fr) lets the map shrink below its
         * intrinsic width instead of forcing the card wider, and the controls column scrolls
         * internally instead of growing the card. The wrapper only exists in this layout, so
         * the vertical arrangement keeps its upstream DOM and pixels.
         */
        .layout-content.horizontal {
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(180px, 38%, 360px);
            align-items: stretch;
            min-width: 0;
        }

        .layout-content.horizontal > .map-wrapper {
            grid-column: 1;
            grid-row: 1;
            min-width: 0;
        }

        .layout-content.horizontal > .controls-column {
            grid-column: 2;
            grid-row: 1;
            position: relative;
            min-width: 0;
        }

        /* Absolute so a long control list cannot set the row height: the map does, and the
           controls scroll within the same rows instead of making the card taller. */
        .layout-content.horizontal > .controls-column > .controls-wrapper {
            position: absolute;
            inset: 0;
            margin: 15px;
            overflow-x: hidden;
            overflow-y: auto;
            overscroll-behavior: contain;
        }

        .layout-content.horizontal > .room-config-warning {
            grid-column: 1 / -1;
            grid-row: 2;
        }

        /* A narrow controls column has to wrap its action buttons, and a long mode name must
           ellipsize instead of widening (and clipping) the column. */
        .layout-content.horizontal .map-actions-list {
            flex-wrap: wrap;
            height: auto;
            justify-content: center;
            margin-inline-start: 0;
        }

        .layout-content.horizontal .map-controls {
            justify-content: center;
        }

        /*
         * A long mode name must ellipsize inside the controls column instead of widening the
         * dropdown and having the column's overflow-x: hidden clip the mode icon. The chain
         * from the flex item down to the text has to be allowed to shrink at every level:
         * xvmc-dropdown-menu and ha-dropdown are block boxes clamped to the column, the button
         * is the flex row, the text is the one shrinkable child and the icon keeps its size.
         * max-width: 100% on the button alone was measured against those content-sized
         * parents, so the button stayed as wide as its text and nothing ellipsized.
         */
        .layout-content.horizontal .map-controls > xvmc-dropdown-menu,
        .layout-content.horizontal .dropdown-menu {
            display: block;
            min-width: 0;
            max-width: 100%;
        }

        .layout-content.horizontal .dropdown-menu-button {
            display: flex;
            min-width: 0;
            max-width: 100%;
        }

        .layout-content.horizontal .dropdown-menu-button-text {
            /* text-overflow only renders on a block container; the shared rule is inline-flex. */
            display: block;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .layout-content.horizontal .dropdown-menu-button-button {
            flex-shrink: 0;
        }

        .clickable {
            cursor: pointer;
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
            /* the last three functions rotate the map around its own middle, inside the pan/zoom */
            transform: translate(var(--x), var(--y)) scale(var(--scale)) translate(50%, 50%)
                rotate(var(--map-rotation, 0deg)) translate(-50%, -50%);
            transform-origin: 0 0;
            position: relative;
        }

        #map-image {
            width: 100%;
            margin-bottom: -6px;
        }

        #map-image-source {
            display: none;
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
            display: flex;
            flex-direction: column;
            gap: 10px;
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
            height: min-content;
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

        ${PresetSelector.styles}
        ${MapObject.styles}
        ${ManualRectangle.styles}
        ${PredefinedMultiRectangle.styles}
        ${ManualPath.styles}
        ${ManualPoint.styles}
        ${PredefinedPoint.styles}
        ${Room.styles}
        ${IconsWrapper.styles}
        ${TilesWrapper.styles}
        ${DropdownMenu.styles}
        ${ToastRenderer.styles}
    `;
