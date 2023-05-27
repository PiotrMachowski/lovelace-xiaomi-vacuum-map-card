import { css, CSSResultGroup, html, LitElement, TemplateResult } from "lit";

import {
    ActionHandlerFunctionCreator,
    DropdownIconActionConfig,
} from "../types/types";
import { customElement, property } from "lit/decorators";

@customElement("xvmc-dropdown-icon")
export class DropdownIcon extends LitElement {

    @property({attribute: false})
    private config!: DropdownIconActionConfig;

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

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

    public static get styles(): CSSResultGroup {
        return css`
            .dropdown-icon * .dropdown-menu-button-button {
              background-color: transparent;
            }
        `;
    }
}
