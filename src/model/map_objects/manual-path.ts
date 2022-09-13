// noinspection CssUnresolvedCustomProperty

import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";

import { Context } from "./context";
import { MapObject } from "./map-object";

export class PathPoint extends MapObject {
    constructor(public x: number, public y: number, context: Context) {
        super(context);
    }

    public imageX(): number {
        return this.realScaled(this.x);
    }

    public imageY(): number {
        return this.realScaled(this.y);
    }

    renderMask(): SVGTemplateResult {
        return svg`
            <circle style="r: var(--radius)"
                    cx="${this.x}"
                    cy="${this.y}"
                    fill="black">
            </circle>`;
    }

    render(): SVGTemplateResult {
        return svg`
            <circle class="manual-path-point"
                    cx="${this.x}"
                    cy="${this.y}">
            </circle>`;
    }
}

export class ManualPath extends MapObject {
    constructor(public points: PathPoint[], context: Context) {
        super(context);
    }

    public render(): SVGTemplateResult {
        if (this.points.length === 0) {
            return svg``;
        }
        const pointsX = this.points.map(p => p.x);
        const pointsY = this.points.map(p => p.y);
        const maxX = Math.max(...pointsX);
        const minX = Math.min(...pointsX);
        const maxY = Math.max(...pointsY);
        const minY = Math.min(...pointsY);
        return svg`
            <g class="manual-path-wrapper">
                <defs>
                    <mask id="manual-path-circles-filter">
                        <rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}"
                              fill="white"></rect>
                        ${this.points.map(p => p.renderMask())}
                    </mask>
                </defs>
                ${this.points.map(p => p.render())}
                <polyline class="manual-path-line"
                          points="${this.points.map(p => `${p.x},${p.y}`).join(" ")}"
                          mask="url(#manual-path-circles-filter)">
                </polyline>
            </g>
        `;
    }

    public toVacuum(repeats: number | null = null): ([number, number] | [number, number, number])[] {
        return this.points.map(p => {
            const [x, y] = this.realMapToVacuum(p.imageX(), p.imageY());

            if (repeats === null) {
                return [x, y];
            }
            return [x, y, repeats];
        });
    }

    public addPoint(x: number, y: number): void {
        this.points.push(new PathPoint(x, y, this._context));
    }

    public clear(): void {
        this.points = [];
    }

    public removeLast(): void {
        this.points.pop();
    }

    public static get styles(): CSSResultGroup {
        return css`
            .manual-path-wrapper {
                --radius: calc(var(--map-card-internal-manual-path-point-radius) / var(--map-scale));
            }

            .manual-path-line {
                fill: transparent;
                stroke: var(--map-card-internal-manual-path-line-color);
                stroke-width: calc(var(--map-card-internal-manual-path-line-width) / var(--map-scale));
            }

            .manual-path-point {
                r: var(--radius);
                stroke: var(--map-card-internal-manual-path-point-line-color);
                fill: var(--map-card-internal-manual-path-point-fill-color);
                stroke-width: calc(var(--map-card-internal-manual-path-point-line-width) / var(--map-scale));
            }
        `;
    }
}
