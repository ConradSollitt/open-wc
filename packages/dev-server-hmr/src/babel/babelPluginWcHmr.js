/** @typedef {import('@babel/types').ImportDefaultSpecifier} ImportDefaultSpecifier */
/** @typedef {import('@babel/types').ImportNamespaceSpecifier} ImportNamespaceSpecifier */
/** @typedef {import('@babel/types').ImportSpecifier} ImportSpecifier */
/** @typedef {import('@babel/core').PluginObj} PluginObj */
/** @template T @typedef {import('@babel/core').NodePath<T>} NodePath<T> */

/**
 * @typedef {object} BabelPluginWcHmrOptions
 * @property {BaseClass[]} baseClasses
 * @property {string} rootDir
 */

/**
 * @typedef {object} BaseClass
 * @property {string} name
 * @property {string} [import]
 * @property {string} [patch]
 */
const { parse, types: t } = require('@babel/core');
const path = require('path');
const { WC_HMR_NAMESPACE, WC_HMR_MODULE_PATCHES, WC_HMR_MODULE_RUNTIME } = require('../constants');
const { createError } = require('../utils');

/**
 * @param {BabelPluginWcHmrOptions} options
 * @returns {BabelPluginWcHmrOptions}
 */
function parseOptions(options) {
  if (!options) throw createError('Missing babel plugin options');
  if (!options.rootDir) throw createError('Missing rootDir in babel plugin options');
  if (!options.baseClasses) throw createError('Missing baseClass options in babel plugin');
  if (!Array.isArray(options.baseClasses)) throw createError('baseClass option should be an array');
  return {
    ...options,
    baseClasses: options.baseClasses.map(base => {
      if (!base.name) {
        throw createError('Missing name option in base class');
      }
      if (!base.import) {
        return base;
      }
      return {
        ...base,
        import: base.import.startsWith('./')
          ? // resolve a relative import path relative to working directory
            path.resolve(base.import.split('/').join(path.sep))
          : base.import,
      };
    }),
  };
}

/**
 * @template T
 * @param {NodePath<T>} nodePath
 * @param {string} name
 */
function injectRegister(nodePath, name) {
  const toInject = parse(`${WC_HMR_NAMESPACE}.register(import.meta.url, ${name})`);
  if (!toInject) throw new TypeError('Failed to parse');
  nodePath.insertAfter(toInject);
}

/**
 * @param {NodePath<any>} nodePath
 * @returns {NodePath<any> | undefined}
 */
function walkClassMixins(nodePath) {
  let el = nodePath.node.superClass;
  // walk possible mixin functions
  while (el && t.isCallExpression(el)) {
    [el] = el.arguments;
  }
  return el;
}

/**
 * @param {BaseClass[]} baseClasses
 * @param {string} importSpecifier
 * @param {string} filename
 * @param {string} rootDir
 * @return {{ baseClass: BaseClass, i: number }[]}
 */
function getBaseClassesForImport(baseClasses, importSpecifier, filename, rootDir) {
  return baseClasses
    .map((baseClass, i) => ({ baseClass, i }))
    .filter(({ baseClass }) => {
      if (!baseClass.import) {
        return false;
      }

      if (importSpecifier.startsWith('./') || importSpecifier.startsWith('/')) {
        // this is a non-bare import
        const partialImportFilePath = importSpecifier.split('/').join(path.sep);
        const joinBase = importSpecifier.startsWith('/') ? rootDir : path.dirname(filename);
        const importFilePath = path.join(joinBase, partialImportFilePath);
        return importFilePath === baseClass.import;
      }

      // this is a bare import
      if (baseClass.import === importSpecifier) {
        return true;
      }

      if (!path.extname(baseClass.import) && `${baseClass.import}.js` === importSpecifier) {
        return true;
      }

      return false;
    });
}

/**
 * @param {BaseClass[]} baseClasses
 * @param {(ImportDefaultSpecifier | ImportNamespaceSpecifier | ImportSpecifier)[]} specifiers
 */
function getImportedBaseClassNames(baseClasses, specifiers) {
  /** @type {string[]} */
  const names = [];

  for (const specifier of specifiers) {
    if (t.isImportDefaultSpecifier(specifier)) {
      if (baseClasses.some(cl => cl.name === 'default')) {
        names.push(specifier.local.name);
      }
    } else if (t.isImportSpecifier(specifier)) {
      const imported = t.isIdentifier(specifier.imported)
        ? specifier.imported.name
        : specifier.imported.value;
      if (baseClasses.some(cl => cl.name === imported)) {
        names.push(specifier.local.name);
      }
    }
  }
  return names;
}

/**
 * @returns {PluginObj}
 */
function babelPluginWcHmr() {
  return {
    visitor: {
      Program(program) {
        if (!this.filename) throw createError('Missing filename');
        const resolvedFilename = path.resolve(this.filename);
        const options = parseOptions(/** @type {BabelPluginWcHmrOptions} */ (this.opts));

        /** @type {string[]} */
        const baseClassNames = [];
        /** @type {string[]} */
        const baseClassPatches = [];
        let injectedRegister = false;

        // collect all base classes we should match without an import
        for (const b of options.baseClasses) {
          if (!b.import) {
            baseClassNames.push(b.name);
          }
        }

        program.traverse({
          ImportDeclaration(nodePath) {
            const importSpecifier = nodePath.node.source.value;
            const baseClassesForImport = getBaseClassesForImport(
              options.baseClasses,
              importSpecifier,
              resolvedFilename,
              options.rootDir,
            );
            const baseClassNamesForImport = getImportedBaseClassNames(
              baseClassesForImport.map(b => b.baseClass),
              nodePath.node.specifiers,
            );
            baseClassNames.push(...baseClassNamesForImport);
            baseClassPatches.push(
              .../** @type {string[]} */ baseClassesForImport
                .filter(b => b.baseClass.patch)
                .map(b => `${b.i}`),
            );
          },
        });

        program.traverse({
          ClassDeclaration(nodePath) {
            if (!nodePath.node.id || !t.isIdentifier(nodePath.node.id)) {
              return;
            }
            const el = walkClassMixins(nodePath);
            if (el && t.isIdentifier(el)) {
              if (baseClassNames.some(name => name === el.name)) {
                injectRegister(nodePath, nodePath.node.id.name);
                injectedRegister = true;
              }
            }
          },

          ClassExpression(nodePath) {
            const { parent, parentPath } = nodePath;
            if (!parent || !t.isVariableDeclarator(parent) || !t.isIdentifier(parent.id)) {
              return;
            }

            if (!parentPath || !t.isVariableDeclaration(parentPath.parent)) {
              return;
            }

            const injectScope = parentPath.parentPath;
            if (!injectScope) {
              return;
            }

            // this is a class expression assignment like const A = class B {}
            const el = walkClassMixins(nodePath);
            if (el && t.isIdentifier(el)) {
              if (baseClassNames.some(name => name === el.name)) {
                injectRegister(injectScope, parent.id.name);
                injectedRegister = true;
              }
            }
          },
        });

        if (injectedRegister) {
          const patches = baseClassPatches
            .map(patch => `import '${WC_HMR_MODULE_PATCHES}${patch}.js';`)
            .join('\n');
          const toInject = parse(
            `${patches}import * as ${WC_HMR_NAMESPACE} from '${WC_HMR_MODULE_RUNTIME}';\nif(import.meta.hot) { import.meta.hot.accept(() => { }) }`,
          );

          if (toInject) {
            program.node.body.unshift(/** @type {any} */ (toInject));
          }
        }
      },
    },
  };
}

module.exports = babelPluginWcHmr;
