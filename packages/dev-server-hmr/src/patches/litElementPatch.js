const { WC_HMR_MODULE_RUNTIME } = require('../constants');

const litElementPatch = `// @ts-nocheck
import { LitElement } from 'lit-element';
import { updateClassMembers } from '${WC_HMR_MODULE_RUNTIME}';

// static callback
LitElement.hotReplaceCallback = function hotReplaceCallback(newClass) {
  newClass.finalize();
  updateClassMembers(this, newClass);
  this.finalize();
};

// instance callback
LitElement.prototype.hotReplaceCallback = function hotReplaceCallback() {
  this.constructor._getUniqueStyles();
  if (window.ShadowRoot && this.renderRoot instanceof window.ShadowRoot) {
    this.adoptStyles();
  }
  this.requestUpdate();
};`;

module.exports = { litElementPatch };
