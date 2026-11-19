/** @fileoverview Optional unweighted evidence editors and receiver comparisons. */
import {$,escapeHtml} from './utils.js';
export const BAND_FREQUENCIES=[31.5,63,125,250,500,1000,2000,4000,8000];

/** @param {?Object} spectrum Existing evidence. @param {boolean} power Source power rather than pressure.
 * @return {string} Escaped fields for use inside an existing form. */
export function spectrumFields(spectrum,power=false) {
  return `<p class="hint">Unweighted ${power?'sound power (Lw, re 1 pW)':'background pressure (Lp, re 20 µPa)'}. Blank means unknown. These values do not replace the overall dB(A) input.</p>
    <div class="band-grid">${BAND_FREQUENCIES.map((hz,i)=>`<label>${hz>=1000 ? hz/1000+' kHz' : hz+' Hz'}<input type="number" step="any" data-band-index="${i}" value="${spectrum?.levels[i] ?? ''}" aria-label="${hz} Hz ${power?'sound power':'background pressure'}"></label>`).join('')}</div>
    <div class="two-columns"><label>Energy-average duration · seconds<input type="number" data-band-period step="any" min="0.000001" value="${spectrum?.period_s ?? ''}" placeholder="Unknown"></label>
    <label>Band evidence<select data-band-provenance><option value="example">Assumed</option><option value="measured" ${spectrum?.provenance==='measured'?'selected':''}>Measured</option></select></label></div>
    <label>Band source / operating reference<input data-band-reference maxlength="500" value="${escapeHtml(spectrum?.reference || '')}" placeholder="Document, operating conditions and measurement basis"></label>`;
}

/** @param {HTMLFormElement} form One evidence form. @return {?Object} Explicit evidence or null if completely cleared. */
export function readSpectrum(form) {
  const inputs=[...form.querySelectorAll('[data-band-index]')];
  const levels=inputs.map(input=>input.value==='' ? null : input.valueAsNumber);
  const period=form.querySelector('[data-band-period]'),period_s=period.value==='' ? null : period.valueAsNumber;
  const reference=form.querySelector('[data-band-reference]').value.trim();
  if(levels.every(value=>value===null) && period_s===null && !reference) return null;
  if(levels.some(value=>value!==null && !Number.isFinite(value)) || period_s!==null && (!Number.isFinite(period_s) || period_s<=0)) throw new Error('Use finite band levels and a positive averaging duration.');
  return {levels,period_s,reference,provenance:form.querySelector('[data-band-provenance]').value,weighting:'Z',metric:'Leq'};
}

/** @param {Object[]} rows Current receiver band results. @return {string} Accessible comparison with explicit unknown states. */
export function bandComparison(rows) {
  if(!rows?.length) return '';
  const number=value=>value==null ? 'Unknown' : value.toFixed(1);
  const statuses={ok:'Compared',missing_source_data:'Missing machine data',missing_background:'Missing background',incompatible_basis:'Averaging periods differ or are unknown',no_sources:'No machines',unavailable:'Numeric range unavailable'};
  return `<details class="receiver-bands"><summary>Frequency comparison</summary><p class="hint">Unweighted geometry estimates. Difference means machinery minus background, not audibility. All sources must have compatible Leq durations. Check that measurements represent the same conditions.</p>
    <div class="band-table-wrap"><table class="band-table"><thead><tr><th>Hz</th><th>Machines<br>dB Lp</th><th>Background<br>dB Lp</th><th>Difference<br>dB</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${row.frequency_hz}</th><td>${number(row.machine_db)}</td><td>${number(row.background_db)}</td><td>${row.difference_db==null?'Unknown':(row.difference_db>0?'+':'')+row.difference_db.toFixed(1)}</td></tr><tr class="band-status"><td colspan="4">${escapeHtml(statuses[row.status] || 'Unavailable')}${row.missing_sources?.length ? ' · '+row.missing_sources.length+' machine(s) missing this band or its duration' : ''}${row.near_field?' · Within 1 m numerical limit':''}</td></tr>`).join('')}</tbody></table></div></details>`;
}

/** @param {import('./state.js').ScenarioStore} store Current working state.
 * @param {function(string):void} say Status writer. @return {function():void} Editor synchroniser for scenario restores. */
export function bindBackgroundSpectrum(store,say) {
  const render=()=>{$('background-band-fields').innerHTML=spectrumFields(store.background_spectrum);};
  $('background-band-form').onsubmit=event=> {
    event.preventDefault();
    try {store.setBackgroundSpectrum(readSpectrum(event.currentTarget));say('Background frequency data saved in this scenario.');}
    catch(error) {say(error.message);}
  };
  render();return render;
}
