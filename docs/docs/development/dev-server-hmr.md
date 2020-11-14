# Development >> Dev Server HMR ||50

> This project is currently experimental. Try it out and let us know what you think!

Plugin for "hot module replacement" or "fast refresh" with web components.

Keeps track of web component definitions in your code, and updates them at runtime on change. This is faster than a full page reload and preserves the page's state.

HMR requires a base class to implement a `hotReplaceCallback`.

## Installation

Install the package:

```
npm i --save-dev @web/dev-server-hmr
```

Add the plugin to your `web-dev-server-config.mjs`:

```js
import { hmrPlugin } from '@open-wc/dev-server-hmr';

export default {
  plugins: [
    hmrPlugin({
      include: ['src/**/*'],
      baseClasses: [{ name: 'MyElement', import: 'my-element' }],
    }),
  ],
};
```

## Base classes

The base classes option specifies which base classes to inject HMR code into.

### Name only

When only the name is given, it will match any element extending a base element with that name.

```js
hmrPlugin({
  include: ['src/**/*'],
  baseClasses: [{ name: 'HTMLElement' }],
});
```

### Bare import

The import option specifies which module the base class should be imported from.

```js
hmrPlugin({
  include: ['src/**/*'],
  baseClasses: [{ name: 'MyElement', import: 'my-element' }],
});
```

```js
import { MyElement } from 'my-element';

class ElementA extends MyElement {}
```

For a default import, set `default` as name:

```js
hmrPlugin({
  include: ['src/**/*'],
  baseClasses: [{ name: 'default', import: 'my-element' }],
});
```

### Local base class

If you are using a local base class, the import can specify the path to the module:

```js
hmrPlugin({
  include: ['src/**/*'],
  baseClasses: [{ name: 'MyElement', import: './src/MyElement.js' }],
});
```

### Multiple base classes

```js
hmrPlugin({
  include: ['src/**/*'],
  baseClasses: [
    { name: 'HTMLElement' },
    {
      name: 'MyElement',
      import: './src/MyElement.js',
    },
  ],
});
```

## Implementations

### HTMLElement

If you extend `HTMLElement` directly in your code you can add support for HMR by implementing the `hotReplaceCallback`.

For simple elements, this can be a call to an `update` or `render` function.

See the [Implementing HMR section](#Implementing%20HMR)

Code:

```js
export class MyElement extends HTMLElement {
  hotReplaceCallback() {
    this.update();
  }
}
```

Config:

```js
import { hmrPlugin, litElementPatch } from '@open-wc/dev-server-hmr';

export default {
  plugins: [
    hmrPlugin({
      include: ['src/**/*'],
      baseClasses: [{ name: 'HTMLElement' }, { name: 'MyElement', import: './src/MyElement.js' }],
    }),
  ],
};
```

### lit-element

`lit-element` does not support HMR out of the box. We ship a small code patch you can apply to support HMR.

```js
import { hmrPlugin, litElementPatch } from '@open-wc/dev-server-hmr';

export default {
  plugins: [
    hmrPlugin({
      include: ['src/**/*'],
      baseClasses: [{ name: 'LitElement', import: 'lit-element', patch: litElementPatch }],
    }),
  ],
};
```

## Limitations

HMR workflows are not perfect. We're overwriting and moving around code at runtime. It breaks assumptions you normally make about your code. It's recommended to periodically do a full refresh of the page, especially when you encounter strange behavior.

The following limitations should be kept in mind when working with open-wc HMR:

- Modules containing web components are re-run, but only the web component class is replaced. Side effects are triggered again, exported symbols are not updated.
- Constructors are not re-run when a class is replaced.
- Only edits to files that contain a web component definition trigger a hot replace. If a web component references HTML or CSS in other files they do not trigger a hot replace.

> Did you run into other limitations? Let us know so we can improve this list.

## Implementing HMR

When hot replacing a web component class we can't replace the actual class. The custom element registry doesn't allow re-registration and we want to preserve the state of already rendered components. Instead, we patch the initial class with the properties from the updates class.

This updating logic can be different for each base class, and it can be implemented using the `hotReplaceCallback`.

### Static callback

The static `hotReplaceCallback` callback is called once for each replacement on the initial class of the component. This is where you can copy over properties from the new class to the existing class.

Implementing this callback is not mandatory, by default we copy over properties of the new class to the existing class. If this is not sufficient, you can customize this logic.

This is the default implementation:

```js
function updateObjectMembers(currentObj, newObj) {
  const currentProperties = new Set(Object.getOwnPropertyNames(currentObj));
  const newProperties = new Set(Object.getOwnPropertyNames(newObj));
  for (const prop of Object.getOwnPropertyNames(newObj)) {
    const descriptor = Object.getOwnPropertyDescriptor(newObj, prop);
    if (descriptor && descriptor.configurable) {
      Object.defineProperty(currentObj, prop, descriptor);
    }
  }

  for (const existingProp of currentProperties) {
    if (!newProperties.has(existingProp)) {
      delete currentObj[existingProp];
    }
  }
}

class MyElement extends HTMLElement {
  static hotReplaceCallback(newClass) {
    updateObjectMembers(this, newClass);
    updateObjectMembers(this.prototype, newClass.prototype);
  }

  hotReplaceCallback() {
    this.update();
  }
}
```

### Instance callback

The instance callback is called on each connected element implementing the replaced class. Implementing this is necessary to do some work at the instance level, such as trigger a re-render or style update.

When the instance callback is called, all the class members (properties, methods, etc.) have already been updated. So it could be as simple as kicking off the regular updating/rendering pipeline. For example:

```js
class MyElement extends HTMLElement {
  hotReplaceCallback() {
    this.update();
  }
}
```

### Patching

If you don't want to include the HMR code in your production code, you could patch in the callbacks externally:

```js
import { MyElement } from 'my-element';

MyElement.hotReplaceCallback = function hotReplaceCallback(newClass) {
  // code for the static callback
};

MyElement.prototype.hotReplaceCallback = function hotReplaceCallback(newClass) {
  // code for the instance callback
};
```

Make sure this code is loaded before any of your components are loaded. You could also do this using the `patch` option in the config:

```js
import { hmrPlugin } from '@open-wc/dev-server-hmr';

const myElementPatch = `
import { MyElement } from 'my-element';

MyElement.hotReplaceCallback = function hotReplaceCallback(newClass) {
  // code for the static callback
};

MyElement.prototype.hotReplaceCallback = function hotReplaceCallback(newClass) {
  // code for the instance callback
};
`;

export default {
  plugins: [
    hmrPlugin({
      include: ['src/**/*'],
      baseClasses: [{ name: 'MyElement', import: 'my-element', patch: myElementPatch }],
    }),
  ],
};
```
