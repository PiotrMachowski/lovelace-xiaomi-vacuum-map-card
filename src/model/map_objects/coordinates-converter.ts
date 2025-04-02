import { applyToPoint, compose, fromTriangles, inverse, Matrix, translate } from "transformation-matrix";
import { default as transformer, QuadPoints } from "change-perspective";

import { CalibrationPoint, Point, PointType } from "../../types/types";

enum TransformMode {
    AFFINE,
    PERSPECTIVE,
}

export class CoordinatesConverter {
    public readonly calibrated: boolean;
    public readonly transformMode?: TransformMode;
    public readonly mapToVacuumMatrix?: Matrix;
    public readonly vacuumToMapMatrix?: Matrix;
    private readonly mapToVacuumTransformer: ((x: number, y: number) => [number, number]) | undefined;
    private readonly vacuumToMapTransformer: ((x: number, y: number) => [number, number]) | undefined;

    constructor(calibrationPoints: CalibrationPoint[] | undefined, offset?: Point) {
        const mapPoints = calibrationPoints?.map(cp => cp.map);
        const vacuumPoints = calibrationPoints?.map(cp => cp.vacuum);
        if (mapPoints && vacuumPoints) {
            if (mapPoints.length === 3) {
                this.transformMode = TransformMode.AFFINE;
                this.vacuumToMapMatrix = fromTriangles(vacuumPoints, mapPoints);
                if (offset) {
                    this.vacuumToMapMatrix = compose(translate(offset.x, offset.y), this.vacuumToMapMatrix)
                }
                this.mapToVacuumMatrix = inverse(this.vacuumToMapMatrix)
                this.calibrated = !!(this.mapToVacuumMatrix && this.vacuumToMapMatrix);
            } else {
                this.transformMode = TransformMode.PERSPECTIVE;
                const mapMerged = mapPoints.flatMap(p => [p.x, p.y]);
                const vacuumMerged = vacuumPoints.flatMap(p => [p.x, p.y]);
                this.mapToVacuumTransformer = transformer(mapMerged as QuadPoints, vacuumMerged as QuadPoints);
                this.vacuumToMapTransformer = transformer(vacuumMerged as QuadPoints, mapMerged as QuadPoints);
                this.calibrated = true;
            }
        } else {
            this.calibrated = false;
        }
    }

    public mapToVacuum(x: number, y: number): PointType {
        if (this.transformMode === TransformMode.AFFINE && this.mapToVacuumMatrix) {
            return applyToPoint(this.mapToVacuumMatrix, [x, y]);
        }
        if (this.transformMode === TransformMode.PERSPECTIVE && this.mapToVacuumTransformer) {
            return this.mapToVacuumTransformer(x, y);
        }
        throw Error("Missing calibration");
    }

    public vacuumToMap(x: number, y: number): PointType {
        if (this.transformMode === TransformMode.AFFINE && this.vacuumToMapMatrix) {
            return applyToPoint(this.vacuumToMapMatrix, [x, y]);
        }
        if (this.transformMode === TransformMode.PERSPECTIVE && this.vacuumToMapTransformer) {
            return this.vacuumToMapTransformer(x, y);
        }
        throw Error("Missing calibration");
    }
}
