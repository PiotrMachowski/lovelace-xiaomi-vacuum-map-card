// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";

import { Context } from "./context";
import { MapPoint } from "./map-point";
import { PointType, PointWithRepeatsType } from "../../types/types";

export class ManualPoint extends MapPoint {
    constructor(x: number, y: number, context: Context) {
        super(x, y, context);
    }

    public render(): SVGTemplateResult {
        return svg`
            <g class="manual-point-wrapper" style="--x-point:${this._x}px; --y-point:${this._y}px;">
                <circle class="manual-point"></circle>
            </g>
        `;
    }

    public imageX(): number {
        return this.realScaled(this._x);
    }

    public imageY(): number {
        return this.realScaled(this._y);
    }

    public toVacuum(repeats: number | null = null): PointType | PointWithRepeatsType {
        const [x, y] = this.realMapToVacuum(this.imageX(), this.imageY());
        if (repeats === null) {
            return [x, y];
        }
        return [x, y, repeats];
    }

    public static get styles(): CSSResultGroup {
        return css`
            .manual-point-wrapper {
                stroke: var(--map-card-internal-manual-point-line-color);
                stroke-width: calc(var(--map-card-internal-manual-point-line-width) / var(--map-scale));
                --radius: calc(var(--map-card-internal-manual-point-radius) / var(--map-scale));
            }

            .manual-point {
                cx: var(--x-point);
                cy: var(--y-point);
                r: var(--radius);
                fill: var(--map-card-internal-manual-point-fill-color);
            }
        `;
    }
}
