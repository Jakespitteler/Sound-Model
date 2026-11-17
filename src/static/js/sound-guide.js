/** @fileoverview A small local-flavour pressure-level guide, separate from equipment LwA. */
import {$} from './utils.js';
import {soundColor} from './sound-style.js';

/** Render deliberately approximate comparisons, not measurements or assessment criteria. */
export function renderSoundGuide() {
  const comparisons = [
    [30, 'Jarrah forest before the cockatoos clock on'],
    [40, 'A quiet South West campsite'],
    [60, 'Smoko chat — before the footy argument'],
    [80, 'A very committed cockatoo, up close'],
    [100, 'A crusher with no inside voice, nearby'],
  ];
  for (const [level, description] of comparisons) {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'sound-key-number';
    number.style.color = soundColor(level);
    number.textContent = `${level} dB`;
    const text = document.createElement('span');
    text.textContent = description;
    item.append(number,text); $('sound-key-levels').append(item);
  }
  const narrow = matchMedia('(max-width:900px)');
  if (narrow.matches) $('sound-key').open = false;
  narrow.addEventListener('change',event=> { if (event.matches) $('sound-key').open = false; });
}
