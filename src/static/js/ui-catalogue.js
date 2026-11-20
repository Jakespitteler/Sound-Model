/**
 * UI controller for Section 01 (Machine Catalogue) and Section 05 (Cloud Cover).
 */

import {fitPreview} from './fit-preview.js';
import {spectrumFields,readSpectrum} from './band-ui.js';
import { $, escapeHtml } from './utils.js';

/** @param {Object} fit Saved fit evidence. @return {string} Escaped original map labels. */
function coverageNote(fit) {
  if(!fit.covered_source_ids) return '';
  const labels=fit.request.sources.flatMap((source,index)=>{
    if(!fit.covered_source_ids.includes(source.id)) return [];
    const type=fit.request.types.find(item=>item.id===source.type_id);
    return [`${index+1}. ${escapeHtml(type.name)}`];
  });
  return `<p>Map sources included when applied: ${labels.join(', ') || 'none'}.</p>`;
}

/** Machine catalogue forms, selection and cloud metadata controls. */
export class CatalogueUI {
  /**
   * @param {import("./state.js").ScenarioStore} store Scenario state.
   * @param {function(string):void} say Accessible status message writer.
   */
  constructor(store, say) {
    this.store = store;
    this.say = say;
  }

  /** Attach delegated form handlers once, before any state renders. */
  bind() {
    $('type-form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.store.types.length >= 50) {
        return this.say('This prototype supports up to 50 machine types.');
      }
      const name = $('type-name').value.trim();
      if (!name) return this.say('Enter a machine name.');
      this.store.addMachineType(name, Number($('type-level').value), $('type-provenance').value, $('type-note').value.trim());
      $('type-note').value = '';
      $('type-name').value = '';
      this.say('Machine type added. Choose "Place a machine on map" next.');
    });

    $('types').addEventListener('submit', (event) => {
      const form = event.target.closest('[data-edit-type]');
      if (!form) return;
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get('name')).trim();
      if (!name) return this.say('Enter a machine name.');
      for (const [field,limit] of [['source_reference',500],['operating_mode',200]]) {
        const input=form.elements.namedItem(field);
        if ([...input.value.trim()].length>limit) {input.setCustomValidity(`Use ${limit} characters or fewer.`); input.reportValidity(); return;}
      }
      let spectrum;
      try {spectrum=readSpectrum(form);} catch(error) {return this.say(error.message);}
      this.store.updateMachineType(form.dataset.editType, {
        spectrum,
        name,
        lwa: Number(data.get('lwa')),
        provenance: String(data.get('provenance')),
        note: String(data.get('note')).trim(),
        source_reference:String(data.get('source_reference')).trim(),
        operating_mode:String(data.get('operating_mode')).trim(),
      });
      this.say('Type updated for all its machines.');
    });

    $('types').addEventListener('input',event=>event.target.setCustomValidity?.(''));

    $('cloud').addEventListener('input', () => {
      const val = Number($('cloud').value);
      $('cloud-value').textContent = `${val}%`;
      this.store.setCloudCover(val);
    });
  }

  /** Render catalogue definitions and preserve the selected placement type. */
  render() {
    $('types').innerHTML = this.store.types
      .map(
        (t) =>
          `<div class="type-card"><div class="row"><strong>${escapeHtml(t.name)}</strong>` +
          `<button class="danger" type="button" data-remove-type="${t.id}" aria-label="Remove ${escapeHtml(t.name)} type">Remove</button></div>` +
          `<p>${t.lwa.toFixed(1)} dB(A) LwA — ${t.fitting && t.lwa===t.fitting.result.lwa ? 'Measurement-derived estimate' : t.provenance === 'example' ? 'Provisional estimate' : 'User-entered measured data'}</p>` +
          `<details><summary>Estimate notes &amp; edit</summary><p class="estimate-note">${escapeHtml(t.note || "No source note recorded. Add one before assessment use.")}</p><form data-edit-type="${t.id}">` +
          `<label>Name<input name="name" value="${escapeHtml(t.name)}" maxlength="80" required></label>` +
          `<div class="two-columns"><label>LwA dB(A)<input name="lwa" type="number" min="0" max="300" step="0.1" value="${t.lwa}" required></label>` +
          `<label>Data source<select name="provenance"><option value="example" ${t.provenance === 'example' ? 'selected' : ''}>Example</option>` +
          `<option value="measured" ${t.provenance === 'measured' ? 'selected' : ''}>Measured</option></select></label></div>` +
          `<label>Source reference (optional)<input name="source_reference" placeholder="Manufacturer sheet section 4" value="${escapeHtml(t.source_reference || '')}"></label>` +
          `<label>Operating mode (optional)<input name="operating_mode" placeholder="Loaded / travelling" value="${escapeHtml(t.operating_mode || '')}"></label>` +
          `<label>Source / assumption note<textarea name="note" maxlength="2000" rows="3">${escapeHtml(t.note || "")}</textarea></label><details class="source-bands"><summary>Frequency data (optional)</summary>${spectrumFields(t.spectrum,true)}</details><button class="secondary" type="submit">Save type</button></form></details>${t.fitting?`<details><summary>Recorded measurement fit</summary><p class="hint">At application: ${escapeHtml(t.fitting.request.activity)}, background ${t.fitting.request.background_db} dB(A). ${t.lwa!==t.fitting.result.lwa?'Current sound power has since been edited.':''}</p>${coverageNote(t.fitting)}${fitPreview(t.fitting.result,t.fitting.request.measurements,false)}</details>`:''}</div>`,
      )
      .join('');

    $('catalogue-count').textContent = `${this.store.types.length} types`;
    const old = $('place-type').value;
    $('place-type').innerHTML = this.store.types.length
      ? this.store.types.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}${t.kind==='area'?' · area estimate':t.fitting?' · calibrated':''}</option>`).join('')
      : '<option value="">Add a machine type first</option>';
    if (this.store.types.some((t) => t.id === old)) $('place-type').value = old;
    $('place-source').disabled = !this.store.types.length;
    const placementLabel=()=>{$('place-source').textContent=this.store.types.find(t=>t.id===$('place-type').value)?.kind==='area'?'Place area estimate':'Place machine';};
    $('place-type').onchange=placementLabel;placementLabel();
    $('demo').disabled = Boolean(
      this.store.sources.length || this.store.receivers.length,
    );
  }
}
