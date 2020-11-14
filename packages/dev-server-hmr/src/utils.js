const picoMatch = require('picomatch');
const { isAbsolute, posix, sep } = require('path');

/** @typedef {(path: string) => boolean} Matcher */

/**
 * @param {string} msg
 */
function createError(msg) {
  return new Error(`[@open-wc/dev-server-hmr] ${msg}`);
}

/**
 * @param {import('./hmrPlugin').WcHmrPluginConfig} config
 */
function parseConfig(config) {
  if (!Array.isArray(config.include) && !Array.isArray(config.exclude)) {
    throw createError('Must provide either an "include" or "exclude" pattern in config.');
  }
  if (!config.baseClasses) {
    throw createError('Must provide a baseClass option in config.');
  }

  for (const b of config.baseClasses) {
    if (!b.name) {
      throw createError('Must provide a baseclass name.');
    }
    if (b.patch != null && typeof b.patch !== 'string') {
      throw createError('Patch must be a string.');
    }
  }

  if (config.include && !Array.isArray(config.include)) {
    throw createError('Include option must be an array');
  }
  if (config.exclude && !Array.isArray(config.exclude)) {
    throw createError('Include option must be an array');
  }

  return { ...config };
}

/**
 * @param {string} rootDir
 * @param {string} pattern
 * @returns {Matcher}
 */
function createMatcher(rootDir, pattern) {
  const matcherRootDir = rootDir.split(sep).join('/');
  const resolvedPattern =
    !isAbsolute(pattern) && !pattern.startsWith('*')
      ? posix.join(matcherRootDir, pattern)
      : pattern;
  return picoMatch(resolvedPattern);
}

/**
 * @param {string} rootDir
 * @param {string[]} patterns
 * @returns {Matcher}
 */
function createMatchers(rootDir, patterns) {
  const matchers = patterns.map(p => createMatcher(rootDir, p));
  return function matcher(path) {
    return matchers.some(m => m(path));
  };
}

module.exports = { createMatcher, createMatchers, parseConfig, createError };
