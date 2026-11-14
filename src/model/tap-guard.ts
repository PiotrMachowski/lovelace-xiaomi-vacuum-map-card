/**
 * Movement, in CSS pixels, after which a pointer gesture is a drag rather than a tap. Small enough
 * that a pan is never read as a tap, large enough to forgive a finger wobbling on a phone.
 */
export const TAP_MOVE_TOLERANCE_PX = 8;

/** Lit event-listener objects; `capture` makes them run before the targets' own handlers. */
export interface TapGuard {
    readonly pointerDown: { handleEvent: (event: PointerEvent) => void; capture: true };
    readonly pointerMove: { handleEvent: (event: PointerEvent) => void; capture: true };
    readonly pointerUp: { handleEvent: (event: PointerEvent) => void; capture: true };
    readonly click: { handleEvent: (event: MouseEvent) => void; capture: true };
}

/**
 * Suppresses the `click` that ends a drag, a pinch or a rotate. A gesture counts as a drag when any
 * pointer moved more than TAP_MOVE_TOLERANCE_PX from where it went down, or when a second pointer
 * joined it. The flag resets on the next gesture's first pointer down.
 */
export function createTapGuard(): TapGuard {
    const starts = new Map<number, { x: number; y: number }>();
    let dragged = false;
    return {
        pointerDown: {
            capture: true,
            handleEvent: (event: PointerEvent): void => {
                if (starts.size === 0) dragged = false;
                starts.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (starts.size > 1) dragged = true;
            },
        },
        pointerMove: {
            capture: true,
            handleEvent: (event: PointerEvent): void => {
                const start = starts.get(event.pointerId);
                if (!start || dragged) return;
                if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MOVE_TOLERANCE_PX) {
                    dragged = true;
                }
            },
        },
        pointerUp: {
            capture: true,
            handleEvent: (event: PointerEvent): void => {
                starts.delete(event.pointerId);
            },
        },
        click: {
            capture: true,
            handleEvent: (event: MouseEvent): void => {
                if (!dragged) return;
                dragged = false;
                event.stopPropagation();
                event.preventDefault();
            },
        },
    };
}
