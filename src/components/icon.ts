import { css, CSSResultGroup, html, TemplateResult } from "lit";

import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
    IconActionConfig,
} from "../types/types";
import { DropdownIcon } from "./dropdown-icon";
import { customElement, property } from "lit/decorators";
import { SingleIcon } from "./single-icon";
import { RootlessLitElement } from "./rootless-lit-element";

@customElement("xvmc-icon")
export class Icon extends RootlessLitElement {

    @property({attribute: false})
    private config!: IconActionConfig | DropdownIconActionConfig;

    @property({attribute: false})
    private isInEditor!: boolean;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    public render(): TemplateResult {
        if (Array.isArray(this.config)) {
            return html`
                <xvmc-dropdown-icon
                    .config=${this.config}
                    .isInEditor=${this.isInEditor}
                    .onAction=${this.onAction}>
                </xvmc-dropdown-icon>
        `;
        }
        return html`
            <xvmc-single-icon
                .config=${this.config}
                .isInEditor=${this.isInEditor}
                .onAction=${this.onAction}>
            </xvmc-single-icon>
        `;
    }

    public static get styles(): CSSResultGroup {
        return css`
          ${SingleIcon.styles}
          ${DropdownIcon.styles}
        `;
    }
}
