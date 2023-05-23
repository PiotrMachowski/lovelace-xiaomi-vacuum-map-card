import { html, TemplateResult } from "lit";
import { conditional } from "../utils";


interface DropdownEntry {
    icon: string;
    name: string;
}

export abstract class DropdownMenuRenderer {

    protected static _render<T extends DropdownEntry>(
        values: T[],
        currentIndex: number,
        setValue: (_: number) => void,
        menu: HTMLElement | undefined,
        classPrefix: string,
        renderNameCollapsed: boolean,
    ): TemplateResult {
        const currentValue = values[currentIndex];
        return html`
            <ha-button-menu class="${classPrefix}-dropdown-menu" fixed="true" activatable @closed="${(e: Event) => e.stopPropagation()}"
                @click="${() => DropdownMenuRenderer.updateStyles(menu, values.length)}">
                <div class="${classPrefix}-dropdown-menu-button" slot="trigger" alt="bottom align">
                    <paper-button class="${classPrefix}-dropdown-menu-button-button">
                        <ha-icon icon="${currentValue.icon}" class="dropdown-icon"></ha-icon>
                    </paper-button>
                    ${conditional(
                        renderNameCollapsed, 
                        () => html`<div class="${classPrefix}-dropdown-menu-button-text">${currentValue.name}</div>`
                    )}
                </div>
                ${values.map(
                    (mode, index) => html` <mwc-list-item class="${classPrefix}-dropdown-list-item"
                        ?activated="${currentIndex === index}"
                        @click="${(): void => setValue(index)}">
                        <div class="${classPrefix}-dropdown-menu-entry clickable ${currentIndex === index ? "selected" : ""}">
                            <div
                                class="${classPrefix}-dropdown-menu-entry-button-wrapper ${index === 0
                                    ? "first"
                                    : ""} ${index === values.length - 1 ? "last" : ""} ${currentIndex === index
                                    ? "selected"
                                    : ""}">
                                <paper-button
                                    class="${classPrefix}-dropdown-menu-entry-button ${currentIndex === index ? "selected" : ""}">
                                    <ha-icon icon="${mode.icon}"></ha-icon>
                                </paper-button>
                            </div>
                            <div class="${classPrefix}-dropdown-menu-entry-text">${mode.name}</div>
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
}
