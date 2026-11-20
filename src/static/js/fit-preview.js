/** @fileoverview Plain-language preview with specialist evidence available on demand. */
import {escapeHtml as e} from './utils.js';

/** @param {Object} result Backend preview. @param {Object[]} measurements Original readings.
 * @return {string} Escaped readings and check results, with an edit path for each one. */
export function fitPreview(result,measurements) {
  const number=value=>value==null?'—':(Math.abs(value)<.05?0:value).toFixed(1);
  const rows=result.rows.map(row=> {
    const index=measurements.findIndex(m=>m.id===row.id),item=measurements[index];
    return `<tr><th scope="row">${e(item?.name || (index<0?'Measurement':`Measurement ${index+1}`))}<small>${row.role==='check'?'Checks prediction':'Used for estimate'} · ${number(row.distance_m)} m</small></th><td>${number(row.corrected_db)}</td><td>${number(row.predicted_db)}</td><td>${number(row.difference_db)}</td></tr><tr><td colspan="4" class="hint">${e(row.reason)} <button type="button" class="text-button" data-open-reading="${e(row.id)}">Edit reading</button></td></tr>`;
  }).join('');
  const reason=result.ready?'Compare the prediction with your readings before using it on the map.':result.reason?.startsWith('Review the selected readings')?'Some readings need attention. Use Edit reading below to review them.':result.reason;
  return `<p>${e(reason)}</p>
    <div class="fit-table-wrap"><table class="fit-table"><caption>Sound at each measurement location · dB(A), with background removed.</caption><thead><tr><th>Location</th><th>Reading</th><th>Estimate</th><th>Difference</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Readings marked “Checks prediction” were not used to build the estimate. These are approximate results.</p>
    <details><summary>Calculation details</summary><p>${e(result.reason)}</p>${result.ready?`<p>Estimated sound power: ${number(result.lwa)} dB(A) LwA. Training estimates span ${number(result.spread_db)} dB; this is not an uncertainty bound.</p>`:''}<p>Difference means background-corrected reading minus prediction. This does not establish audibility or model accuracy.</p></details>`;
}
