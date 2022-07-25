// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";

import { Context } from "./context";
import { MousePosition } from "./mouse-position";
import {
    IconConfig,
    LabelConfig,
    PointType,
    RectangleType,
    TranslatableString,
    VariablesStorage,
    ZoneType,
} from "../../types/types";
import { conditional } from "../../utils";

export abstract class MapObject {
    protected readonly _context: Context;

    protected constructor(context: Context) {
        this._context = context;
    }

    public get variables(): VariablesStorage {
        return {};
    }

    protected static findTopLeft(rect: RectangleType): PointType {
        const top = rect.sort((p1, p2) => p1[1] - p2[1])[0];
        const topIndex = rect.indexOf(top);
        const next = rect[(topIndex + 1) % 4];
        const previous = rect[(topIndex + 3) % 4];
        const atanNext = MapObject.calcAngle(top, next);
        const atanPrevious = MapObject.calcAngle(top, previous);
        const second = atanNext < atanPrevious ? next : previous;
        return second[0] < top[0] ? second : top;
    }

    protected static calcAngle(p2: PointType, p1: PointType): number {
        let atan = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
        if (atan > Math.PI / 2) {
            atan = Math.PI - atan;
        }
        return atan;
    }

    private static _reverse([m1, m2, m3, m4]: RectangleType): RectangleType {
        return [m1, m4, m3, m2];
    }

    public abstract render(): SVGTemplateResult;

    protected scaled(value: number): number {
        return value / this._context.scale();
    }

    protected scaledCss(property: string): number {
        return parseFloat(this._context.cssEvaluator(property)) / this._context.scale();
    }

    protected realScaled(value: number): number {
        return value / this._context.realScale();
    }

    protected realScaled2(value: number): number {
        return value * this._context.realScale();
    }

    protected realScaled2Point(value: PointArrayNotation): PointArrayNotation {
        return [this.realScaled2(value[0]), this.realScaled2(value[1])];
    }

    protected realScaledPoint(value: PointArrayNotation): PointArrayNotation {
        return [this.realScaled(value[0]), this.realScaled(value[1])];
    }

    protected update(): void {
        this._context.update();
        this._context.selectionChanged();
    }

    protected localize(string: TranslatableString): string {
        return this._context.localize(string);
    }

    protected getMousePosition(event: MouseEvent | TouchEvent): MousePosition {
        return this._context.mousePositionCalculator(event);
    }

    protected vacuumToRealMap(x: number, y: number): PointType {
        const point = this._context.coordinatesConverter()?.vacuumToMap(x, y);
        if (!point) {
            throw Error("Missing calibration");
        }
        return point;
    }

    protected vacuumToScaledMap(x: number, y: number): PointType {
        return this.realScaled2Point(this.vacuumToRealMap(x, y));
    }

    protected scaledMapToVacuum(x: number, y: number): PointType {
        const [xs, ys] = this.realScaledPoint([x, y]);
        return this.realMapToVacuum(xs, ys);
    }

    protected realMapToVacuum(x: number, y: number): PointType {
        const point = this._context.coordinatesConverter()?.mapToVacuum(x, y);
        if (!point) {
            throw Error("Missing calibration");
        }
        return this._context.roundMap(point);
    }

    protected renderIcon(config: IconConfig | undefined, click: () => void, htmlClass: string): SVGTemplateResult {
        const mapped = config ? this.vacuumToScaledMap(config.x, config.y) : [];
        return svg`${conditional(
            config != null && mapped.length > 0,
            () => svg`
                <foreignObject class="icon-foreign-object"
                               style="--x-icon: ${mapped[0]}px; --y-icon: ${mapped[1]}px;"
                               x="${mapped[0]}px" y="${mapped[1]}px" width="36px" height="36px">         
                    <body xmlns="http://www.w3.org/1999/xhtml">
                      <div class="map-icon-wrapper ${htmlClass} clickable" @click="${click}" >
                          <ha-icon icon="${config?.name}" style="background: transparent;"></ha-icon>
                      </div>
                    </body>
                </foreignObject>
            `,
        )}`;
    }

    protected renderLabel(config: LabelConfig | undefined, htmlClass: string): SVGTemplateResult {
        const mapped = config ? this.vacuumToScaledMap(config.x, config.y) : [];
        return svg`${conditional(
            config != null && mapped.length > 0,
            () => svg`
                <text class="label-text ${htmlClass}"
                      x="${mapped[0] + this.scaled(config?.offset_x ?? 0)}px"
                      y="${mapped[1] + this.scaled(config?.offset_y ?? 0)}px">
                    ${config?.text}
                </text>
            `,
        )}`;
    }

    protected vacuumToMapRect([vacX1, vacY1, vacX2, vacY2]: ZoneType): [RectangleType, RectangleType] {
        const v1 = [vacX1, vacY1];
        const v2 = [vacX2, vacY1];
        const v3 = [vacX2, vacY2];
        const v4 = [vacX1, vacY2];
        const m1 = this.vacuumToScaledMap(vacX1, vacY1);
        const m2 = this.vacuumToScaledMap(vacX2, vacY1);
        const m3 = this.vacuumToScaledMap(vacX2, vacY2);
        const m4 = this.vacuumToScaledMap(vacX1, vacY2);
        const vacuumPointsCycled = [v1, v2, v3, v4, v1, v2, v3, v4];
        const mapPointsCycled = [m1, m2, m3, m4, m1, m2, m3, m4];
        const mapPoints = [m1, m2, m3, m4] as RectangleType;
        const first = mapPointsCycled.indexOf(MapObject.findTopLeft(mapPoints));
        const outputMapPoints = mapPointsCycled.slice(first, first + 4) as RectangleType;
        const counterClockwise = this._isCounterClockwise(outputMapPoints);
        const outputVacuumPoints = vacuumPointsCycled.slice(first, first + 4) as RectangleType;
        if (counterClockwise) {
            return [MapObject._reverse(outputMapPoints), MapObject._reverse(outputVacuumPoints)];
        }
        return [outputMapPoints, outputVacuumPoints];
    }

    private _isCounterClockwise(rect: RectangleType): boolean {
        let sum = 0;
        rect.forEach((p, i) => (sum += (rect[(i + 1) % 4][0] - p[0]) * (rect[(i + 1) % 4][1] + p[1])));
        return sum < 0;
    }

    public static get styles(): CSSResultGroup {
        return css`
            .icon-foreign-object {
                overflow: visible;
                pointer-events: none;
            }

            .map-icon-wrapper {
                position: center;
                display: flex;
                align-items: center;
                justify-content: center;
                pointer-events: auto;
            }
        `;
    }
}
