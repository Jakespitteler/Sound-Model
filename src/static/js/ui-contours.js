/** @fileoverview Threshold editing, styling and the matching map legend. */
import {$, escapeHtml} from './utils.js';

/** Contour controls change geometry only when a decibel threshold changes. */
export class ContoursUI {
  /**
   * @param {import('./state.js').ScenarioStore} store Scenario state.
   * @param {function(string):void} say Message writer.
   */
  constructor(store, say) { this.store = store; this.say = say; }

  /** Bind delegated controls; keep inputs mounted while changing native colour pickers. */
  bind() {
    $('add-contour').onclick = () => {
      if (this.store.contours.length >= 25) return this.say('Maximum 25 contour levels.');
      this.store.addContour(); this.render();
    };
    $('contours').addEventListener('change', event => {
      const input = event.target;
      if (!input.dataset.field || !input.checkValidity()) return;
      const field = input.dataset.field;
      const value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? input.valueAsNumber : input.value;
      const accepted = this.store.updateContour(input.closest('[data-contour-id]').dataset.contourId, {[field]:value});
      if (!accepted) this.say('Use a unique contour threshold between 0 and 180 dB(A).');
      this.render();
    });
    $('contours').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-contour]'); if (!button) return;
      this.store.removeContour(button.dataset.removeContour); this.render();
    });
  }

  /** Render level controls, including explicit width/style settings and level count. */
  render() {
    $('contour-count').textContent = String(this.store.contours.length);
    $('contours').innerHTML = this.store.contours.map(c => `<fieldset class="contour-card" data-contour-id="${c.id}">
      <legend>${c.level_db.toFixed(1)} dB(A)</legend><div class="contour-fields">
      <label>Level · dB(A)<input type="number" data-field="level_db" min="0" max="180" step="0.1" value="${c.level_db}" required></label>
      <label>Colour<input type="color" data-field="color" value="${escapeHtml(c.color)}"></label>
      <label>Width · px<input type="number" data-field="weight" min="0.5" max="8" step="0.5" value="${c.weight}" required></label>
      <label>Line style<select data-field="style"><option value="solid" ${c.style==='solid'?'selected':''}>Solid</option><option value="dashed" ${c.style==='dashed'?'selected':''}>Dashed</option><option value="dotted" ${c.style==='dotted'?'selected':''}>Dotted</option></select></label>
      </div><div class="row"><label class="inline"><input type="checkbox" data-field="visible" ${c.visible?'checked':''}> Visible</label>
      <button class="danger" type="button" data-remove-contour="${c.id}" aria-label="Remove ${c.level_db} dB contour">Remove level</button></div></fieldset>`).join('') || '<p class="empty">No levels. Add a level to see contours again.</p>';
    this.renderLegend();
  }

  /** Keep line labels/colours in the legend consistent with current settings. */
  renderLegend() {
    $('contour-legend').innerHTML = this.store.contours.filter(c=>c.visible).sort((a,b)=>b.level_db-a.level_db).map(c=>
      `<span class="legend-chip"><span class="legend-swatch" style="border-top:${c.weight}px ${c.style==='solid'?'solid':c.style} ${escapeHtml(c.color)}"></span>${c.level_db.toFixed(1)} dB(A)</span>`
    ).join('') || '<span class="legend-chip">No visible contours</span>';
  }
}
