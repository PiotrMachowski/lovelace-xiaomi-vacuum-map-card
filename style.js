const LitElement = Object.getPrototypeOf(
    customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;

const style = html`
<style>
  #xiaomiCard {
      overflow: hidden;
  }
  #mapWrapper {
      width: auto;
  }
  #map {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
  }
  #mapBackground {
      position: absolute;
      z-index: 1;
      width: 100%;
      height: 100%;
      left: 0;
      top: 0;
  }
  #mapDrawing {
      width: 100%;
      height: 100%;
      position: absolute;
      z-index: 2;
      left: 0;
      top: 0;
      touch-action: none;
  }
  .dropdownWrapper {
      margin-left: 10px;
      margin-right: 10px;
  }
  .vacuumDropdown {
      width: 100%;  
  }
  .buttonsWrapper {
      margin: 5px;
  }
  #zonedButtonsWrapper {
      margin: 5px;
  }
  .vacuumButton {
      margin: 5px;
  }
  .vacuumButton.checked {
      background-color: var(--disabled-text-color);
      border-radius: var(--lumo-border-radius);
  }
  .vacuumRunButton {
      margin: 5px;
      float: right;
  }
</style>`;

export default style;