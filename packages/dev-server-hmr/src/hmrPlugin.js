/** @typedef {import('@web/dev-server-core').Plugin} DevServerPlugin */
/** @typedef {import('./utils').Matcher} Matcher */
/** @typedef {import('./babel/babelPluginWcHmr').BaseClass} BaseClass */
/**
 * @typedef {object} WcHmrPluginConfig
 * @property {string[]} [include]
 * @property {string[]} [exclude]
 * @property {BaseClass[]} baseClasses
 */

const { getRequestFilePath, PluginSyntaxError } = require('@web/dev-server-core');
const { hmrPlugin: createBaseHmrPlugin } = require('@web/dev-server-hmr');

const {
  WC_HMR_MODULE_PREFIX,
  WC_HMR_MODULE_RUNTIME,
  WC_HMR_MODULE_PATCHES,
} = require('./constants');
const { parseConfig, createMatchers, createError } = require('./utils');
const { babelTransform } = require('./babel/babelTransform');
const { wcHmrRuntime } = require('./wcHmrRuntime');

/**
 * @param {WcHmrPluginConfig} pluginConfig
 * @returns {DevServerPlugin}
 */
function hmrPlugin(pluginConfig) {
  const baseHmrPlugin = createBaseHmrPlugin();
  const parsedPluginConfig = parseConfig(pluginConfig);

  /** @type {string} */
  let rootDir;
  /** @type {Matcher} */
  let matchInclude = () => true;
  /** @type {Matcher} */
  let matchExclude = () => false;

  return {
    name: 'wc-hmr',
    injectWebSocket: true,

    resolveImport(...args) {
      const { source } = args[0];
      if (source.startsWith(WC_HMR_MODULE_PREFIX)) {
        return source;
      }

      return baseHmrPlugin.resolveImport?.(...args);
    },

    serve(...args) {
      const context = args[0];
      if (context.path === WC_HMR_MODULE_RUNTIME) {
        return wcHmrRuntime;
      }

      if (context.path.startsWith(WC_HMR_MODULE_PATCHES)) {
        const patchIndexString = context.path.substring(
          WC_HMR_MODULE_PATCHES.length,
          context.path.length - 3,
        );
        const patchIndex = Number(patchIndexString);
        const baseClass = parsedPluginConfig.baseClasses[patchIndex];
        if (!baseClass || !baseClass.patch) {
          throw createError(
            `Something went wrong while loading a base class patch. Can't find a patch with index ${patchIndex}, request path ${context.path}`,
          );
        }
        return baseClass.patch;
      }

      return baseHmrPlugin.serve?.(...args);
    },

    serverStart(...args) {
      if (args[0].config.plugins?.find(pl => pl.name === 'hmr')) {
        throw createError(
          `Cannot include both @web/dev-server-hmr and @open-wc/dev-server-hmr plugins.`,
        );
      }

      rootDir = args[0].config.rootDir;
      if (parsedPluginConfig.include) {
        matchInclude = createMatchers(rootDir, parsedPluginConfig.include);
      }

      if (parsedPluginConfig.exclude) {
        matchExclude = createMatchers(rootDir, parsedPluginConfig.exclude);
      }

      return baseHmrPlugin.serverStart?.(...args);
    },

    async transform(...args) {
      const context = args[0];
      if (!context.response.is('js')) {
        return;
      }

      const filePath = getRequestFilePath(context, rootDir);
      if (
        matchInclude(filePath) &&
        !matchExclude(filePath) &&
        !filePath.startsWith('__web-dev-server__')
      ) {
        try {
          context.body = await babelTransform(context.body, filePath, {
            baseClasses: parsedPluginConfig.baseClasses,
            rootDir,
          });
        } catch (error) {
          if (error.name === 'SyntaxError') {
            // forward babel error to dev server
            const strippedMsg = error.message.replace(new RegExp(`${filePath} ?:? ?`, 'g'), '');
            throw new PluginSyntaxError(strippedMsg, filePath, error.code, error.loc, error.pos);
          }
          throw error;
        }
      }

      return baseHmrPlugin.transform?.(...args);
    },

    // forward all other plugin hooks
    serverStop(...args) {
      return baseHmrPlugin.serverStop?.(...args);
    },
    transformCacheKey(...args) {
      return baseHmrPlugin.transformCacheKey?.(...args);
    },
    transformImport(...args) {
      return baseHmrPlugin.transformImport?.(...args);
    },
    resolveMimeType(...args) {
      return baseHmrPlugin.resolveMimeType?.(...args);
    },
  };
}

module.exports = { hmrPlugin };
