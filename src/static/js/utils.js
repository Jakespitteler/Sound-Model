/** @fileoverview DOM helpers shared by the small UI modules. */

/** @param {string} id Element identifier. @return {HTMLElement} Required element. */
export const $ = id => document.getElementById(id);

/** @param {*} value Untrusted text. @return {string} Escaped text/attribute content. */
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

/** @return {string} Random stable entity identifier. */
export const uuid = () => crypto.randomUUID();

/** @param {?number} value Receiver level. @return {string} Labelled result HTML. */
export const formatDb = value => value === null ? 'No source contribution' : `${value.toFixed(1)} <small>dB(A)</small>`;
