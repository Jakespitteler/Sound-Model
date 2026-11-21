/** @fileoverview Live calculation status and the evidence behind active sound sources. */
import {$,escapeHtml} from './utils.js';
import {objectDistance} from './local-area.js';

/** @param {Object} source Placed source. @param {Object} type Catalogue entry.
 * @param {Object} fit Recorded fit. @return {boolean} Whether its setup still matches the placement. */
function fitMatchesPlacement(source,type,fit) {
  const position=fit.result.centre;
  return type.lwa===fit.result.lwa && source.lat===position.lat && source.lng===position.lng
    && type.operating_mode===fit.request.activity
    && (fit.request.mode!=='machine' || source.id===fit.request.source_id);
}

/** @param {import('./state.js').ScenarioStore} store Current scenario.
 * @param {Object} receiver Listening point. @return {string[]} Site-specific interpretation notes. */
export function receiverFitLimits(store,receiver) {
  const notes=new Set();
  for(const source of store.activeSources()) {
    const type=store.typeFor(source),fit=type.fitting;
    if(!fit) continue;
    const distance=objectDistance(source,receiver);
    if(type.kind==='area' && distance<=fit.request.radius_m) {
      notes.add('This point is inside a fitted area, where the point-source approximation is weakest.');
    }
    if(!fitMatchesPlacement(source,type,fit)) continue;
    const checks=fit.result.rows.filter(row=>row.role==='check' && row.eligible && Number.isFinite(row.distance_m));
    if(checks.length && distance>Math.max(...checks.map(row=>row.distance_m))) {
      notes.add('This point is farther from a fitted source than any of that source’s held-back checks.');
    }
  }
  return [...notes];
}

/** @param {Object} source Placed sound source. @param {Object} type Catalogue entry.
 * @return {{consistent:boolean, summary:string}} Evidence applicable to this placement. */
function sourceEvidence(source,type) {
  const fit=type.fitting;
  if(!fit) {
    return {consistent:false,summary:type.provenance==='example'?'Example sound power.':'Sound power entered as measured.'};
  }
  const confidence=fit.result.confidence;
  if(!fitMatchesPlacement(source,type,fit)) {
    return {consistent:false,summary:'Historical fit. The current machine, power, location or activity differs from that fit.'};
  }
  if(!confidence) return {consistent:false,summary:'Older fit. Preview again for a summary of the held-back checks.'};
  const consistent=confidence.rating==='consistent';
  const agreement=consistent?'Consistent at checked locations.':'Limited fit evidence.';
  return {consistent,summary:`${agreement} ${confidence.check_count} held-back ${confidence.check_count===1?'check':'checks'}, up to ${confidence.max_error_db.toFixed(1)} dB difference. ${confidence.sensitive_reading_count} close to background.`};
}

/** Present state from the existing request callbacks, without starting any requests. */
export class ModelStatus {
  /** @param {import('./state.js').ScenarioStore} store Current scenario. */
  constructor(store) {
    this.store=store;
    this.contours='Contours need a source';
    this.receivers='No receivers';
    $('open-model-status').onclick=()=>$('model-status-dialog').showModal();
    this.render();
  }

  /** Update the always-visible summary and its current inputs. */
  render() {
    const {store}=this;
    const sources=store.sources.flatMap((source,index)=>{
      if(source.disabled) return [];
      const type=store.typeFor(source);
      return [{type,index,evidence:sourceEvidence(source,type)}];
    });
    const confidence=sources.length
      ? sources.every(({evidence})=>evidence.consistent)?'Fit checks agree locally':'Limited evidence'
      : store.sources.length?'Switch on a source to begin':'Add a source to begin';
    const statusText=sources.length?`${confidence} · ${this.contours} · ${this.receivers}`:confidence;
    if($('calculation-status').textContent!==statusText) $('calculation-status').textContent=statusText;
    if($('model-evidence-summary').textContent!==confidence) $('model-evidence-summary').textContent=confidence;
    $('model-contour-state').textContent=this.contours;
    $('model-receiver-state').textContent=this.receivers;
    $('model-background').textContent=store.background_db===null
      ? 'Background level: none entered. Receiver levels show the predicted contribution from the scenario sources.'
      : `Background level: ${store.background_db} dB(A) across the scenario. “Negligible overall increase” means the calculated total rises by less than 0.1 dB.`;
    $('model-source-evidence').innerHTML=sources.map(({type,evidence,index})=>
      `<li><strong>${index+1}. ${escapeHtml(type.name)}</strong> · ${type.lwa.toFixed(1)} dB(A) LwA. ${escapeHtml(evidence.summary)}${type.lwa===300?' This power is outside realistic machinery use.':''}</li>`
    ).join('');
    $('model-source-empty').hidden=!!sources.length;
  }
}
