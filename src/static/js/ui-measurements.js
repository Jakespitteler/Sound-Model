/** @fileoverview Independent field observations; never calibration or source power inputs. */
import {$,escapeHtml} from './utils.js';
import {measurementLabel} from './state.js';
import {RequestLane} from './api.js';
import {objectDistance} from './local-area.js';

/** Measurement records, movable pins and a bounded cached direct-comparison lane. */
export class MeasurementUI {
  /** @param {import('./state.js').ScenarioStore} store Scenario state.
   * @param {import('./map-manager.js').MapManager} manager Map and placement state.
   * @param {function(string):void} say Status writer. */
  constructor(store,manager,say) {
    this.store=store;this.manager=manager;this.say=say;this.draft=null;
    this.layer=L.layerGroup().addTo(manager.map);this.lane=new RequestLane();
    this.cache=new Map();this.results={};this.signature=null;
    this.settings=document.querySelector('.measurement-settings');
    this.activities=document.createElement('datalist');
    this.activities.id='measurement-activities';
    this.settings.append(this.activities);
    $('measurement-filter')?.addEventListener('change',()=>this.filterCards());
    $('add-measurement').onclick=()=>store.setMode('measurement');
    $('retry-measurements').onclick=()=>{this.signature=null;this.refresh();};
    manager.map.on('click',event=> {
      if(store.mode!=='measurement') return;
      this.draft={lat:Math.max(-85,Math.min(85,event.latlng.lat)),lng:Math.max(-180,Math.min(180,event.latlng.lng))};
      store.setMode(null);this.render();this.open('draft');
    });
    $('measurement-cards').addEventListener('submit',event=>this.save(event));
    const resetDelete=target=> {const button=target.closest('.measurement-card')?.querySelector('[data-delete-reading]');if(button) {delete button.dataset.confirm;button.textContent='Delete measurement';}};
    $('measurement-cards').addEventListener('input',event=>{
      resetDelete(event.target);
      const form=event.target.closest('form[data-reading]');
      if(form) this.describePair(form);
    });
    $('measurement-cards').addEventListener('change',event=>{
      if(event.target.name==='background_id') this.describePair(event.target.form);
    });
    $('measurement-cards').addEventListener('toggle',event=>{if(!event.target.open) resetDelete(event.target);},true);
    $('measurement-cards').addEventListener('click',event=> {
      const cancel=event.target.closest('[data-cancel-reading]');
      if(cancel) {this.draft=null;this.render();return;}
      const button=event.target.closest('[data-delete-reading]');if(!button) return;
      if(button.dataset.confirm!=='yes') {button.dataset.confirm='yes';button.textContent='Delete this measurement?';return;}
      store.removeMeasurement(button.dataset.deleteReading);say('Measurement deleted.');
    });
    store.subscribe(reason=> {
      if(reason==='restore') {if($('measurement-filter')) $('measurement-filter').value='all';this.draft=null;this.signature=null;this.results={};$('measurement-cards').replaceChildren();}
      if(['measurements','restore'].includes(reason)) this.render();
      if(['geometry','catalogue','equipment-metadata','restore'].includes(reason)) this.updateSourceOptions();
      if(['measurements','geometry','catalogue','background','equipment-metadata','restore'].includes(reason)) this.refresh();
    });
    this.render();
  }

  /** @param {string} id Source ID. @return {?Object} Detached current setup, not derived emission. */
  context(id) {
    const source=this.store.activeSources().find(s=>s.id===id);if(!source) return null;
    const type=this.store.typeFor(source);return {id:source.id,type_id:source.type_id,lat:source.lat,lng:source.lng,name:type.name,lwa:type.lwa,operating_mode:type.operating_mode || ''};
  }

  /** @param {?string} selected Current/draft source link. @param {Object} item Historical record.
   * @return {string} Escaped options, retaining a removed source rather than selecting another. */
  sourceOptions(selected,item) {
    const options=this.store.sources.flatMap((source,index)=>source.disabled && source.id!==selected?[]:[`<option value="${escapeHtml(source.id)}" ${source.id===selected?'selected':''}>${index+1}. ${escapeHtml(this.store.typeFor(source).name)}${source.disabled?' (off)':''}</option>`]);
    if(selected && !this.store.sources.some(s=>s.id===selected)) options.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(item.source_context?.name || 'Recorded machine')} (removed)</option>`);
    return `<option value="">Not linked / unknown</option>${options.join('')}`;
  }

  /** @param {Object} item Observation/draft. @param {number} index List position. @return {string} Form card. */
  card(item,index) {
    const id=item.id || 'draft',e=escapeHtml;
    const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
    return `<details ${id==='draft'?'open':''}><summary class="entity-summary"><strong>${e(id==='draft'?'New measurement':measurementLabel(item,index))}</strong><span class="source-power">${item.level_db==null?'Not recorded':item.level_db.toFixed(1)+' dB'}<small>measured pressure</small></span></summary>
      <div data-comparison></div><form class="measurement-form" data-reading="${e(id)}">
      <label>Name (optional)<input name="name" maxlength="80" value="${e(item.name || '')}"></label>
      <div class="two-columns"><label>Meter reading · dB<input name="level_db" type="number" step="any" value="${item.level_db ?? ''}" required></label>
      <label>Meter reading type<select name="metric">${options([['unknown','Unknown'],['LAeq','LAeq — average'],['LAmax','LAmax — maximum']],item.metric || 'unknown')}</select></label></div>
      <label>What was happening? (activity)<input name="activity" maxlength="200" list="measurement-activities" value="${e(item.activity || '')}" placeholder="e.g. steady idle or loaded pass"></label>
      <div class="two-columns"><label>Test<select name="test_kind">${options([['unknown','Unknown'],['stationary','Stationary / steady'],['moving','Moving / pass-by'],['startup','Startup / brief event']],item.test_kind || 'unknown')}</select></label>
      <label>Duration · seconds<input name="duration_s" type="number" min="0.000001" step="any" value="${item.duration_s ?? ''}" placeholder="Unknown"></label></div>
      <details><summary>Link to a machine (optional)</summary>
      <p class="hint">Link a machine only when its modeled setup represents this test.</p><label>Machine<select name="source_id">${this.sourceOptions(item.source_id,item)}</select></label>
      <label>Other machinery<select name="isolation">${options([['unknown','Unsure'],['isolated','Selected machine was isolated'],['mixed','Other machinery contributing']],item.isolation || 'unknown')}</select></label>
      </details>
      <details><summary>Pair a background reading (optional)</summary>
      <p class="hint">Choose a reading taken here with the activity stopped and comparable conditions. This link records the pair for review.</p>
      <label>Background reading<select name="background_id" data-background-id="${e(item.background_id || '')}"></select></label>
      <p data-pair-status class="hint" role="status"></p></details>
      <details><summary>Notes, meter &amp; coordinates</summary>
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
      if(card?.dataset.record===signature) {card.querySelector('.entity-summary strong').textContent=measurementLabel(item,index);return;}
      // A map correction updates coordinate inputs in place, preserving other unsaved fields.
      if(card) {
        const previous=JSON.parse(card.dataset.record);
        if(JSON.stringify({...item,lat:previous.lat,lng:previous.lng})===card.dataset.record) {
          const fields=card.querySelector('form').elements;
          fields.lat.value=item.lat;
          fields.lng.value=item.lng;
          card.dataset.record=signature;
          return;
        }
      }
      const open=card?.querySelector('details').open;
      if(!card) {card=document.createElement('div');card.className='item-card measurement-card';card.dataset.measurementId=item.id;container.append(card);}
      card.innerHTML=this.card(item,index);card.dataset.record=signature;
      if(open) card.querySelector('details').open=true;
    });
    const activities=new Set(this.store.measurements.map(item=>item.activity).filter(Boolean));
    this.activities.replaceChildren(...[...activities].map(activity=>new Option(activity,activity)));
    $('measurement-count').textContent=String(this.store.measurements.length);
    $('add-measurement').disabled=!!this.draft || this.store.measurements.length>=100;
    this.updatePairs();this.filterCards();this.renderMarkers();this.updateResults();
  }

  /** Separate reading types in the list while keeping all pins on the map. */
  filterCards() {
    const filter=$('measurement-filter');
    if(!filter) return;
    const cards=[...$('measurement-cards').children];
    const items=new Map(this.store.measurements.map(item=>[item.id,item]));
    for(const card of cards) {
      const item=items.get(card.dataset.measurementId);
      const stationary=item?.metric==='LAeq' && item.test_kind==='stationary' && item.duration_s!=null;
      const group=!stationary?'other':item.isolation==='isolated' && item.source_context?'machine':'area';
      card.hidden=!!item && filter.value!=='all' && filter.value!==group;
    }
    $('measurement-filter-empty').hidden=filter.value==='all' || cards.some(card=>!card.hidden);
  }

  /** Keep the link picker up to date without replacing other draft fields. */
  updatePairs() {
    for(const form of $('measurement-cards').querySelectorAll('form[data-reading]')) {
      const select=form.elements.background_id;
      const value=select.options.length?select.value:select.dataset.backgroundId;
      const choices=this.store.measurements.flatMap((reading,index)=>reading.id===form.dataset.reading
        ? [] : [new Option(`${measurementLabel(reading,index)} · ${reading.level_db.toFixed(1)} dB`,reading.id)]);
      if(value && !choices.some(option=>option.value===value)) choices.push(new Option('Saved background reading unavailable',value));
      select.replaceChildren(new Option('No background reading linked',''),...choices);
      select.value=value;
      this.describePair(form);
    }
  }

  /** @param {HTMLFormElement} form Reading editor whose unsaved inputs are being compared. */
  describePair(form) {
    const fields=form.elements,id=fields.background_id.value;
    const output=form.querySelector('[data-pair-status]');
    const background=this.store.measurements.find(item=>item.id===id);
    if(!background) {output.textContent=id?'The linked background reading is unavailable.':'';return;}
    const issues=[];
    const duration=fields.duration_s.valueAsNumber;
    if(fields.metric.value!=='LAeq' || background.metric!=='LAeq') issues.push('Both readings should be LAeq averages');
    if(fields.test_kind.value!=='stationary' || background.test_kind!=='stationary') issues.push('Both readings should use a steady test');
    if(!Number.isFinite(duration) || background.duration_s==null) issues.push('Averaging duration is missing');
    else if(duration!==background.duration_s) issues.push('Averaging durations differ');
    const lat=fields.lat.valueAsNumber,lng=fields.lng.valueAsNumber;
    if(Number.isFinite(lat) && Number.isFinite(lng)) {
      const distance=objectDistance({lat,lng},background);
      if(distance>5) issues.push(`Readings are ${Math.round(distance)} m apart`);
    }
    const gap=fields.level_db.valueAsNumber-background.level_db;
    if(Number.isFinite(gap) && gap<3) issues.push('Operating reading is less than 3 dB above background');
    output.textContent=issues.length?`${issues.join('. ')}.`:'Recorded settings match. Confirm the activity was stopped and other conditions were comparable.';
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
      background_id:String(data.get('background_id') || '') || null,
      duration_s:data.get('duration_s')===''?null:Number(data.get('duration_s')),source_id,
      source_context:source_id ? current?.source_id===source_id ? current.source_context : this.context(source_id) : null,
      isolation:String(data.get('isolation')),activity:String(data.get('activity')).trim(),meter:String(data.get('meter')).trim(),note:String(data.get('note')).trim(),lat:Number(data.get('lat')),lng:Number(data.get('lng'))};
    if(id==='draft') {this.draft=null;const created=this.store.addMeasurement(item);if(created) this.open(created);}
    else {this.store.updateMeasurement(id,item);this.open(id);}
    this.say('Measurement recorded. Model inputs were not changed.');
  }

  /** @param {string} id Observation/draft to inspect. */
  open(id) {
    document.dispatchEvent(new Event('open-measurement'));
    this.settings.open=true;
    const card=[...$('measurement-cards').children].find(c=>c.dataset.measurementId===id);if(!card) return;
    if(card.hidden) {$('measurement-filter').value='all';this.filterCards();}
    const details=card.querySelector('details');if(!details.open) details.querySelector('summary').click();
    requestAnimationFrame(()=>card.querySelector('[name=level_db]').focus());
  }

  /** Render observation markers. Dragging corrects only the selected reading’s coordinates. */
  renderMarkers() {
    this.manager.objectControls?.clear(['measurements']);
    this.layer.clearLayers();
    const items=[...this.store.measurements,...(this.draft?[{...this.draft,id:'draft'}]:[])];
    items.forEach((item,index)=> {
      const text=item.level_db==null?'…':item.level_db.toFixed(1),units=item.metric && item.metric!=='unknown'?'dB(A)':'dB · type unknown';
      const marker=L.marker([item.lat,item.lng],{draggable:true,icon:L.divIcon({className:'measurement-location',iconSize:[140,44],iconAnchor:[70,22],html:`<div class="measurement-pin" data-measurement-pin="${escapeHtml(item.id)}"><b>${item.id==='draft'?'New':'M'+(index+1)}</b><span><span class="measurement-label">${escapeHtml(item.id==='draft'?'New measurement':measurementLabel(item,index))}</span><strong>${text} <small>${units}</small></strong></span></div>`})}).addTo(this.layer);
      marker.getElement().setAttribute('aria-label',`${measurementLabel(item,index)}: ${text} ${units}, measured pressure. Drag to correct its location or select for actions.`);
      const tooltip=document.createElement('span'),title=document.createElement('strong');title.textContent=measurementLabel(item,index);tooltip.append(title);
      marker.bindTooltip(tooltip,{direction:'top',className:'object-tooltip'});
      marker.on('tooltipopen',event=>this.manager.fitObjectTooltip?.(event.tooltip,marker));
      marker.on('dragend',()=>{
        const point=marker.getLatLng().wrap();
        const position={lat:Math.max(-85,Math.min(85,point.lat)),lng:point.lng};
        if(item.id==='draft') {
          this.draft=position;
          this.render();
        } else {
          this.store.updateMeasurement(item.id,position);
        }
        this.say('Measurement location updated.');
      });
      if(item.id==='draft' || !this.manager.objectControls) {
        marker.on('click',()=>{this.store.setMode(null);this.open(item.id);});
        return;
      }
      const popup=document.createElement('div');
      popup.className='object-popup';
      const name=document.createElement('strong');
      name.textContent=measurementLabel(item,index);
      const level=document.createElement('p');
      level.textContent=`${text} ${units} · measured`;
      const edit=document.createElement('button');
      edit.type='button';edit.className='text-button';edit.textContent='Edit measurement';
      edit.onclick=()=>{marker.closePopup();this.open(item.id);};
      popup.append(name,level,edit);
      this.manager.objectControls.bind(marker,'measurements',item.id,popup);
    });
    this.manager.objectControls?.refresh();
  }

  /** Reuse per-point results; changing only a reading/name/note does not request calculation. */
  refresh() {
    const payload=this.store.toPayload();payload.receivers=[];
    payload.source_modes=Object.fromEntries(payload.sources.map(s=>[s.id,this.store.typeFor(s).operating_mode || '']));
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
