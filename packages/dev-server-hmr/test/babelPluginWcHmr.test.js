/* eslint-disable import/no-extraneous-dependencies */
const { expect } = require('chai');
const { transformSync } = require('@babel/core');
const babelPluginWcHmr = require('../src/babel/babelPluginWcHmr');

/**
 * @param {string} code
 * @returns {string}
 */
function transform(code, baseClasses = [{ name: 'HTMLElement' }]) {
  return transformSync(code, {
    babelrc: false,
    configFile: false,
    filename: '/root/projects/my-project/src/foo.js',
    plugins: [[babelPluginWcHmr, { baseClasses, rootDir: '/root/projects/my-project/' }]],
  }).code;
}

const banner = `import * as __$wc_hmr$__ from '/__web-dev-server__/wc-hmr/runtime.js';

if (import.meta.hot) {
  import.meta.hot.accept(() => {});
}
`;

describe('babelPluginWcHmr', () => {
  it('injects registration when extending a global', () => {
    const code = `class Foo extends HTMLElement {}`;
    const result = transform(code);
    expect(result).to.equal(
      `${banner}
class Foo extends HTMLElement {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('injects registration when using a mixin', () => {
    const code = `class Foo extends MyMixin(HTMLElement) {}`;
    const result = transform(code);
    expect(result).to.equal(
      `${banner}
class Foo extends MyMixin(HTMLElement) {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('injects registration when using multiple mixins', () => {
    const code = `class Foo extends OtherMixin(MyMixin(HTMLElement)) {}`;
    const result = transform(code);
    expect(result).to.equal(
      `${banner}
class Foo extends OtherMixin(MyMixin(HTMLElement)) {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('injects multiple registrations', () => {
    const code = `class A extends HTMLElement {}
class B extends HTMLElement {}
class C extends HTMLElement {}`;
    const result = transform(code);
    expect(result).to.equal(
      `${banner}
class A extends HTMLElement {}

__$wc_hmr$__.register(import.meta.url, A);

class B extends HTMLElement {}

__$wc_hmr$__.register(import.meta.url, B);

class C extends HTMLElement {}

__$wc_hmr$__.register(import.meta.url, C);`,
    );
  });

  it('handles class declaration outside the root scope', () => {
    const code = `{ class A extends HTMLElement {} }

function myFunction() {
  class B extends HTMLElement {}
}

class NotAnElement {
  constructor() {
    class C extends HTMLElement {}
  }
}
`;
    const result = transform(code);
    expect(result).to.equal(`${banner}
{
  class A extends HTMLElement {}

  __$wc_hmr$__.register(import.meta.url, A);
}

function myFunction() {
  class B extends HTMLElement {}

  __$wc_hmr$__.register(import.meta.url, B);
}

class NotAnElement {
  constructor() {
    class C extends HTMLElement {}

    __$wc_hmr$__.register(import.meta.url, C);
  }

}`);
  });

  it('handles class expression assign to variables', () => {
    const code = `const A = class B extends HTMLElement {};`;
    const result = transform(code);
    expect(result).to.equal(`${banner}
const A = class B extends HTMLElement {};

__$wc_hmr$__.register(import.meta.url, A);`);
  });

  it('does not trip over classes in unsupported locations', () => {
    const code = `const foo = [class A extends HTMLElement {}, class B extends HTMLElement {}];
console.log(class C extends HTMLElement {});

function bar(x = class D extends HTMLElement {}) {}`;
    const result = transform(code);
    expect(result).to.equal(code);
  });

  it('can inject based on imported symbol', () => {
    const code = `import { LitElement } from 'lit-element';class Foo extends LitElement {}`;
    const result = transform(code, [{ name: 'LitElement', import: 'lit-element' }]);
    expect(result).to.equal(
      `${banner}
import { LitElement } from 'lit-element';

class Foo extends LitElement {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('handles renamed symbols', () => {
    const code = `import { MyElement as Bar } from 'my-package';class Foo extends Bar {}`;
    const result = transform(code, [{ name: 'MyElement', import: 'my-package' }]);
    expect(result).to.equal(
      `${banner}
import { MyElement as Bar } from 'my-package';

class Foo extends Bar {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('handles default imports', () => {
    const code = `import MyElement from 'my-package';class Foo extends MyElement {}`;
    const result = transform(code, [{ name: 'default', import: 'my-package' }]);
    expect(result).to.equal(
      `${banner}
import MyElement from 'my-package';

class Foo extends MyElement {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('handles multiple base classes from a single import', () => {
    const code = `import A, { B, C } from 'my-package';
class Foo extends A {}
class Bar extends B {}
class Baz extends C {}`;
    const result = transform(code, [
      { name: 'default', import: 'my-package' },
      { name: 'A', import: 'my-package' },
      { name: 'B', import: 'my-package' },
      { name: 'C', import: 'my-package' },
    ]);
    expect(result).to.equal(`${banner}
import A, { B, C } from 'my-package';

class Foo extends A {}

__$wc_hmr$__.register(import.meta.url, Foo);

class Bar extends B {}

__$wc_hmr$__.register(import.meta.url, Bar);

class Baz extends C {}

__$wc_hmr$__.register(import.meta.url, Baz);`);
  });

  it('does not handle unspecified elements', () => {
    const code = `import { B } from 'my-package';
class Foo extends A {}
class Bar extends B {}
class Baz extends NotHTMLElement {}`;
    const result = transform(code, [
      { name: 'HTMLElement', import: 'my-package' },
      { name: 'A', import: 'my-package' },
    ]);

    expect(result).to.equal(`import { B } from 'my-package';

class Foo extends A {}

class Bar extends B {}

class Baz extends NotHTMLElement {}`);
  });

  // filename: '/root/projects/my-project/src/foo.js',

  it('can inject based on a local base class', () => {
    const code = `import { MyBaseClass } from './my-base-class.js';class Foo extends MyBaseClass {}`;
    const result = transform(code, [
      { name: 'MyBaseClass', import: '/root/projects/my-project/src/my-base-class.js' },
    ]);

    expect(result).to.equal(
      `${banner}
import { MyBaseClass } from './my-base-class.js';

class Foo extends MyBaseClass {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });

  it('can inject a base class patch', () => {
    const code = `import { MyBaseClass } from 'my-package';class Foo extends MyBaseClass {}`;
    const result = transform(code, [
      { name: 'MyBaseClass', import: 'my-package', patch: { name: 'my-patch', code: '...' } },
    ]);

    expect(result).to.equal(
      `import '/__web-dev-server__/wc-hmr/patch/0.js';
${banner}
import { MyBaseClass } from 'my-package';

class Foo extends MyBaseClass {}

__$wc_hmr$__.register(import.meta.url, Foo);`,
    );
  });
});
