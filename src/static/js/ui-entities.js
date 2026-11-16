/**
 * UI controller for placed sound sources (Section 02) and receivers (Section 04).
 */

import { $, escapeHtml, formatDb } from './utils.js';

/** Source and receiver cards with accessible numeric coordinate controls. */
export class EntitiesUI {
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
    $('place-source').addEventListener('click', () => {
      if (this.store.sources.length >= 100) return this.say('Maximum 100 sources reached.');
      this.store.setMode('source');
    });

    $('place-receiver').addEventListener('click', () => {
      if (this.store.receivers.length >= 20) return this.say('Maximum 20 receivers reached.');
      this.store.setMode('receiver');
    });
  }

  /**
   * @param {Object} item Placed source or receiver.
   * @param {string} collection State collection name.
   * @return {string} Escaped coordinate-editing form markup.
   */
  positionForm(item, collection) {
    return (
      `<details><summary>Edit coordinates</summary>` +
      `<form data-position="${item.id}" data-collection="${collection}" class="position-edit">` +
      `<div class="two-columns"><label>Latitude<input name="lat" type="number" min="-85" max="85" step="any" value="${item.lat}" required></label>` +
      `<label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" value="${item.lng}" required></label></div>` +
      `<button class="secondary" type="submit">Move location</button></form></details>`
    );
  }

  /** Render placed machine cards with numeric coordinate editing. */
  renderSources() {
    $('source-count').textContent = String(this.store.sources.length);
    $('sources').innerHTML = this.store.sources.length
      ? this.store.sources
          .map(
            (s, i) =>
              `<div class="item-card"><div class="row"><strong>${i + 1}. ${escapeHtml(this.store.typeFor(s).name)}</strong>` +
              `<button class="danger" type="button" data-remove-source="${s.id}" aria-label="Remove machine ${i + 1}">Remove</button></div>` +
              `<p>${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</p>${this.positionForm(s, 'sources')}</div>`,
          )
          .join('')
      : '<p class="empty">No machines placed yet. Choose a type, then click the map.</p>';
  }

  /**
   * @param {Object<string, import("./types.js").Reading>} [results] Current direct readings.
   */
  renderReceivers(results) {
    $('receiver-count').textContent = String(this.store.receivers.length);
    $('receivers').innerHTML = this.store.receivers.length
      ? this.store.receivers
          .map((r, i) => {
            const result = results?.[r.id];
            return (
              `<div class="item-card"><div class="row"><strong>Receiver ${i + 1}</strong>` +
              `<button class="danger" type="button" data-remove-receiver="${r.id}" aria-label="Remove receiver ${i + 1}">Remove</button></div>` +
              `<div class="result">${result ? formatDb(result.level_db) : 'Calculating…'}</div>` +
              `<p>${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</p>` +
              `${result?.near_field ? '<p>Within 1 m of a source: near-field limit applies.</p>' : ''}` +
              `${
                result?.contributions.length
                  ? `<ul class="contributions">${result.contributions
                      .map(
                        (c) =>
                          `<li>${escapeHtml(c.name)} — ${c.distance_m.toFixed(0)} m — ${c.level_db.toFixed(1)} dB(A)` +
                          `${c.provenance === 'example' ? ' — example' : ''}</li>`,
                      )
                      .join('')}</ul>`
                  : ''
              }${this.positionForm(r, 'receivers')}</div>`
            );
          })
          .join('')
      : '<p class="empty">Receiver readings appear here.</p>';
  }
}
