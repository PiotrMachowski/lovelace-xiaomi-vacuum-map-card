import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { hasAction } from "custom-card-helpers";

import { actionHandler } from "../action-handler-directive";
import {
    ActionHandlerFunctionCreator,
    IconActionConfig,
} from "../types/types";
import { customElement, property } from "lit/decorators";
import { RootlessLitElement } from "./rootless-lit-element";

@customElement("xvmc-single-icon")
export class SingleIcon extends RootlessLitElement {

    @property({attribute: false})
    private config!: IconActionConfig;

    @property({attribute: false})
    private isInEditor!: boolean;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    public render(): TemplateResult {
        return html`
            <paper-button
                class="single-icon clickable ripple"
                .title=${this.isInEditor ? `tile_id: ${this.config.icon_id}` : this.config.tooltip ?? ""}
                @action=${this.onAction(this.config)}
                .actionHandler=${actionHandler({
                    hasHold: hasAction(this.config?.hold_action),
                    hasDoubleClick: hasAction(this.config?.double_tap_action),
                })}>
                <ha-icon icon="${this.config.icon}"></ha-icon>
            </paper-button>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
          .single-icon {
            float: left;
            width: 50px;
            height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: transparent;
            border-radius: var(--map-card-internal-big-radius);
          }
        `;
    }
}
