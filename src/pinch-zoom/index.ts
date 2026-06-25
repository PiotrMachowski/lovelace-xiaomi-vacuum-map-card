import PinchZoom from "./pinch-zoom";

export * from "./pinch-zoom";
export { default } from "./pinch-zoom";
if (!customElements.get("pinch-zoom-custom")) {
    customElements.define("pinch-zoom-custom", PinchZoom);
}
