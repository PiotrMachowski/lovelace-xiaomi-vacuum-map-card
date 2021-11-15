// noinspection CssUnresolvedCustomProperty

import { Context } from "./context";
import { MapObject } from "./map-object";

export abstract class MapPoint extends MapObject {
    protected _x: number;
    protected _y: number;

    protected constructor(x: number, y: number, context: Context) {
        super(context);
        this._x = x;
        this._y = y;
    }
}
