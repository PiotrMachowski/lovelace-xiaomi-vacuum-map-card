// home-assistant/frontend/src/data/entity.ts

// Creates a type predicate function for determining if an array literal includes a given value
export const arrayLiteralIncludes =
    <T extends readonly unknown[]>(array: T) =>
        (searchElement: unknown, fromIndex?: number): searchElement is T[number] =>
            array.includes(searchElement as T[number], fromIndex);

export const UNAVAILABLE = "unavailable";
export const UNKNOWN = "unknown";
export const ON = "on";
export const OFF = "off";

export const UNAVAILABLE_STATES = [UNAVAILABLE, UNKNOWN] as const;
export const OFF_STATES = [UNAVAILABLE, UNKNOWN, OFF] as const;

export const isUnavailableState = arrayLiteralIncludes(UNAVAILABLE_STATES);
export const isOffState = arrayLiteralIncludes(OFF_STATES);
