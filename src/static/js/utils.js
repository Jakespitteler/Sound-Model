/** @fileoverview DOM helpers shared by the small UI modules. */

/** @param {string} id Element identifier. @return {HTMLElement} Required element. */
export const $ = id => document.getElementById(id);

/** @param {*} value Untrusted text. @return {string} Escaped text/attribute content. */
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));

let sequence = 0;

/**
 * Return a session-unique entity ID without requiring a secure-context browser API.
 * IDs are bookkeeping identifiers, never authentication tokens.
 * @return {string} Entity identifier unique within this in-memory session.
 */
export const uuid = () => `entity-${Date.now().toString(36)}-${++sequence}`;

/** @param {?number} value Receiver level. @return {string} Labelled result HTML. */
export const formatDb = value => value === null ? 'No source contribution' : `${value.toFixed(1)} <small>dB(A)</small>`;
