import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined";
import { computeStateDomain, hasAction } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket/dist/types";

import { actionHandler } from "../action-handler-directive";
import { conditional, handleActionWithConfig } from "../utils";
import { EntityConfig, ReplacedKey, TileConfig, VariablesStorage } from "../types/types";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";
import { HomeAssistantFixed } from "../types/fixes";
import { localizeEntity } from "../localize/localize";
import { computeAttributeNameDisplay } from "../localize/hass/compute_attribute_display";
import { blankBeforePercent } from "../localize/hass/blank_before_percent";

export class TileRenderer {
    public static render(
        config: TileConfig,
        internalVariables: VariablesStorage,
        card: XiaomiVacuumMapCard,
    ): TemplateResult {
        const stateObj = config.entity ? card.hass.states[config.entity] : undefined;
        const title = this.getTileLabel(card.hass, config, stateObj);
        const value = this.getTileValue(card.hass, config, internalVariables, stateObj);
        const icon = this.getIcon(card.hass, config, stateObj);
        const domain = stateObj ? computeStateDomain(stateObj) : undefined;

        return html`
            <div
                class="tile-wrapper clickable ripple ${config.tile_id ? `tile-${config.tile_id}-wrapper` : ""}"
                .title=${card.isInEditor ? `tile_id: ${config.tile_id}` : config.tooltip ?? ""}
                @action=${handleActionWithConfig(card, config)}
                .actionHandler=${actionHandler({
                    hasHold: hasAction(config?.hold_action),
                    hasDoubleClick: hasAction(config?.double_tap_action),
                })}>
                <div class="tile-title">${title}</div>
                <div class="tile-value-wrapper">
                    ${conditional(
                        icon !== "",
                        () => html`<div class="tile-icon">
                            <ha-state-icon
                                .icon=${icon}
                                .state=${stateObj}
                                data-domain=${ifDefined(domain)}
                                data-state=${stateObj?.state}>
                            </ha-state-icon>
                        </div>`,
                    )}
                    <div class="tile-value">${value}</div>
                </div>
            </div>
        `;
    }

    private static getTileLabel(
        hass: HomeAssistantFixed,
        tile: TileConfig,
        stateObject?: HassEntity,
    ) {
        if (tile.label !== undefined)
            return tile.label;
        if (stateObject !== undefined) {
            if (tile.attribute !== undefined)
                return computeAttributeNameDisplay(hass.localize, stateObject, hass.entities, tile.attribute);
            return stateObject.attributes?.friendly_name ?? tile.entity;
        }
        return tile.tile_id ?? "tile";
    }

    private static getTileValue(
        hass: HomeAssistantFixed,
        config: TileConfig,
        internalVariables: VariablesStorage,
        stateObject?: HassEntity,
    ) {
        let value: ReplacedKey = "";
        const processNumber = config.multiplier !== undefined || config.precision !== undefined;
        if (config.entity && stateObject) {
            if (processNumber) {
                value = config.attribute
                    ? stateObject.attributes[config.attribute]
                    : stateObject.state;
            } else {
                value = localizeEntity(hass, config as EntityConfig, hass.states[config.entity]);
            }
        } else if (config.internal_variable && config.internal_variable in internalVariables) {
            value = internalVariables[config.internal_variable];
        }
        if (processNumber && value !== null && (typeof value === "number" || !isNaN(+value))) {
            value = parseFloat(value.toString()) * (config.multiplier ?? 1);
            if (config.precision !== undefined) {
                value = value.toFixed(config.precision);
            }
        }
        const translations = config.translations ?? {};
        if (`${value}`.toLowerCase() in translations) {
            value = translations[`${value}`.toLowerCase()];
        }
        const unit = this.getUnit(hass, config);
        return `${value}${unit}`;
    }

    private static getIcon(hass: HomeAssistantFixed, config: TileConfig, stateObject?: HassEntity) {
        if (config.icon_source) {
            const split = config.icon_source.split(".attributes.");
            const entity = hass.states[split[0]];
            let icon = entity.state;
            if (split.length === 2) {
                icon = entity.attributes[split[1]];
            }
            return icon;
        }
        if (config.icon === undefined && stateObject) {
            return stateObject.attributes.icon ?? null;
        }
        return config.icon;
    }

    private static getUnit(hass: HomeAssistantFixed, config: TileConfig) {
        return !config.unit
            ? "" :
            config.unit === "%"
                ? blankBeforePercent(hass.locale) + "%"
                : ` ${config.unit}`;
    }

    public static get styles(): CSSResultGroup {
        return css`
            .tile-wrapper {
                min-width: fit-content;
                width: 80px;
                padding: 10px;
                border-radius: var(--map-card-internal-small-radius);
                background-color: var(--map-card-internal-tertiary-color);
                flex-grow: 1;
                overflow: hidden;
                color: var(--map-card-internal-tertiary-text-color);
            }

            .tile-title {
                font-size: smaller;
            }

            .tile-value-wrapper {
                display: inline-flex;
                align-items: flex-end;
                padding-top: 5px;
            }

            .tile-icon {
                padding-right: 5px;
            }

            .tile-value {
            }
        `;
    }
}
