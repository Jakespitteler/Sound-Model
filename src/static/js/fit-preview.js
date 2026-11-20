/** @fileoverview Show independent check readings first and keep the full evidence accessible. */
import {escapeHtml as e} from './utils.js';

/** @param {?number} value Level or difference. @return {string} One decimal or missing value. */
function number(value) {
  return value==null?'—':(Math.abs(value)<.05?0:value).toFixed(1);
}

/** @param {Object} result Backend preview. @param {Object[]} measurements Original readings.
 * @param {boolean} [editable] Offer links to live readings when rendering the current preview.
 * @return {string} Escaped reading comparisons and supporting details. */
export function fitPreview(result,measurements,editable=true) {
  const checks=[];
  const rows=result.rows.map(row=>{
    const index=measurements.findIndex(item=>item.id===row.id);
    const label=e(measurements[index]?.name || (index<0?'Measurement':`Measurement ${index+1}`));
    const edit=editable?` <button type="button" class="text-button" data-open-reading="${e(row.id)}">Edit reading</button>`:'';
    if(result.ready && row.role==='check') {
      checks.push(`<li><strong>${label}</strong><span>Reading ${number(row.corrected_db)} · Prediction ${number(row.predicted_db)} dB(A)</span></li>`);
    }
    return `<tr><th scope="row">${label}<small>${row.role==='check'?'Checks prediction':'Used for estimate'} · ${number(row.distance_m)} m</small></th><td>${number(row.corrected_db)}</td><td>${number(row.predicted_db)}</td><td>${number(row.difference_db)}</td></tr><tr><td colspan="4" class="hint">${e(row.reason)}${edit}</td></tr>`;
  }).join('');
  const table=`<div class="fit-table-wrap"><table class="fit-table"><caption>Sound at each measurement location · dB(A), with background removed.</caption><thead><tr><th>Location</th><th>Reading</th><th>Estimate</th><th>Difference</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  if(!result.ready) {
    const reason=result.reason?.startsWith('Review the selected readings')?'Review the readings flagged below.':result.reason;
    return `<p>${e(reason)}</p>${table}`;
  }
  return `<div class="fit-checks"><h3>Check against your meter</h3>
    <p class="hint">These locations were held back to test the estimate. The readings below have background sound removed.</p>
    <ul>${checks.join('')}</ul></div>
    <details><summary>All readings &amp; calculation details</summary>${table}<p>${e(result.reason)}</p>
    <p>Estimated sound power: ${number(result.lwa)} dB(A) LwA. The powers calculated from the build readings span ${number(result.spread_db)} dB.</p>
    <p>Difference is the corrected reading minus the prediction.</p></details>`;
}
