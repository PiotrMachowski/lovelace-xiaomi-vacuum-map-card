import { LitElement } from "lit";

export abstract class RootlessLitElement extends LitElement {

    protected createRenderRoot(): Element | ShadowRoot {
        return this;
    }

}
