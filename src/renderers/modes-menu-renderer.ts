import { css, CSSResultGroup, html, TemplateResult } from "lit";

import { MapMode } from "../model/map_mode/map-mode";

export class ModesMenuRenderer {
    public static render(modes: MapMode[], getMode: number, setMode: (number) => void, menu?: HTMLElement): TemplateResult {
        const getCurrentMode = (): MapMode => modes[getMode];
        return html`
            <ha-button-menu class="modes-dropdown-menu" fixed="true" activatable @closed="${(e: Event) => e.stopPropagation()}"
                @click="${() => ModesMenuRenderer.updateStyles(menu, modes.length)}">
                <div class="modes-dropdown-menu-button" slot="trigger" alt="bottom align">
                    <paper-button class="modes-dropdown-menu-button-button">
                        <ha-icon icon="${getCurrentMode().icon}" class="dropdown-icon"></ha-icon>
                    </paper-button>
                    <div class="modes-dropdown-menu-button-text">${getCurrentMode().name}</div>
                </div>
                ${modes.map(
                    (mode, index) => html` <mwc-list-item class="list-item"
                        ?activated="${getMode === index}"
                        @click="${(): void => setMode(index)}">
                        <div class="modes-dropdown-menu-entry clickable ${getMode === index ? "selected" : ""}">
                            <div
                                class="modes-dropdown-menu-entry-button-wrapper ${index === 0
                                    ? "first"
                                    : ""} ${index === modes.length - 1 ? "last" : ""} ${getMode === index
                                    ? "selected"
                                    : ""}">
                                <paper-button
                                    class="modes-dropdown-menu-entry-button ${getMode === index ? "selected" : ""}">
                                    <ha-icon icon="${mode.icon}"></ha-icon>
                                </paper-button>
                            </div>
                            <div class="modes-dropdown-menu-entry-text">${mode.name}</div>
                        </div>
                    </mwc-list-item>`,
                )}
            </ha-button-menu>
        `;
    }

    private static updateStyles(menu: HTMLElement | undefined, items: number): void {
        const div = menu?.shadowRoot?.querySelector("div") as HTMLElement;
        if (menu && div) {
            const height = 50;
            const minDiff = (items - 1) * height + 32;
            if (window.innerHeight - div.getBoundingClientRect().bottom >= minDiff) {
                div.style.marginTop = `0px`;
                menu.style.marginTop = `0px`;
                div.style.marginBottom = `-${height}px`;
                menu.style.marginBottom = `${height}px`;
            } else {
                div.style.marginTop = `-${height}px`;
                menu.style.marginTop = `${height}px`;
                div.style.marginBottom = "0px";
                menu.style.marginBottom = "0px";
            }
            const mwcMenu = menu.shadowRoot?.querySelector("mwc-menu") as HTMLElement;
            if (mwcMenu) {
                mwcMenu.style.zIndex = "1";
                mwcMenu.style.position = "fixed";
            }
            menu.querySelectorAll("mwc-list-item").forEach((item) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                item.shadowRoot!.querySelector("span")!.style.flexGrow = "1";
            });
        }
    }

    public static get styles(): CSSResultGroup {
        return css`
            .modes-dropdown-menu {
                --mdc-menu-item-height: 50px;
                --mdc-theme-primary: transparent;
                --mdc-list-vertical-padding: 0px;
                --mdc-list-side-padding: 0px;
                --mdc-shape-medium: var(--map-card-internal-big-radius);
                --mdc-ripple-color: transparent;
            }

            .modes-dropdown-menu-button {
                display: inline-flex;
            }
          
            .list-item:host:host {
                flex-grow: 1;
            }

            .modes-dropdown-menu-button-button {
                width: 50px;
                height: 50px;
                border-radius: var(--map-card-internal-big-radius);
                display: flex;
                justify-content: center;
                background-color: var(--map-card-internal-primary-color);
                align-items: center;
            }

            .modes-dropdown-menu-button-text {
                display: inline-flex;
                line-height: 50px;
                background-color: transparent;
                padding-left: 10px;
                padding-right: 15px;
            }

            .modes-dropdown-menu-entry {
                display: inline-flex;
                width: 100%;
            }

            .modes-dropdown-menu-entry.selected {
                border-radius: var(--map-card-internal-big-radius);
                background-color: var(--map-card-internal-primary-color);
                color: var(--map-card-internal-primary-text-color);
            }

            .modes-dropdown-menu-entry-button-wrapper.first:not(.selected) {
                border-top-left-radius: var(--map-card-internal-big-radius);
                border-top-right-radius: var(--map-card-internal-big-radius);
            }

            .modes-dropdown-menu-entry-button-wrapper.last:not(.selected) {
                border-bottom-left-radius: var(--map-card-internal-big-radius);
                border-bottom-right-radius: var(--map-card-internal-big-radius);
            }

            .modes-dropdown-menu-entry-button.selected {
                border-start-start-radius: var(--map-card-internal-big-radius);
                border-end-start-radius: var(--map-card-internal-big-radius);
                background-color: var(--map-card-internal-primary-color);
                color: var(--map-card-internal-primary-text-color);
            }

            .modes-dropdown-menu-entry-button-wrapper {
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
                overflow: hidden;
            }

            .modes-dropdown-menu-entry-button {
                width: 50px;
                height: 50px;
                display: flex;
                justify-content: center;
                align-items: center;
                background-color: var(--map-card-internal-secondary-color);
                color: var(--map-card-internal-secondary-text-color);
            }

            .modes-dropdown-menu-entry-text {
                display: inline-flex;
                line-height: 50px;
                background-color: transparent;
                padding-left: 10px;
                padding-right: 15px;
            }

            .modes-dropdown-menu-listbox {
                padding: 0;
                background-color: transparent;
            }
        `;
    }
}
