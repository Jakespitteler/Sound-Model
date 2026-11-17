/** @fileoverview One shared level scale for contours, receiver readings and the sound guide. */

const STOPS = [
  [20, [37, 103, 149]],
  [35, [36, 119, 88]],
  [50, [151, 105, 17]],
  [65, [180, 57, 41]],
  [80, [133, 43, 91]],
];

/**
 * Map a sound-pressure level to a stable cool-to-warm colour, not a compliance verdict.
 * @param {?number} level Predicted dB(A), or null for no contribution/unavailable.
 * @return {string} CSS hex colour shared across all presentations of that level.
 */
export function soundColor(level) {
  if (level === null || !Number.isFinite(level)) return '#697773';
  const value = Math.max(20, Math.min(80, level));
  const index = Math.min(STOPS.length - 2, Math.floor((value - 20) / 15));
  const [low, a] = STOPS[index], [high, b] = STOPS[index + 1];
  const fraction = (value - low) / (high - low);
  return '#' + a.map((channel, i) => Math.round(channel + (b[i] - channel) * fraction).toString(16).padStart(2, '0')).join('');
}
