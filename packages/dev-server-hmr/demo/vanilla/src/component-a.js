import { SharedElement } from './SharedElement.js';

class ComponentA extends SharedElement {
  static styles() {
    return `
      ${super.styles()}
      .body { color: red }
    `;
  }

  static template() {
    return `
      ${super.template()}
      <p class="body">Component A</p>
    `;
  }
}

customElements.define('component-a', ComponentA);
