import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { conditional } from "../utils";
import { customElement, property, query } from "lit/decorators";
import { RootlessLitElement } from "./rootless-lit-element";

interface DropdownEntry {
    icon: string;
    name: string;
}

@customElement("xvmc-dropdown-menu")
export class DropdownMenu<T extends DropdownEntry> extends RootlessLitElement {

    @property({ attribute: false })
    private values!: T[];

    @property({ attribute: false })
    private currentIndex!: number;

    @property({ attribute: false })
    private setValue!: (_: number) => void;

    @property({ attribute: false })
    private renderNameCollapsed!: boolean;

    @property({ attribute: false })
    private additionalClasses: string[] = [];

    @query(".dropdown-menu")
    private menu: HTMLElement | undefined;

    public render(): TemplateResult {
        const currentValue = this.values[this.currentIndex];
        return html`
            <ha-button-menu class="dropdown-menu ${this.additionalClasses.join(" ")}" fixed="true" activatable
                            @closed="${(e: Event) => e.stopPropagation()}"
                            @click="${() => this.updateStyles(this.values.length)}">
                <div class="dropdown-menu-button clickable" slot="trigger" alt="bottom align">
                    <paper-button class="dropdown-menu-button-button">
                        <ha-icon icon="${currentValue.icon}" class="dropdown-icon"></ha-icon>
                    </paper-button>
                    ${conditional(
                        this.renderNameCollapsed,
                        () => html`
                            <div class="dropdown-menu-button-text">${currentValue.name}</div>`
                    )}
                </div>
                ${this.values.map(
                    (mode, index) => html`
                        <mwc-list-item class="dropdown-list-item"
                                       ?activated="${this.currentIndex === index}"
                                       @click="${(): void => this.setValue(index)}">
                            <div
                                class="dropdown-menu-entry clickable ${this.currentIndex === index ? "selected" : ""}">
                                <div
                                    class="dropdown-menu-entry-button-wrapper ${index === 0
                                        ? "first"
                                        : ""} ${index === this.values.length - 1 ? "last" : ""} ${this.currentIndex === index
                                        ? "selected"
                                        : ""}">
                                    <paper-button
                                        class="dropdown-menu-entry-button ${this.currentIndex === index ? "selected" : ""}">
                                        <ha-icon icon="${mode.icon}"></ha-icon>
                                    </paper-button>
                                </div>
                                <div class="dropdown-menu-entry-text">${mode.name}</div>
                            </div>
                        </mwc-list-item>`,
                )}
            </ha-button-menu>
        `;
    }

    private updateStyles(items: number): void {
        const div = this.menu?.shadowRoot?.querySelector("div") as HTMLElement;
        if (this.menu && div) {
            const height = 50;
            const minDiff = (items - 1) * height + 32;
            if (window.innerHeight - div.getBoundingClientRect().bottom >= minDiff) {
                div.style.marginTop = `0px`;
                this.menu.style.marginTop = `0px`;
                div.style.marginBottom = `-${height}px`;
                this.menu.style.marginBottom = `${height}px`;
            } else {
                div.style.marginTop = `-${height}px`;
                this.menu.style.marginTop = `${height}px`;
                div.style.marginBottom = "0px";
                this.menu.style.marginBottom = "0px";
            }
            const mwcMenu = this.menu.shadowRoot?.querySelector("mwc-menu") as HTMLElement;
            if (mwcMenu) {
                mwcMenu.style.zIndex = "1";
                mwcMenu.style.position = "fixed";
            }
            this.menu.querySelectorAll("mwc-list-item").forEach((item) => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                item.shadowRoot!.querySelector("span")!.style.flexGrow = "1";
            });
        }
    }

    public static get styles(): CSSResultGroup {
        return css`
          .dropdown-menu {
            --mdc-menu-item-height: 50px;
            --mdc-theme-primary: transparent;
            --mdc-list-vertical-padding: 0px;
            --mdc-list-side-padding: 0px;
            --mdc-shape-medium: var(--map-card-internal-big-radius);
            --mdc-ripple-color: transparent;
          }

          .dropdown-menu-button {
            display: inline-flex;
          }

          .dropdown-list-item:host:host {
            flex-grow: 1;
          }

          .dropdown-menu-button-button {
            width: 50px;
            height: 50px;
            border-radius: var(--map-card-internal-big-radius);
            display: flex;
            justify-content: center;
            background-color: var(--map-card-internal-primary-color);
            align-items: center;
          }

          .dropdown-menu-button-text {
            display: inline-flex;
            line-height: 50px;
            background-color: transparent;
            padding-left: 10px;
            padding-right: 15px;
          }

          .dropdown-menu-entry {
            display: inline-flex;
            width: 100%;
          }

          .dropdown-menu-entry.selected {
            border-radius: var(--map-card-internal-big-radius);
            background-color: var(--map-card-internal-primary-color);
            color: var(--map-card-internal-primary-text-color);
          }

          .dropdown-menu-entry-button-wrapper.first:not(.selected) {
            border-top-left-radius: var(--map-card-internal-big-radius);
            border-top-right-radius: var(--map-card-internal-big-radius);
          }

          .dropdown-menu-entry-button-wrapper.last:not(.selected) {
            border-bottom-left-radius: var(--map-card-internal-big-radius);
            border-bottom-right-radius: var(--map-card-internal-big-radius);
          }

          .dropdown-menu-entry-button.selected {
            border-start-start-radius: var(--map-card-internal-big-radius);
            border-end-start-radius: var(--map-card-internal-big-radius);
            background-color: var(--map-card-internal-primary-color);
            color: var(--map-card-internal-primary-text-color);
          }

          .dropdown-menu-entry-button-wrapper {
            background-color: var(--map-card-internal-secondary-color);
            color: var(--map-card-internal-secondary-text-color);
            overflow: hidden;
          }

          .dropdown-menu-entry-button {
            width: 50px;
            height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: var(--map-card-internal-secondary-color);
            color: var(--map-card-internal-secondary-text-color);
          }

          .dropdown-menu-entry-text {
            display: inline-flex;
            line-height: 50px;
            background-color: transparent;
            padding-left: 10px;
            padding-right: 15px;
          }

          .dropdown-menu-listbox {
            padding: 0;
            background-color: transparent;
          }
        `;
    }
}