/** @fileoverview Simple paired slider/number controls, automatically ordered by decibels. */
import {$,escapeHtml} from './utils.js';
import {soundColor} from './sound-style.js';

/** Contour presentation is automatic; only thresholds and level count are editable. */
export class ContoursUI {
  /**
   * @param {import('./state.js').ScenarioStore} store Scenario state.
   * @param {function(string):void} say Accessible status message writer.
   */
  constructor(store, say) { this.store = store; this.say = say; this.results = []; }

  /** Bind once; dragging a slider previews locally and commits on release. */
  bind() {
    $('add-contour').onclick = () => {
      if (this.store.contours.length >= 25) return this.say('Maximum 25 contour levels.');
      this.store.addContour(); this.render();
    };
    $('contours').addEventListener('input', event => {
      const input = event.target;
      if (input.type !== 'range') return;
      const row = input.closest('[data-contour-id]');
      row.querySelector('[type=number]').value = input.value;
      row.style.setProperty('--level-color', soundColor(input.valueAsNumber));
    });
    $('contours').addEventListener('change', event => {
      const input = event.target;
      if (!input.matches('input') || !input.checkValidity()) return;
      const accepted = this.store.updateContour(input.closest('[data-contour-id]').dataset.contourId,
        {level_db:input.valueAsNumber});
      if (!accepted) this.say('Each contour needs a different level between 0 and 300 dB(A).');
      else this.say('Contour updated. Levels are ordered from highest to lowest.');
      this.render();
    });
    $('contours').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-contour]'); if (!button) return;
      this.store.removeContour(button.dataset.removeContour); this.render();
    });
  }

  /** Render compact level rows. Sliders span the same 0–300 range as numeric input. */
  render() {
    $('contour-count').textContent = String(this.store.contours.length);
    $('contours').innerHTML = [...this.store.contours].sort((a,b)=>b.level_db-a.level_db).map(c =>
      `<div class="contour-row" data-contour-id="${c.id}" style="--level-color:${soundColor(c.level_db)}">
      <span class="level-swatch" aria-hidden="true"></span>
      <input type="range" data-field="level_db" min="0" max="300" step="0.1" value="${c.level_db}" aria-label="Slide ${c.level_db} dB contour level">
      <label class="level-number"><input type="number" data-field="level_db" min="0" max="300" step="0.1" value="${c.level_db}" aria-label="${c.level_db} dB contour level" required><span>dB(A)</span></label>
      <button class="danger remove-level" type="button" data-remove-contour="${c.id}" aria-label="Remove ${c.level_db} dB contour">×</button></div>`
    ).join('') || '<p class="empty">No contours. Add a level to see a line on the map.</p>';
    this.renderStatus();
  }

  /** @param {import('./types.js').ContourGeometry[]} results Per-level successes/failures. */
  setResults(results) { this.results = results; this.renderStatus(); }

  /** Identify failed and empty levels beside their inputs without rebuilding focused fields. */
  renderStatus() {
    document.querySelectorAll('.contour-level-status').forEach(element=>element.remove());
    for (const row of document.querySelectorAll('[data-contour-id]')) {
      const current = this.store.contours.find(c=>c.id===row.dataset.contourId);
      const result = this.results.find(c=>c.level_db===current.level_db);
      row.classList.toggle('contour-failed',result?.status==='failed');
      if (result?.status==='failed' || result?.status==='empty') {
        const status = document.createElement('span'); status.className='contour-level-status';
        status.textContent=result.status==='failed' ? 'Failed' : 'No crossing';
        status.title=result.error || 'No contour at this level for the current sources.';
        row.append(status);
      }
    }
    const failures=this.results.filter(c=>c.status==='failed');
    $('contour-errors').innerHTML=failures.map(c=>`<p><strong>${c.level_db} dB(A) failed</strong><br>${escapeHtml(c.error)}</p>`).join('');
    $('contour-alert').hidden=!failures.length;
    $('contour-alert').textContent=failures.length ? `${failures.map(c=>c.level_db+' dB(A)').join(', ')} failed · view details` : '';
  }
}
