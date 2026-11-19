/** @fileoverview Read-only fit preview; observed totals never masquerade as source pressure. */
import {escapeHtml as e} from './utils.js';

/** @param {Object} result Backend preview. @param {Object[]} measurements Original readings.
 * @return {string} Escaped comparison table with rejected rows retained. */
export function fitPreview(result,measurements) {
  const number=value=>value==null?'—':(Math.abs(value)<.05?0:value).toFixed(1);
  const rows=result.rows.map(row=> {
    const index=measurements.findIndex(m=>m.id===row.id),item=measurements[index];
    return `<tr><th scope="row">${e(item?.name || (index<0?'Measurement':`Measurement ${index+1}`))}<small>${row.role==='check'?'Check only':'Fit'} · ${number(row.distance_m)} m</small></th><td>${number(row.corrected_db)}</td><td>${number(row.predicted_db)}</td><td>${number(row.difference_db)}</td></tr><tr><td colspan="4" class="hint">${e(row.reason)}</td></tr>`;
  }).join('');
  return `<p>${e(result.reason)}</p>${result.ready?`<p class="fit-power"><strong>${number(result.lwa)}</strong> dB(A) estimated LwA</p><p class="hint">Training estimates span ${number(result.spread_db)} dB. This is variation between readings, not an uncertainty bound.</p>`:''}
    <div class="fit-table-wrap"><table class="fit-table"><caption>Pressure levels · dB(A). Background energy removed from readings.</caption><thead><tr><th>Reading</th><th>Corrected</th><th>Predicted</th><th>Difference</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Difference = corrected reading minus prediction. Check readings were not used to fit. This does not establish audibility or model accuracy.</p>`;
}
