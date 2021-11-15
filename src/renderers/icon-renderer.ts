import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { hasAction } from "custom-card-helpers";

import { actionHandler } from "../action-handler-directive";
import { handleActionWithConfig } from "../utils";
import { IconActionConfig } from "../types/types";
import { XiaomiVacuumMapCard } from "../xiaomi-vacuum-map-card";

export class IconRenderer {
    public static render(config: IconActionConfig, card: XiaomiVacuumMapCard): TemplateResult {
        return html`
            <paper-button
                class="vacuum-actions-item clickable ripple"
                .title=${config.tooltip ?? ""}
                @action=${handleActionWithConfig(card, config)}
                .actionHandler=${actionHandler({
                    hasHold: hasAction(config?.hold_action),
                    hasDoubleClick: hasAction(config?.double_tap_action),
                })}>
                <ha-icon icon="${config.icon}"></ha-icon>
            </paper-button>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
            .vacuum-actions-item {
                float: left;
                width: 50px;
                height: 50px;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: transparent;
            }
        `;
    }
}
