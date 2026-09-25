// noinspection CssUnresolvedCustomProperty
import { css, CSSResultGroup, svg, SVGTemplateResult } from "lit";

import { Context } from "./context";
import { MapObject } from "./map-object";
import { ValetudoMarker } from "../../lib/valetudo-json-map-source";

export type ValetudoMarkerKind = "robot" | "charger" | "go-to-target";

const ICONS: Record<ValetudoMarkerKind, string> = {
    robot: "mdi:robot-vacuum",
    charger: "mdi:battery-charging",
    "go-to-target": "mdi:map-marker",
};

export class ValetudoMarkerIcon extends MapObject {
    constructor(private readonly _marker: ValetudoMarker, private readonly _kind: ValetudoMarkerKind, context: Context) {
        super(context);
    }

    public render(): SVGTemplateResult {
        const [x, y] = this.vacuumToScaledMap(this._marker.x, this._marker.y);
        return svg`
            <foreignObject class="icon-foreign-object"
                           style="--x-icon: ${x}px; --y-icon: ${y}px;"
                           x="${x}px" y="${y}px" width="36px" height="36px">
                <body xmlns="http://www.w3.org/1999/xhtml">
                    <div class="map-icon-wrapper valetudo-marker valetudo-marker-${this._kind}">
                        <ha-icon icon="${ICONS[this._kind]}"
                                 style="background: transparent; transform: rotate(${this._marker.angle ?? 0}deg);">
                        </ha-icon>
                    </div>
                </body>
            </foreignObject>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
            .map-icon-wrapper.valetudo-marker {
                x: var(--x-icon);
                y: var(--y-icon);
                height: var(--map-card-internal-valetudo-marker-wrapper-size);
                width: var(--map-card-internal-valetudo-marker-wrapper-size);
                border-radius: 50%;
                transform-box: fill-box;
                overflow: hidden;
                transform: translate(
                        calc(var(--map-card-internal-valetudo-marker-wrapper-size) / -2),
                        calc(var(--map-card-internal-valetudo-marker-wrapper-size) / -2)
                    )
                    scale(calc(1 / var(--map-scale)));
                --mdc-icon-size: var(--map-card-internal-valetudo-marker-icon-size);
                pointer-events: none;
                background: var(--map-card-internal-valetudo-marker-background-color);
                color: var(--map-card-internal-valetudo-marker-icon-color);
            }

            .map-icon-wrapper.valetudo-marker-robot {
                background: var(--map-card-internal-valetudo-robot-background-color);
                color: var(--map-card-internal-valetudo-robot-icon-color);
            }
        `;
    }
}
