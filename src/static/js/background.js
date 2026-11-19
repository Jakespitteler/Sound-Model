/** @fileoverview One uniform background; display relevance is not an audibility test. */
const OFFSET_DB=10*Math.log10(Math.expm1(.1*Math.LN10/10));
/** @param {?number} background Background pressure in dB(A), or unset.
 * @return {?number} Machinery level at a 0.1 dB total increase. */
export const boundaryLevel=background=>background==null ? null : background+OFFSET_DB;
