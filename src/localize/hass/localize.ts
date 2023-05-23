// home-assistant/frontend/src/common/translations/localize.ts

// Exclude some patterns from key type checking for now
// These are intended to be removed as errors are fixed
// Fixing component category will require tighter definition of types from backend and/or web socket
export type LocalizeKeys =
    // | FlattenObjectKeys<Omit<TranslationDict, "supervisor">>
    | `state.default.unavailable`
    | `state.default.unknown`
    | `panel.${string}`
    | `ui.card.alarm_control_panel.${string}`
    | `ui.card.weather.attributes.${string}`
    | `ui.card.weather.cardinal_direction.${string}`
    | `ui.components.calendar.event.rrule.${string}`
    | `ui.components.logbook.${string}`
    | `ui.components.selectors.file.${string}`
    | `ui.dialogs.entity_registry.editor.${string}`
    | `ui.dialogs.more_info_control.vacuum.${string}`
    | `ui.dialogs.quick-bar.commands.${string}`
    | `ui.dialogs.unhealthy.reason.${string}`
    | `ui.dialogs.unsupported.reason.${string}`
    | `ui.panel.config.${string}.${"caption" | "description"}`
    | `ui.panel.config.automation.${string}`
    | `ui.panel.config.dashboard.${string}`
    | `ui.panel.config.devices.${string}`
    | `ui.panel.config.energy.${string}`
    | `ui.panel.config.info.${string}`
    | `ui.panel.config.lovelace.${string}`
    | `ui.panel.config.network.${string}`
    | `ui.panel.config.scene.${string}`
    | `ui.panel.config.zha.${string}`
    | `ui.panel.config.zwave_js.${string}`
    | `ui.panel.lovelace.card.${string}`
    | `ui.panel.lovelace.editor.${string}`
    | `ui.panel.page-authorize.form.${string}`
    | `component.${string}`;

export type LocalizeFunc<Keys extends string = LocalizeKeys> = (
    key: Keys,
    ...args: any[]
) => string;

// Tweaked from https://www.raygesualdo.com/posts/flattening-object-keys-with-typescript-types
export type FlattenObjectKeys<
    T extends Record<string, any>,
    Key extends keyof T = keyof T
> = Key extends string
    ? T[Key] extends Record<string, unknown>
        ? `${Key}.${FlattenObjectKeys<T[Key]>}`
        : `${Key}`
    : never;

interface FormatType {
    [format: string]: any;
}

export interface FormatsType {
    number: FormatType;
    date: FormatType;
    time: FormatType;
}
