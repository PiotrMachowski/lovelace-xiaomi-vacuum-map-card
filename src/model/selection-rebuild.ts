import { SelectionType } from "./map_mode/selection-type";

/**
 * The parts of a predefined selection object (room, zone, point) a rebuild needs. Implemented by
 * `PredefinedMapObject`; kept structural so the rules below are testable without a card.
 */
export interface RebuildableSelection {
    /** Identifies the thing the object refers to: a room id, a zone list or a point. */
    selectionKey(): string;
    readonly selected: boolean;
    /** Applies a kept selection; a `state_entity` object ignores it and follows its entity. */
    restoreSelected(selected: boolean): void;
}

/**
 * What the user had selected before the card rebuilt its selectable objects. Predefined objects are
 * matched by key, so a rebuilt object takes the place of the one it replaces. `knownKeys` holds
 * every object that was selectable: a known object the user left unselected stays unselected even
 * if its `default_state` is `selected`, while an object that is new to the card gets its default.
 *
 * Manual selections (rectangles, path, point) are not part of the snapshot: they live on the card
 * and a rebuild of the same selection type leaves them alone.
 */
export interface SelectionSnapshot {
    readonly selectionType: SelectionType;
    readonly selectedKeys: readonly string[];
    readonly knownKeys: ReadonlySet<string>;
}

/**
 * Keys made unique by occurrence: two objects that refer to the same thing (two identical zones,
 * say) are told apart by their position among equals, so selecting one does not select both.
 */
export function occurrenceKeys(items: readonly RebuildableSelection[]): string[] {
    const seen = new Map<string, number>();
    return items.map(item => {
        const key = item.selectionKey();
        const count = seen.get(key) ?? 0;
        seen.set(key, count + 1);
        return `${count}:${key}`;
    });
}

/** Captures the current selection of a predefined selection type, in selection order. */
export function captureSelection(
    selectionType: SelectionType,
    selectables: readonly RebuildableSelection[],
    selected: readonly RebuildableSelection[],
): SelectionSnapshot {
    const keys = occurrenceKeys(selectables);
    const selectedKeys = selected
        .map(item => keys[selectables.indexOf(item)])
        .filter((key): key is string => key !== undefined);
    return { selectionType, selectedKeys, knownKeys: new Set(keys) };
}

/**
 * Applies `snapshot` to freshly built `selectables` and returns the selection in order.
 *
 * - An object the snapshot knew keeps the user's choice; one that disappeared is simply absent.
 * - A new object, or every object when there is no snapshot, keeps the state its constructor gave
 *   it (`default_state` or `state_entity`).
 * - A `state_entity` object follows its entity, so it may join or leave the selection.
 *
 * The kept objects stay in their previous order (the cleaning order for rooms); objects that joined
 * the selection follow them in list order.
 */
export function restoreSelection<T extends RebuildableSelection>(
    selectables: readonly T[],
    snapshot: SelectionSnapshot | undefined,
): T[] {
    const keys = occurrenceKeys(selectables);
    if (snapshot) {
        const kept = new Set(snapshot.selectedKeys);
        selectables.forEach((item, index) => {
            if (snapshot.knownKeys.has(keys[index])) item.restoreSelected(kept.has(keys[index]));
        });
    }
    const position = (index: number): number => {
        const previous = snapshot?.selectedKeys.indexOf(keys[index]) ?? -1;
        return previous < 0 ? Number.MAX_SAFE_INTEGER : previous;
    };
    return selectables
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.selected)
        .sort((a, b) => position(a.index) - position(b.index) || a.index - b.index)
        .map(({ item }) => item);
}
