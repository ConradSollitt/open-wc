import { hmrPlugin, litElementPatch } from '../../index.mjs';

export default {
  open: 'packages/dev-server-hmr/demo/lit/',
  rootDir: '../..',
  plugins: [
    hmrPlugin({
      exclude: ['**/*/node_modules/**/*'],
      baseClasses: [{ name: 'LitElement', import: 'lit-element', patch: litElementPatch }],
    }),
  ],
};
