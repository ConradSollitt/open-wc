import { SharedElement } from './SharedElement.js';

class ComponentB extends SharedElement {
  static styles() {
    return `
      ${super.styles()}
      .body { color: yellow }
    `;
  }

  static template() {
    return `
      ${super.template()}
      <p class="body">Component A</p>
    `;
  }
}

customElements.define('component-b', ComponentB);
