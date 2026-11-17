/** @fileoverview Simple paired slider/number controls, automatically ordered by decibels. */
import {$,escapeHtml} from './utils.js';
import {soundColor} from './sound-style.js';

/** Contour presentation is automatic; only thresholds and level count are editable. */
export class ContoursUI {
  /**
   * @param {import('./state.js').ScenarioStore} store Scenario state.
   * @param {function(string):void} say Accessible status message writer.
   */
  constructor(store, say) { this.store = store; this.say = say; this.results = []; this.sliderRange=null; }

  /** Bind once; dragging a slider previews locally and commits on release. */
  bind() {
    const commitAcceptable=value=> {
      if (!this.store.setAcceptableLevel(value)) this.say('Use 0–300 dB(A), with at most 25 unique levels including this reference.');
      this.render();
    };
    $('acceptable-level').onchange=()=> {
      const input=$('acceptable-level');
      if (!input.checkValidity()) {input.reportValidity(); return;}
      commitAcceptable(input.value==='' ? null : input.valueAsNumber);
    };
    $('acceptable-slider').oninput=()=> {$('acceptable-level').value=$('acceptable-slider').value;};
    $('acceptable-slider').onchange=()=>commitAcceptable($('acceptable-slider').valueAsNumber);
    $('clear-acceptable').onclick=()=>commitAcceptable(null);
    const newForm=$('new-contour-form'), newLevel=$('new-contour-level');
    const closeNewContour=()=> {newForm.hidden=true; newForm.reset(); newLevel.setCustomValidity(''); $('add-contour').hidden=false; $('add-contour').focus();};
    $('add-contour').onclick=()=> {
      if (this.store.contours.length>=25) return this.say('Maximum 25 ordinary contour levels. Remove one first.');
      newForm.hidden=false; newForm.style.removeProperty('--level-color'); $('add-contour').hidden=true; newLevel.value=''; newLevel.setCustomValidity(''); this.syncRowSliders(); newLevel.focus();
    };
    newLevel.oninput=()=> {
      newLevel.setCustomValidity('');
      this.configureSlider($('new-contour-slider'),newLevel.value==='' ? null : newLevel.valueAsNumber);
      newForm.style.setProperty('--level-color',soundColor(newLevel.valueAsNumber));
    };
    $('new-contour-slider').oninput=()=> {
      newLevel.value=$('new-contour-slider').value; newLevel.setCustomValidity('');
      newForm.style.setProperty('--level-color',soundColor(newLevel.valueAsNumber));
    };
    $('new-contour-slider').onkeydown=event=> {if(event.key==='Enter') {event.preventDefault();newForm.requestSubmit();}};
    newForm.onsubmit=event=> {
      event.preventDefault();
      if (!newForm.checkValidity()) return newForm.reportValidity();
      if (!this.store.addContour(newLevel.valueAsNumber)) {
        newLevel.setCustomValidity(this.store.contours.some(c=>c.level_db===newLevel.valueAsNumber) ?
          'That contour level already exists.' : 'Maximum 25 unique levels, including the acceptable level.');
        newLevel.reportValidity(); return;
      }
      this.render(); closeNewContour(); this.say('Contour added.');
    };
    $('cancel-new-contour').onclick=closeNewContour;
    newForm.onkeydown=event=> {if(event.key==='Escape') {event.preventDefault();event.stopPropagation();closeNewContour();}};
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
      if (!accepted) this.say('Use a distinct ordinary level from 0–300 dB(A), with at most 25 unique levels including the acceptable level.');
      else this.say('Contour updated. Levels are ordered from highest to lowest.');
      this.render();
    });
    $('contours').addEventListener('click', event => {
      const button = event.target.closest('[data-remove-contour]'); if (!button) return;
      this.store.removeContour(button.dataset.removeContour); this.render();
    });
  }

  /** @param {?Object} range Checked scenario range, or null while pending. */
  setSliderRange(range) {this.sliderRange=range; this.syncAcceptable(); this.renderStatus();}

  /** @param {HTMLInputElement} slider Range control. @param {?number} value Current number, preserved separately. */
  configureSlider(slider,value) {
    const range=this.sliderRange;
    const enabled=range?.status==='ok' && Number.isFinite(range.min_db) && Number.isFinite(range.max_db) && range.max_db>range.min_db;
    slider.min=String(enabled ? range.min_db : 0); slider.max=String(enabled ? range.max_db : 300);
    slider.value=String(enabled ? Math.max(range.min_db,Math.min(range.max_db,Number.isFinite(value) ? value : (range.min_db+range.max_db)/2)) : 0);
    slider.disabled=!enabled;
    slider.title=enabled ? `${range.min_db}–${range.max_db} dB(A) for current machines` : range?.reason || (this.store.sources.length ? 'Finding slider range…' : 'Place a machine to enable the slider.');
  }

  /** Apply the scenario interval to ordinary and draft rows without changing entered numbers. */
  syncRowSliders() {
    for (const row of document.querySelectorAll('#contours .contour-row')) {
      this.configureSlider(row.querySelector('[type=range]'),row.querySelector('[type=number]').valueAsNumber);
    }
    this.configureSlider($('new-contour-slider'),$('new-contour-level').value==='' ? null : $('new-contour-level').valueAsNumber);
  }

  /** Reflect committed reference state without replacing the active slider/number input. */
  syncAcceptable() {
    const value=this.store.acceptable_level_db;
    $('acceptable-level').value=value===null ? '' : String(value);
    this.configureSlider($('acceptable-slider'),value); this.syncRowSliders();
    $('clear-acceptable').disabled=value===null;
    $('contour-count').textContent=String(this.store.getContourLevels().length);
  }

  /** Render compact rows with scenario-bounded sliders and full-range numeric inputs. */
  render() {
    this.syncAcceptable();
    $('contours').innerHTML = [...this.store.contours].sort((a,b)=>b.level_db-a.level_db).map(c =>
      `<div class="contour-row" data-contour-id="${c.id}" style="--level-color:${soundColor(c.level_db)}">
      <span class="level-swatch" aria-hidden="true"></span>
      <input type="range" data-field="level_db" min="0" max="300" step="0.1" value="${c.level_db}" aria-label="Slide ${c.level_db} dB contour level">
      <label class="level-number"><input type="number" data-field="level_db" min="0" max="300" step="0.1" value="${c.level_db}" aria-label="${c.level_db} dB contour level" required><span>dB(A)</span></label>
      <button class="danger remove-level" type="button" data-remove-contour="${c.id}" aria-label="Remove ${c.level_db} dB contour">×</button></div>`
    ).join('') || '<p class="empty">No ordinary contours.</p>';
    this.syncRowSliders(); this.renderStatus();
  }

  /** @param {import('./types.js').ContourGeometry[]} results Per-level successes/failures. */
  setResults(results) { this.results = results; this.renderStatus(); }

  /** Identify failed and empty levels beside their inputs without rebuilding focused fields. */
  renderStatus() {
    document.querySelectorAll('.contour-level-status').forEach(element=>element.remove());
    for (const row of document.querySelectorAll('[data-contour-id]')) {
      const current = this.store.contours.find(c=>c.id===row.dataset.contourId);
      if (!current) continue; // A store notification can precede removal of its old DOM row.
      const result = this.results.find(c=>c.level_db===current.level_db);
      row.classList.toggle('contour-failed',result?.status==='failed');
      if (result?.status==='failed' || result?.status==='empty') {
        const status = document.createElement('span'); status.className='contour-level-status';
        status.textContent=result.status==='failed' ? 'Failed' : 'No crossing';
        status.title=result.error || 'No contour at this level for the current sources.';
        row.append(status);
      }
    }
    const acceptable=this.results.find(c=>c.level_db===this.store.acceptable_level_db);
    $('acceptable-status').textContent=acceptable?.status==='failed' ? 'Failed' : acceptable?.status==='empty' ? 'No crossing' : this.sliderRange?.status==='ok' ? `${this.store.acceptable_level_db===null ? 'Drag to set · ' : 'Slider: '}${this.sliderRange.min_db}–${this.sliderRange.max_db} dB(A)` : this.sliderRange?.reason || (this.store.sources.length ? 'Finding slider range…' : 'Place a machine to enable the slider.');
    $('acceptable-status').title=acceptable?.error || '';
    const failures=this.results.filter(c=>c.status==='failed');
    $('contour-errors').innerHTML=failures.map(c=>`<p><strong>${c.level_db===this.store.acceptable_level_db ? 'Acceptable level · ' : ''}${c.level_db} dB(A) failed</strong><br>${escapeHtml(c.error)}</p>`).join('');
    $('contour-alert').hidden=!failures.length;
    $('contour-alert').textContent=failures.length ? `${failures.map(c=>(c.level_db===this.store.acceptable_level_db ? 'Acceptable ' : '')+c.level_db+' dB(A)').join(', ')} failed · view details` : '';
  }
}
