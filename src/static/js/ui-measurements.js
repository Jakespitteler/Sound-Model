/** @fileoverview Independent field observations; never calibration or source power inputs. */
import {$,escapeHtml} from './utils.js';
import {RequestLane} from './api.js';

/** Measurement records, non-draggable pins and a bounded cached direct-comparison lane. */
export class MeasurementUI {
  /** @param {import('./state.js').ScenarioStore} store Scenario state.
   * @param {import('./map-manager.js').MapManager} manager Map and placement state.
   * @param {function(string):void} say Status writer. */
  constructor(store,manager,say) {
    this.store=store;this.manager=manager;this.say=say;this.draft=null;
    this.layer=L.layerGroup().addTo(manager.map);this.lane=new RequestLane();
    this.cache=new Map();this.results={};this.signature=null;
    this.settings=document.querySelector('.measurement-settings');
    $('add-measurement').onclick=()=>store.setMode('measurement');
    $('retry-measurements').onclick=()=>{this.signature=null;this.refresh();};
    manager.map.on('click',event=> {
      if(store.mode!=='measurement') return;
      this.draft={lat:Math.max(-85,Math.min(85,event.latlng.lat)),lng:Math.max(-180,Math.min(180,event.latlng.lng))};
      store.setMode(null);this.render();this.open('draft');
    });
    $('measurement-cards').addEventListener('submit',event=>this.save(event));
    const resetDelete=target=> {const button=target.closest('.measurement-card')?.querySelector('[data-delete-reading]');if(button) {delete button.dataset.confirm;button.textContent='Delete measurement';}};
    $('measurement-cards').addEventListener('input',event=>resetDelete(event.target));
    $('measurement-cards').addEventListener('toggle',event=>{if(!event.target.open) resetDelete(event.target);},true);
    $('measurement-cards').addEventListener('click',event=> {
      const cancel=event.target.closest('[data-cancel-reading]');
      if(cancel) {this.draft=null;this.render();return;}
      const button=event.target.closest('[data-delete-reading]');if(!button) return;
      if(button.dataset.confirm!=='yes') {button.dataset.confirm='yes';button.textContent='Delete this measurement?';return;}
      store.removeMeasurement(button.dataset.deleteReading);say('Measurement deleted.');
    });
    store.subscribe(reason=> {
      if(reason==='restore') {this.draft=null;this.signature=null;this.results={};$('measurement-cards').replaceChildren();}
      if(['measurements','restore'].includes(reason)) this.render();
      if(['geometry','catalogue','equipment-metadata','restore'].includes(reason)) this.updateSourceOptions();
      if(['measurements','geometry','catalogue','background','equipment-metadata','restore'].includes(reason)) this.refresh();
    });
    this.render();
  }

  /** @param {string} id Source ID. @return {?Object} Detached current setup, not derived emission. */
  context(id) {
    const source=this.store.sources.find(s=>s.id===id);if(!source) return null;
    const type=this.store.typeFor(source);return {...source,name:type.name,lwa:type.lwa,operating_mode:type.operating_mode || ''};
  }

  /** @param {?string} selected Current/draft source link. @param {Object} item Historical record.
   * @return {string} Escaped options, retaining a removed source rather than selecting another. */
  sourceOptions(selected,item) {
    const options=this.store.sources.map((source,index)=>`<option value="${escapeHtml(source.id)}" ${source.id===selected?'selected':''}>${index+1}. ${escapeHtml(this.store.typeFor(source).name)}</option>`);
    if(selected && !this.store.sources.some(s=>s.id===selected)) options.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(item.source_context?.name || 'Recorded machine')} (removed)</option>`);
    return `<option value="">Not linked / unknown</option>${options.join('')}`;
  }

  /** @param {Object} item Observation. @param {number} index Stable list order. @return {string} Label. */
  label(item,index) {return item.name || `Measurement ${index+1}`;}

  /** @param {Object} item Observation/draft. @param {number} index List position. @return {string} Form card. */
  card(item,index) {
    const id=item.id || 'draft',e=escapeHtml;
    const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
    return `<details ${id==='draft'?'open':''}><summary class="entity-summary"><strong>${e(id==='draft'?'New measurement':this.label(item,index))}</strong><span class="source-power">${item.level_db==null?'Not recorded':item.level_db.toFixed(1)+' dB'}<small>measured pressure</small></span></summary>
      <div data-comparison></div><form class="measurement-form" data-reading="${e(id)}">
      <label>Name (optional)<input name="name" maxlength="80" value="${e(item.name || '')}"></label>
      <div class="two-columns"><label>Measured pressure · dB<input name="level_db" type="number" step="any" value="${item.level_db ?? ''}" required></label>
      <label>Meter reading type<select name="metric">${options([['unknown','Unknown'],['LAeq','LAeq — average'],['LAmax','LAmax — maximum']],item.metric || 'unknown')}</select></label></div>
      <details><summary>Test details (optional)</summary>
      <p class="hint">Link a machine only when its modeled setup represents this test.</p><label>Machine<select name="source_id">${this.sourceOptions(item.source_id,item)}</select></label>
      <label>Operating activity<input name="activity" maxlength="200" value="${e(item.activity || '')}" placeholder="e.g. steady idle or loaded pass"></label>
      <div class="two-columns"><label>Test<select name="test_kind">${options([['unknown','Unknown'],['stationary','Stationary / steady'],['moving','Moving / pass-by'],['startup','Startup / brief event']],item.test_kind || 'unknown')}</select></label>
      <label>Duration · seconds<input name="duration_s" type="number" min="0.000001" step="any" value="${item.duration_s ?? ''}" placeholder="Unknown"></label></div>
      <label>Meter details<input name="meter" maxlength="200" value="${e(item.meter || '')}" placeholder="Unknown until available"></label>
      <label>Conditions / notes<textarea name="note" maxlength="2000" rows="2">${e(item.note || '')}</textarea></label>
      <div class="two-columns"><label>Recorded latitude<input name="lat" type="number" min="-85" max="85" step="any" value="${item.lat}" required></label>
      <label>Recorded longitude<input name="lng" type="number" min="-180" max="180" step="any" value="${item.lng}" required></label></div>
      ${item.source_context ? `<p class="hint">Captured model setup: ${e(item.source_context.name)} · ${item.source_context.lwa.toFixed(1)} dB(A) LwA at ${item.source_context.lat.toFixed(5)}, ${item.source_context.lng.toFixed(5)}.</p>` : ''}</details>
      <div class="measurement-actions"><button type="submit" class="secondary compact">Save measurement</button>${id==='draft'?'<button type="button" class="text-button" data-cancel-reading>Cancel</button>':`<button type="button" class="danger" data-delete-reading="${e(id)}">Delete measurement</button>`}</div>
      <p class="hint">${id==='draft'?'Save to record this observation.':'Measured pressure is not equipment sound power.'}</p></form></details>`;
  }

  /** Update only changed records; unrelated unsubmitted editors remain intact. */
  render() {
    const container=$('measurement-cards'),items=[...this.store.measurements,...(this.draft?[{...this.draft,id:'draft'}]:[])];
    for(const card of [...container.children]) if(!items.some(item=>item.id===card.dataset.measurementId)) card.remove();
    items.forEach((item,index)=> {
      let card=[...container.children].find(c=>c.dataset.measurementId===item.id);
      const signature=JSON.stringify(item);
      if(card?.dataset.record===signature) {card.querySelector('.entity-summary strong').textContent=this.label(item,index);return;}
      const open=card?.querySelector('details').open;
      if(!card) {card=document.createElement('div');card.className='item-card measurement-card';card.dataset.measurementId=item.id;container.append(card);}
      card.innerHTML=this.card(item,index);card.dataset.record=signature;
      if(open) card.querySelector('details').open=true;
    });
    $('measurement-count').textContent=String(this.store.measurements.length);
    $('add-measurement').disabled=!!this.draft || this.store.measurements.length>=100;
    this.renderMarkers();this.updateResults();
  }

  /** Keep source selectors current without replacing other draft fields. */
  updateSourceOptions() {
    for(const form of $('measurement-cards').querySelectorAll('form[data-reading]')) {
      const item=this.store.measurements.find(m=>m.id===form.dataset.reading) || {};
      const select=form.elements.namedItem('source_id'),value=select.value;
      select.innerHTML=this.sourceOptions(value,item);
    }
  }

  /** @param {SubmitEvent} event Commit a valid pressure observation, never model inputs. */
  save(event) {
    const form=event.target.closest('form[data-reading]');if(!form) return;
    event.preventDefault();if(!form.reportValidity()) return;
    const data=new FormData(form),id=form.dataset.reading;
    const current=this.store.measurements.find(m=>m.id===id);
    const source_id=String(data.get('source_id')) || null;
    const item={name:String(data.get('name')).trim(),level_db:Number(data.get('level_db')),metric:String(data.get('metric')),test_kind:String(data.get('test_kind')),
      duration_s:data.get('duration_s')===''?null:Number(data.get('duration_s')),source_id,
      source_context:source_id ? current?.source_id===source_id ? current.source_context : this.context(source_id) : null,
      activity:String(data.get('activity')).trim(),meter:String(data.get('meter')).trim(),note:String(data.get('note')).trim(),lat:Number(data.get('lat')),lng:Number(data.get('lng'))};
    if(id==='draft') {this.draft=null;const created=this.store.addMeasurement(item);if(created) this.open(created);}
    else {this.store.updateMeasurement(id,item);this.open(id);}
    this.say('Measurement recorded. Model inputs were not changed.');
  }

  /** @param {string} id Observation/draft to inspect. */
  open(id) {
    this.settings.open=true;
    const card=[...$('measurement-cards').children].find(c=>c.dataset.measurementId===id);if(!card) return;
    const details=card.querySelector('details');if(!details.open) details.querySelector('summary').click();
    requestAnimationFrame(()=>card.querySelector('[name=level_db]').focus());
  }

  /** Distinct fixed observation markers; source movement never changes their locations. */
  renderMarkers() {
    this.layer.clearLayers();
    const items=[...this.store.measurements,...(this.draft?[{...this.draft,id:'draft'}]:[])];
    items.forEach((item,index)=> {
      const text=item.level_db==null?'…':item.level_db.toFixed(1),units=item.metric && item.metric!=='unknown'?'dB(A)':'dB · type unknown';
      const marker=L.marker([item.lat,item.lng],{draggable:false,icon:L.divIcon({className:'measurement-location',iconSize:[120,40],iconAnchor:[60,20],html:`<div class="measurement-pin" data-measurement-pin="${escapeHtml(item.id)}"><b>${item.id==='draft'?'New':'M'+(index+1)}</b><strong>${text}<small>${units} · measured</small></strong></div>`})}).addTo(this.layer);
      marker.getElement().setAttribute('aria-label',`${this.label(item,index)}: ${text} ${units}, measured pressure. Open observation.`);
      const tooltip=document.createElement('span'),title=document.createElement('strong');title.textContent=this.label(item,index);tooltip.append(title);
      marker.bindTooltip(tooltip,{direction:'top',className:'object-tooltip'});
      marker.on('tooltipopen',event=>this.manager.fitObjectTooltip?.(event.tooltip,marker));
      marker.on('click',()=>{this.store.setMode(null);this.open(item.id);});
    });
  }

  /** Reuse per-point results; changing only a reading/name/note does not request calculation. */
  refresh() {
    const payload=this.store.toPayload();payload.receivers=[];
    payload.source_modes=Object.fromEntries(this.store.sources.map(s=>[s.id,this.store.typeFor(s).operating_mode || '']));
    const common={source_modes:payload.source_modes,sources:payload.sources,types:payload.sources.map(s=>{const t=payload.types.find(t=>t.id===s.type_id);return [t.id,t.name,t.lwa,t.provenance];}),background:payload.background_db};
    const keys=new Map(this.store.measurements.map(m=>[m.id,JSON.stringify([common,m.id,m.lat,m.lng,m.metric,m.test_kind,m.duration_s,m.activity,m.source_id,m.source_context])]));
    const signature=JSON.stringify([...keys.values()]);if(signature===this.signature) return;
    this.signature=signature;
    const cached={},missing=[];
    for(const item of this.store.measurements) {const value=this.cache.get(keys.get(item.id));if(value) cached[item.id]=structuredClone(value);else missing.push(item);}
    this.results=cached;this.updateResults();$('retry-measurements').hidden=true;
    this.lane.schedule('/api/measurements/compare',{...payload,measurements:missing},{
      success:rows=> {
        for(const item of missing) if(rows[item.id]) {this.cache.set(keys.get(item.id),structuredClone(rows[item.id]));if(this.cache.size>256)this.cache.delete(this.cache.keys().next().value);}
        this.results={...cached,...rows};this.updateResults();
      },
      error:error=> {this.results={...cached,...Object.fromEntries(missing.map(m=>[m.id,{point:null,reason:`Comparison unavailable: ${error.message}`}]))};$('retry-measurements').hidden=false;this.updateResults();},
    },missing.length ? null : {});
  }

  /** Replace comparison text only, preserving active editors and observed pressure values. */
  updateResults() {
    for(const card of $('measurement-cards').children) {
      const item=this.store.measurements.find(m=>m.id===card.dataset.measurementId);
      const target=card.querySelector('[data-comparison]');if(!item || !target) continue;
      const result=this.results[item.id],point=result?.point;
      const estimate=!result?'Calculating…':!point?'Not comparable':point.status==='negligible'?'Negligible overall increase':point.level_db==null?'No source contribution':`${point.level_db.toFixed(1)} dB(A)`;
      target.className='measurement-comparison';
      target.innerHTML=`<p><strong>Measured total:</strong> ${item.level_db.toFixed(1)} ${item.metric==='unknown'?'dB · reading type unknown':'dB(A) · '+item.metric}</p><p><strong>Current machinery-only estimate:</strong> ${estimate}</p><p class="hint">${escapeHtml(result?.reason || 'Checking the current scenario at this recorded location.')}${point?.near_field?' Within 1 m: numerical limit applies.':''}</p>`;
    }
  }
}
