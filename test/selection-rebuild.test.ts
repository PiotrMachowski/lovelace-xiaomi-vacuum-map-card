import { describe, expect, it } from "vitest";

import { SelectionType } from "../src/model/map_mode/selection-type";
import {
    captureSelection,
    occurrenceKeys,
    type RebuildableSelection,
    restoreSelection,
} from "../src/model/selection-rebuild";

/** A predefined object: `entity` makes it follow a state entity, like `state_entity`. */
class Item implements RebuildableSelection {
    constructor(
        readonly key: string,
        public selected = false,
        readonly entity = false,
    ) {}
    selectionKey(): string {
        return this.key;
    }
    restoreSelected(selected: boolean): void {
        if (!this.entity) this.selected = selected;
    }
}

const keys = (items: Item[]): string[] => items.map(item => item.key);

describe("selection rebuild", () => {
    it("keeps the previous order, not the list order", () => {
        const before = [new Item("a"), new Item("b"), new Item("c")];
        const snapshot = captureSelection(SelectionType.ROOM, before, [before[2], before[0]]);

        const after = [new Item("a"), new Item("b"), new Item("c")];
        expect(keys(restoreSelection(after, snapshot))).toEqual(["c", "a"]);
        expect(after.map(item => item.selected)).toEqual([true, false, true]);
    });

    it("drops an item that disappeared and keeps the others in order", () => {
        const before = [new Item("a"), new Item("b"), new Item("c")];
        const snapshot = captureSelection(SelectionType.ROOM, before, [before[2], before[1], before[0]]);
        expect(keys(restoreSelection([new Item("a"), new Item("c")], snapshot))).toEqual(["c", "a"]);
    });

    it("keeps a known default item the user deselected unselected, and gives a new item its default", () => {
        const before = [new Item("a"), new Item("b")];
        const snapshot = captureSelection(SelectionType.ROOM, before, [before[1]]);
        const after = [new Item("a", true), new Item("b"), new Item("new", true)];
        expect(keys(restoreSelection(after, snapshot))).toEqual(["b", "new"]);
    });

    it("lets an entity-backed item follow its entity and appends it when it joins", () => {
        const before = [new Item("a"), new Item("e", false, true), new Item("c")];
        const snapshot = captureSelection(SelectionType.ROOM, before, [before[2], before[0]]);
        const joined = [new Item("a"), new Item("e", true, true), new Item("c")];
        expect(keys(restoreSelection(joined, snapshot))).toEqual(["c", "a", "e"]);

        const kept = captureSelection(SelectionType.ROOM, joined, restoreSelection(joined, snapshot));
        const left = [new Item("a"), new Item("e", false, true), new Item("c")];
        expect(keys(restoreSelection(left, kept))).toEqual(["c", "a"]);
    });

    it("tells identical items apart by occurrence", () => {
        const before = [new Item("z"), new Item("z")];
        expect(occurrenceKeys(before)).toEqual(["0:z", "1:z"]);
        const snapshot = captureSelection(SelectionType.PREDEFINED_RECTANGLE, before, [before[1]]);
        const after = [new Item("z"), new Item("z")];
        restoreSelection(after, snapshot);
        expect(after.map(item => item.selected)).toEqual([false, true]);
    });

    it("uses the constructor state without a snapshot", () => {
        const items = [new Item("a", true), new Item("b"), new Item("c", true)];
        expect(keys(restoreSelection(items, undefined))).toEqual(["a", "c"]);
    });
});
