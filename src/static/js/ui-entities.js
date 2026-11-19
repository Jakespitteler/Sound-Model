/**
 * UI controller for placed sound sources (Section 02) and receivers (Section 04).
 */

import { $, escapeHtml, formatDb } from './utils.js';
import {receiverLabel} from './state.js';
import {soundColor} from './sound-style.js';

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
    // Update accepted text in place: no card replacement, so selection and IME editing stay natural.
    $('receivers').addEventListener('input', event=> {
      const input=event.target.closest('[data-receiver-name]');
      if (!input || event.isComposing) return;
      const accepted=this.store.renameReceiver(input.dataset.receiverName,input.value);
      input.setCustomValidity(accepted ? '' : 'Use 80 characters or fewer.');
      if (!accepted) this.say('Receiver names can contain up to 80 characters.');
    });
    $('receivers').addEventListener('compositionend',event=>event.target.dispatchEvent(new Event('input',{bubbles:true})));
    $('receivers').addEventListener('change',event=> {
      const input=event.target.closest('[data-receiver-name]');
      if (!input) return;
      const receiver=this.store.receivers.find(r=>r.id===input.dataset.receiverName);
      // Reject overlong paste explicitly; the previous accepted label remains saved.
      if (!input.checkValidity()) this.say('Name too long; the previous name was kept.');
      input.value=receiver.name || ''; input.setCustomValidity('');
    });
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
   * @param {string} [extra] Safely constructed contribution markup for receiver details.
   * @param {string} [summary] Safely constructed compact object summary.
   * @return {string} Escaped coordinate-editing form markup.
   */
  positionForm(item, collection, extra = '', summary = '') {
    return (
      `<details><summary class="entity-summary">${summary || (collection === 'sources' ? 'Edit position' : 'Details &amp; position')}</summary>` +
      `<div class="entity-editor">${extra}` +
      `<form data-position="${item.id}" data-collection="${collection}" class="position-edit">` +
      `<div class="two-columns"><label>Latitude<input name="lat" type="number" min="-85" max="85" step="any" value="${item.lat}" required></label>` +
      `<label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" value="${item.lng}" required></label></div>` +
      `<button class="secondary" type="submit">Move location</button></form></div></details>`
    );
  }

  /** Render placed machine cards with numeric coordinate editing. */
  renderSources() {
    $('source-count').textContent = String(this.store.sources.length);
    $('sources').innerHTML = this.store.sources.length
      ? this.store.sources
          .map(
            (s, i) =>
              `<div class="item-card">${this.positionForm(s, 'sources',
                `<button class="danger entity-remove" type="button" data-remove-source="${s.id}" aria-label="Remove machine ${i + 1}">Remove machine</button>`,
                `<strong>${i + 1}. ${escapeHtml(this.store.typeFor(s).name)}</strong>` +
                `<span class="source-power">${this.store.typeFor(s).lwa.toFixed(1)} <small>dB(A) LwA</small></span>`)}</div>`,
          )
          .join('')
      : '<p class="empty">No machines placed yet. Choose a type, then click the map.</p>';
  }

  /** Update headings and accessible controls without replacing the active editor. */
  updateReceiverNames() {
    this.store.receivers.forEach((receiver,index)=> {
      const card=$('receivers').querySelector(`[data-receiver-card="${CSS.escape(receiver.id)}"]`);
      if (!card) return;
      const label=receiverLabel(receiver,index);
      card.querySelector('[data-receiver-title]').textContent=label;
      card.querySelector('[data-remove-receiver]').setAttribute('aria-label',`Remove ${label}`);
    });
  }

  /**
   * @param {Object<string, import("./types.js").Reading>} [results] Current direct readings.
   */
  renderReceivers(results) {
    const open=new Set([...$('receivers').querySelectorAll('[data-receiver-card]:has(details[open])')].map(card=>card.dataset.receiverCard));
    const active=document.activeElement;
    const editing=active?.dataset.receiverName;
    const selection=editing ? [active.selectionStart,active.selectionEnd,active.value] : null;
    $('receiver-count').textContent = String(this.store.receivers.length);
    $('receivers').innerHTML = this.store.receivers.length
      ? this.store.receivers
          .map((r, i) => {
            const result = results?.[r.id];
            return (
              `<div class="item-card" data-receiver-card="${escapeHtml(r.id)}">` +
              `${this.positionForm(r, 'receivers',
                `<button class="danger entity-remove" type="button" data-remove-receiver="${r.id}" aria-label="Remove ${escapeHtml(receiverLabel(r,i))}">Remove receiver</button>` +
                `${result?.status === 'negligible' ? '<p>Machinery adds less than 0.1 dB to the scenario background.</p>' : ''}` +
                `${result?.near_field ? '<p>Within 1 m: numerical limit applies.</p>' : ''}` +
                `<label>Name (optional)<input type="text" data-receiver-name="${escapeHtml(r.id)}" aria-label="Name for receiver ${i+1}" placeholder="e.g. Town boundary" value="${escapeHtml(r.name || '')}"></label>` +
                (result?.contributions.length
                  ? `<details class="receiver-contributions"><summary>Machine contributions</summary><ul class="contributions">${result.contributions.map(c =>
                    `<li>${this.store.sources.findIndex(source=>source.id===c.id)+1}. ${escapeHtml(c.name)} · ${c.distance_m.toFixed(0)} m · ${c.level_db.toFixed(1)} dB(A)${c.provenance === 'example' ? ' · estimate' : ''}</li>`
                  ).join('')}</ul></details>` : ''),
                `<strong data-receiver-title>${escapeHtml(receiverLabel(r,i))}</strong>` +
                `<span class="result${result?.status==='negligible' ? ' is-negligible' : ''}" style="color:${soundColor(result?.level_db ?? null)}">${!result ? 'Calculating…' : result.status === 'negligible' ? 'Negligible overall increase' : formatDb(result.level_db)}</span>` +
                `${result?.near_field || result?.includes_distant_sources ? `<span class="entity-warning">${[result.near_field ? 'Within 1 m of a machine' : '',result.includes_distant_sources ? 'Includes distant sources' : ''].filter(Boolean).join(' · ')}</span>` : ''}`
              )}</div>`
            );
          })
          .join('')
      : '<p class="empty">Receiver readings appear here.</p>';
    for (const card of $('receivers').querySelectorAll('[data-receiver-card]')) {
      if (open.has(card.dataset.receiverCard)) card.querySelector('details').open=true;
    }
    if (editing) {
      const input=$('receivers').querySelector(`[data-receiver-name="${CSS.escape(editing)}"]`);
      if (input) {input.value=selection[2]; input.focus({preventScroll:true}); input.setSelectionRange(selection[0],selection[1]);}
    }
  }
}
