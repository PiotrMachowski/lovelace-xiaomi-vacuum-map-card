import { MousePosition } from "./mouse-position";
import { PredefinedMultiRectangle } from "./predefined-multi-rectangle";
import { Room } from "./room";
import { PredefinedPoint } from "./predefined-point";
import { ManualRectangle } from "./manual-rectangle";
import { CoordinatesConverter } from "./coordinates-converter";
import { TranslatableString } from "../../types/types";

export class Context {
    constructor(
        public readonly scale: () => number,
        public readonly realScale: () => number,
        public readonly mousePositionCalculator: (_: MouseEvent | TouchEvent) => MousePosition,
        public readonly update: () => void,
        public readonly selectionChanged: () => void,
        public readonly coordinatesConverter: () => CoordinatesConverter | undefined,
        public readonly selectedManualRectangles: () => ManualRectangle[],
        public readonly selectedPredefinedRectangles: () => PredefinedMultiRectangle[],
        public readonly selectedRooms: () => Room[],
        public readonly selectedPredefinedPoint: () => PredefinedPoint[],
        public readonly roundingEnabled: () => boolean,
        public readonly coordinatesToMetersDivider: () => number,
        public readonly maxSelections: () => number,
        public readonly cssEvaluator: (_: string) => string,
        public readonly runImmediately: () => Promise<boolean>,
        public readonly localize: (_: TranslatableString) => string,
    ) {}

    public roundMap([x, y]: PointArrayNotation): PointArrayNotation {
        if (this.roundingEnabled()) {
            return [Math.round(x), Math.round(y)];
        } else {
            return [x, y];
        }
    }
}
