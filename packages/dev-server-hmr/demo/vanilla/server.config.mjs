import path from 'path';
import { fileURLToPath } from 'url';
import { hmrPlugin } from '../../index.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  open: 'demo/vanilla/',
  plugins: [
    hmrPlugin({
      exclude: ['**/*/node_modules/**/*'],
      baseClasses: [
        { name: 'HTMLElement' },
        { name: 'SharedElement', import: path.resolve(dirname, './src/SharedElement.js') },
      ],
    }),
  ],
};
