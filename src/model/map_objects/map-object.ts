// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";

import { Context } from "./context";
import { MousePosition } from "./mouse-position";
import { IconConfig, LabelConfig, PointType, RectangleType, TranslatableString, ZoneType } from "../../types/types";
import { conditional } from "../../utils";

export abstract class MapObject {
    protected readonly _context: Context;

    protected constructor(context: Context) {
        this._context = context;
    }

    protected scaled(value: number): number {
        return value / this._context.scale();
    }

    protected scaledCss(property: string): number {
        return parseFloat(this._context.cssEvaluator(property)) / this._context.scale();
    }

    protected realScaled(value: number): number {
        if (window["chrome"])
            // noooooooo
            return value / this._context.realScale();
        return this.scaled(value / this._context.realScale());
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
                <foreignObject class="${htmlClass}"
                               style="--x-icon: ${mapped[0]}px; --y-icon: ${mapped[1]}px"
                               @click="${click}">
                    <div class="map-icon-wrapper">
                        <ha-icon icon="${config?.name}"></ha-icon>
                    </div>
                </foreignObject>
            `,
        )}`;
    }

    protected renderLabel(config: LabelConfig | undefined, htmlClass: string): SVGTemplateResult {
        const mapped = config ? this.vacuumToScaledMap(config.x, config.y) : [];
        return svg`${conditional(
            config != null && mapped.length > 0,
            () => svg`
                <text class="${htmlClass}"
                      style="--offset-x: ${config?.offset_x ?? 0}px; --offset-y: ${config?.offset_y ?? 0}px"
                      x="${mapped[0]}"
                      y="${mapped[1]}">
                    ${config?.text}
                </text>
            `,
        )}`;
    }

    protected vacuumToMapRect(zone: ZoneType): [RectangleType, RectangleType] {
        const [vacX1, vacY1, vacX2, vacY2] = zone;
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
        const outputVacuumPoints = vacuumPointsCycled.slice(first, first + 4) as RectangleType;
        return [outputMapPoints, outputVacuumPoints];
    }

    protected static findTopLeft(rect: RectangleType): PointType {
        const top = rect.sort((p1, p2) => p1[1] - p2[1])[0];
        const topIndex = rect.indexOf(top);
        const next = rect[(topIndex + 1) % 4];
        const previous = rect[(topIndex + 3) % 4];
        const atanNext = MapObject.calcAngle(top, next);
        const atanPrevious = MapObject.calcAngle(top, previous);
        if (atanNext < atanPrevious) return next;
        return top;
    }

    protected static calcAngle(p2: PointType, p1: PointType): number {
        let atan = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
        if (atan > Math.PI / 2) {
            atan = Math.PI - atan;
        }
        return atan;
    }

    public abstract render(): SVGTemplateResult;

    static get styles(): CSSResultGroup {
        return css`
            .map-icon-wrapper {
                width: inherit;
                height: inherit;
                background: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        `;
    }
}
