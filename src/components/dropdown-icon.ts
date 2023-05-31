import { css, CSSResultGroup, html, TemplateResult } from "lit";

import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
} from "../types/types";
import { customElement, property } from "lit/decorators";
import { RootlessLitElement } from "./rootless-lit-element";

@customElement("xvmc-dropdown-icon")
export class DropdownIcon extends RootlessLitElement {

    @property({attribute: false})
    private config!: DropdownIconActionConfig;

    @property({attribute: false})
    private isInEditor!: boolean;

    @property({attribute: false})
    private onAction!: ActionHandlerFunctionCreator;

    public render(): TemplateResult {
        const items = this.config.map(i => {
            return { icon: i.icon, name: (i.label ?? "") };
        });
        const currentIndex = this.config.findIndex(i => i.isSelected);
        const itemClass = `icon-menu-${this.config[0].menu_id}`;
        return html`
            <xvmc-dropdown-menu
                .title="${this.isInEditor ? `menu_id: ${this.config[0].menu_id}` : this.config[currentIndex].tooltip ?? ""}"
                .values=${items}
                .currentIndex=${currentIndex}
                .setValue=${selected => {
                    return this.onAction(this.config[selected])();
                }}
                .renderNameCollapsed=${false}
                .additionalClasses=${[itemClass, "dropdown-icon"]}>
            </xvmc-dropdown-menu>
        `
    }

    public static get styles(): CSSResultGroup {
        return css`
            .dropdown-icon * .dropdown-menu-button-button {
              background-color: transparent;
            }
        `;
    }
}
