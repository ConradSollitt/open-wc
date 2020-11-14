export class SharedElement extends HTMLElement {
  static styles() {
    return `
      .shared { color: blue; }
    `;
  }

  static template() {
    return `
      <p class="shared">Shared Template</p>
    `;
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (super.connectedCallback) {
      super.connectedCallback();
    }
    this.render();
  }

  hotReplaceCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.constructor.styles()}</style>
      ${this.constructor.template()}
    `;
  }
}
