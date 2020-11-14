const { hmrPlugin } = require('./hmrPlugin');
const { litElementPatch } = require('./patches/litElementPatch');
const { WC_HMR_MODULE_RUNTIME } = require('./constants');

module.exports = {
  hmrPlugin,
  litElementPatch,
  WC_HMR_MODULE_RUNTIME,
};
