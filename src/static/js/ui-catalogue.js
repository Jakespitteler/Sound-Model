/**
 * UI controller for Section 01 (Machine Catalogue) and Section 05 (Cloud Cover).
 */

import { $, escapeHtml } from './utils.js';

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
      this.store.addMachineType(name, Number($('type-level').value), $('type-provenance').value);
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
      this.store.updateMachineType(form.dataset.editType, {
        name,
        lwa: Number(data.get('lwa')),
        provenance: String(data.get('provenance')),
      });
      this.say('Type updated for all its machines.');
    });

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
          `<p>${t.lwa.toFixed(1)} dB(A) LwA — ${t.provenance === 'example' ? 'EXAMPLE' : 'Measured data'}</p>` +
          `<details><summary>Edit type</summary><form data-edit-type="${t.id}">` +
          `<label>Name<input name="name" value="${escapeHtml(t.name)}" maxlength="80" required></label>` +
          `<div class="two-columns"><label>LwA dB(A)<input name="lwa" type="number" min="0" max="300" step="0.1" value="${t.lwa}" required></label>` +
          `<label>Data source<select name="provenance"><option value="example" ${t.provenance === 'example' ? 'selected' : ''}>Example</option>` +
          `<option value="measured" ${t.provenance === 'measured' ? 'selected' : ''}>Measured</option></select></label></div>` +
          `<button class="secondary" type="submit">Save type</button></form></details></div>`,
      )
      .join('');

    const old = $('place-type').value;
    $('place-type').innerHTML = this.store.types.length
      ? this.store.types.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')
      : '<option value="">Add a machine type first</option>';
    if (this.store.types.some((t) => t.id === old)) $('place-type').value = old;
    $('place-source').disabled = !this.store.types.length;
    $('demo').disabled = Boolean(
      this.store.types.length || this.store.sources.length || this.store.receivers.length,
    );
  }
}
