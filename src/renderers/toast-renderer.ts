import { css, CSSResultGroup, html, TemplateResult } from "lit";
import { delay } from "../utils";

export class ToastRenderer {
    public static render(idPrefix: string): TemplateResult {
        return html`
            <div id="${idPrefix}-toast" class="toast">
                <div id="${idPrefix}-toast-icon" class="toast-icon">
                    <ha-icon icon="mdi:check" style="vertical-align: center"></ha-icon>
                </div>
                <div id="${idPrefix}-toast-text" class="toast-text">Success!</div>
            </div>
        `;
    }

    public static showToast(
        shadowRoot: ShadowRoot | null,
        localize: (TranslatableString) => string,
        idPrefix: string,
        text: string,
        icon: string,
        successful: boolean,
        additionalText = "",
        timeout = 2000,
    ): void {
        const toast = shadowRoot?.getElementById(`${idPrefix}-toast`);
        const toastText = shadowRoot?.getElementById(`${idPrefix}-toast-text`);
        const toastIcon = shadowRoot?.getElementById(`${idPrefix}-toast-icon`);
        if (toast && toastText && toastIcon) {
            toast.className += " show";
            toastText.innerText = localize(text) + (additionalText ? `\n${additionalText}` : "");
            toastIcon.children[0].setAttribute("icon", icon);
            toastIcon.style.color = successful
                ? "var(--map-card-internal-toast-successful-icon-color)"
                : "var(--map-card-internal-toast-unsuccessful-icon-color)";
            delay(timeout).then(() => (toast.className = toast.className.replace(" show", "")));
        }
    }

    public static get styles(): CSSResultGroup {
        return css`
            .toast {
                visibility: hidden;
                display: inline-flex;
                width: calc(100% - 60px);
                min-height: 50px;
                color: var(--primary-text-color);
                text-align: center;
                border-radius: var(--map-card-internal-small-radius);
                padding-inline-start: 30px;
                position: absolute;
                z-index: 1;
                bottom: 30px;
                font-size: 17px;
            }

            .toast-icon {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 50px;
                background-color: var(--map-card-internal-primary-color);
                border-start-start-radius: var(--map-card-internal-small-radius);
                border-end-start-radius: var(--map-card-internal-small-radius);
                color: #0f0;
            }

            .toast-text {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                padding-left: 10px;
                padding-right: 10px;
                -moz-box-sizing: border-box;
                -webkit-box-sizing: border-box;
                background-color: var(--paper-listbox-background-color);
                color: var(--primary-text-color);
                vertical-align: middle;
                overflow: hidden;
                border-color: var(--map-card-internal-primary-color);
                border-style: solid;
                border-width: 1px;
                border-start-end-radius: var(--map-card-internal-small-radius);
                border-end-end-radius: var(--map-card-internal-small-radius);
            }

            .toast.show {
                visibility: visible;
                -webkit-animation: fadein 0.5s, stay 1s 1s, fadeout 0.5s 1.5s;
                animation: fadein 0.5s, stay 1s 1s, fadeout 0.5s 1.5s;
            }

            @-webkit-keyframes fadein {
                from {
                    bottom: 0;
                    opacity: 0;
                }
                to {
                    bottom: 30px;
                    opacity: 1;
                }
            }
            @keyframes fadein {
                from {
                    bottom: 0;
                    opacity: 0;
                }
                to {
                    bottom: 30px;
                    opacity: 1;
                }
            }
            @-webkit-keyframes stay {
            }
            @keyframes stay {
            }
            @-webkit-keyframes fadeout {
                from {
                    bottom: 30px;
                    opacity: 1;
                }
                to {
                    bottom: 60px;
                    opacity: 0;
                }
            }
            @keyframes fadeout {
                from {
                    bottom: 30px;
                    opacity: 1;
                }
                to {
                    bottom: 60px;
                    opacity: 0;
                }
            }
        `;
    }
}
