/** @fileoverview Illustrated local sound references; not equipment or compliance data. */
import {$,escapeHtml} from './utils.js';
import {soundColor} from './sound-style.js';
import {SOUND_REFERENCE} from './sound-reference.js';
import {illustration} from './illustrations.js';

/** Render the same five levels used as default contours, with original illustrations. */
export function renderSoundGuide() {
  $('sound-key-levels').innerHTML = SOUND_REFERENCE.map(item=>`<li class="sound-card" style="--guide-color:${soundColor(item.level)}">
    <span class="guide-illustration">${illustration(item.icon)}</span><div class="guide-copy"><div class="guide-heading"><strong>${item.level}<small>dB(A)</small></strong><span>${escapeHtml(item.label)}</span></div>
    <p>${escapeHtml(item.description)}</p></div></li>`).join('');
  const narrow = matchMedia('(max-width:900px)');
  if (narrow.matches) $('sound-key').open = false;
  narrow.addEventListener('change',event=> { if (event.matches) $('sound-key').open = false; });
}
