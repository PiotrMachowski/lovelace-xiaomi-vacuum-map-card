export function calculateRealScale(mapCanvas: HTMLCanvasElement, naturalWidth: number): number {
    // getBoundingClientRect() includes the pinch-zoom and rotation transforms applied to the map.
    // Keep geometry in the canvas's untransformed layout coordinate space; the parent applies those transforms.
    return (mapCanvas.offsetWidth || mapCanvas.width) / naturalWidth;
}
