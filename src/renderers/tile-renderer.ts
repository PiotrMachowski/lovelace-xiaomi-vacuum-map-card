import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { hasAction } from "custom-card-helpers";

import { actionHandler } from "../action-handler-directive";
import { conditional, handleActionWithConfig } from "../utils";
import { TileConfig } from "../types/types";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";

export class TileRenderer {
    public static render(config: TileConfig, card: XiaomiVacuumMapCard): TemplateResult {
        let value: number | string = config.attribute
            ? card.hass.states[config.entity].attributes[config.attribute]
            : card.hass.states[config.entity].state;
        if (typeof value === "number" || !isNaN(+value)) {
            value = parseFloat(value.toString()) * (config.multiplier ?? 1);
            if (config.precision != undefined) {
                value = value.toFixed(config.precision);
            }
        }
        const translations = config.translations ?? {};
        if (value in translations) {
            value = translations[value];
        }
        return html`
            <div
                class="tile-wrapper clickable ripple"
                .title=${config.tooltip ?? ""}
                @action=${handleActionWithConfig(card, config)}
                .actionHandler=${actionHandler({
                    hasHold: hasAction(config?.hold_action),
                    hasDoubleClick: hasAction(config?.double_tap_action),
                })}>
                <div class="tile-title">${config.label}</div>
                <div class="tile-value-wrapper">
                    ${conditional(
                        !!config.icon,
                        () => html` <div class="tile-icon">
                            <ha-icon icon="${config.icon}"></ha-icon>
                        </div>`,
                    )}
                    <div class="tile-value">${value}${config.unit ?? ""}</div>
                </div>
            </div>
        `;
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
