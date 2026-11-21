/** @fileoverview Deliberate preview/apply for isolated-machine and combined-area estimates. */
import {$,escapeHtml as e} from './utils.js';
import {post} from './api.js';
import {fitPreview} from './fit-preview.js';

/** Measurement selection and fixed-source fit UI, with no new propagation model. */
export class FittingUI {
  /** @param {import('./state.js').ScenarioStore} store Current scenario.
   * @param {import('./map-manager.js').MapManager} manager Shared map/placement.
   * @param {function(string):void} say Status writer.
   * @param {function(string):void} openMeasurement Reveal an original reading to edit. */
  constructor(store,manager,say,openMeasurement=()=>{}) {
    this.formClick=event=>{const edit=event.target.closest('[data-open-reading]');if(edit)openMeasurement(edit.dataset.openReading);};
    this.store=store;this.manager=manager;this.say=say;this.preview=null;this.generation=0;
    this.root=$('measurement-fit');this.form=$('fit-form');this.layer=L.layerGroup().addTo(manager.map);
    this.draftLayer=L.layerGroup().addTo(manager.map);
    this.form.addEventListener('click',this.formClick);
    this.form.addEventListener('input',()=>{this.invalidate();this.syncMode();this.drawArea();});
    this.form.addEventListener('change',()=>{this.invalidate();this.syncMode();this.drawArea();});
    this.form.addEventListener('submit',event=>{event.preventDefault();this.calculate();});
    $('apply-fit-form').onsubmit=event=>{event.preventDefault();this.apply();};
    $('mark-fit-area').onclick=()=>store.setMode('fit-area');
    manager.map.on('click',event=> {
      if(store.mode!=='fit-area') return;
      this.form.elements.lat.value=Math.max(-85,Math.min(85,event.latlng.lat));
      this.form.elements.lng.value=((event.latlng.lng+180)%360+360)%360-180;
      store.setMode(null);this.invalidate();this.drawArea();$('fit-radius').focus();
    });
    this.root.addEventListener('toggle',()=>{if(!this.root.open && store.mode==='fit-area') store.setMode(null);this.drawArea();});
    const workspace=this.root.closest('.measurement-settings');
    workspace?.addEventListener('toggle',()=>{
      if(!workspace.open && store.mode==='fit-area') store.setMode(null);
      this.drawArea();
    });
    document.querySelector('.sidebar')?.addEventListener('sidebar-view',()=>this.drawArea());
    store.subscribe(reason=> {
      if(reason==='ui') return;
      this.invalidate();
      if(reason==='restore') {this.form.reset();$('fit-selections').replaceChildren();this.root.open=false;}
      this.choices(reason==='restore');this.drawArea();
    });
    this.choices(true);
  }

  /** Cancel stale previews after any accepted input or scene change. */
  invalidate() {
    this.generation++;this.controller?.abort();this.preview=null;
    $('fit-result').replaceChildren();$('apply-fit-form').hidden=true;$('apply-fit').hidden=true;$('fit-error').textContent='';
    $('preview-fit').hidden=false;$('preview-fit').disabled=false;
  }

  /** Refresh choices while preserving in-progress edits.
   * @param {boolean} [fresh] Select an available starting mode for a new scenario. */
  choices(fresh=false) {
    const select=this.form.elements.source_id,previous=select.value;
    select.innerHTML='<option value="">Choose machine</option>'+this.store.sources.flatMap((s,index)=>s.disabled || this.store.typeFor(s).kind==='area'?[]:[`<option value="${e(s.id)}">${index+1}. ${e(this.store.typeFor(s).name)}</option>`]).join('');
    select.value=previous;
    const machineMode=this.form.elements.mode.querySelector('option[value=machine]');
    machineMode.disabled=select.options.length===1;
    if(machineMode.disabled) this.form.elements.mode.value='area';
    else if(fresh) this.form.elements.mode.value='machine';
    if(select.options.length===2 && !select.value) select.selectedIndex=1;
    const holder=$('fit-selections');
    for(const row of [...holder.children]) if(!this.store.measurements.some(m=>m.id===row.dataset.fitReading)) row.remove();
    this.store.measurements.forEach((item,index)=> {
      let row=[...holder.children].find(r=>r.dataset.fitReading===item.id);
      if(!row) {row=document.createElement('label');row.className='fit-selection';row.dataset.fitReading=item.id;
        row.innerHTML=`<span></span><select aria-label="Use measurement ${index+1}"><option value="skip">Leave out</option><option value="fit">Build estimate</option><option value="check">Check prediction</option></select>`;holder.append(row);}
      row.querySelector('span').textContent=`${item.name || 'Measurement '+(index+1)} · ${item.level_db.toFixed(1)} dB · ${item.activity || 'Activity not recorded'}`;
      if(!row.querySelector('button')) {const edit=document.createElement('button');edit.type='button';edit.className='text-button';edit.textContent='Edit';edit.dataset.openReading=item.id;row.append(edit);}
    });
    const activities=[...new Set(this.store.measurements.map(item=>(item.activity || '').trim()).filter(Boolean))];
    $('fit-activities').innerHTML=activities.map(activity=>`<option value="${e(activity)}"></option>`).join('');
    $('fit-empty').hidden=!!this.store.measurements.length;this.syncMode();
  }

  /** Expose only the selected workflow's fields. */
  syncMode() {
    const area=this.form.elements.mode.value==='area';
    if(!area && this.store.mode==='fit-area') this.store.setMode(null);
    this.form.elements.activity.setCustomValidity(this.form.elements.activity.value.trim()?'':'Enter the operating activity.');
    this.form.elements.area_name.setCustomValidity(!area || this.form.elements.area_name.value.trim()?'':'Enter an area name.');
    $('fit-machine-fields').hidden=area;$('fit-area-fields').hidden=!area;
    $('fit-machine').required=!area;$('fit-machine').disabled=area;
    for(const input of $('fit-area-fields').querySelectorAll('input:not([type=checkbox])')) {input.required=area;input.disabled=!area;}
    $('fit-background').textContent=this.store.background_db==null?'Enter the background measured without the activity you are estimating.':`Background: ${this.store.background_db} dB(A)`;
  }

  /** @param {string} sourceId Placed machine selected for calibration.
   * @param {string} activity Operating activity selected for the test.
   * @return {Object[]} Prior catalogue setups still referenced by this machine’s readings. */
  previousSetups(sourceId,activity) {
    const source=this.store.sources.find(item=>item.id===sourceId);
    if(!source) return [];
    const type=this.store.typeFor(source),previous=type.fitting?.request;
    if(previous?.mode!=='machine' || previous.source_id!==source.id ||
      previous.activity!==activity || type.operating_mode!==activity) return [];
    const original=previous.sources.find(item=>item.id===source.id);
    if(!original) return [];
    const setups=[{type_id:original.type_id,operating_mode:previous.source_modes?.[source.id] || ''},
      ...(previous.previous_setups || [])];
    const used=new Map();
    for(const reading of this.store.measurements) {
      const context=reading.source_context;
      if(context?.id!==source.id || reading.activity!==activity) continue;
      const setup=setups.find(item=>item.type_id===context.type_id && item.operating_mode===context.operating_mode);
      if(setup) used.set(JSON.stringify(setup),setup);
    }
    return [...used.values()];
  }

  /** @return {Object} Detached fitting request, never a receiver/contour payload. */
  payload() {
    const f=this.form.elements,fit_ids=[],check_ids=[];
    for(const row of $('fit-selections').children) {
      const role=row.querySelector('select').value;
      if(role==='fit') fit_ids.push(row.dataset.fitReading);
      if(role==='check') check_ids.push(row.dataset.fitReading);
    }
    const mode=f.mode.value,activity=f.activity.value.trim();
    const sourceId=mode==='machine'?f.source_id.value:null;
    return {...this.store.toPayload(),receivers:[],measurements:structuredClone(this.store.measurements),
      source_modes:Object.fromEntries(this.store.activeSources().map(s=>[s.id,this.store.typeFor(s).operating_mode || ''])),
      mode,source_id:sourceId,centre:mode==='area'?{lat:Number(f.lat.value),lng:Number(f.lng.value)}:null,
      radius_m:mode==='area'?Number(f.radius.value):null,activity,
      previous_setups:sourceId?this.previousSetups(sourceId,activity):[],
      background_confirmed:f.background_confirmed.checked,fit_ids,check_ids};
  }

  /** Calculate once after explicit submission; reject responses for any superseded input. */
  async calculate() {
    this.invalidate();if(!this.form.checkValidity()) {this.form.dispatchEvent(new Event('fit-invalid'));this.form.reportValidity();return;}
    const request=this.payload();
    if(request.fit_ids.length<2 || !request.check_ids.length) {$('fit-error').textContent='Choose at least two readings to Build estimate and one different reading to Check prediction.';return;}
    const generation=this.generation;this.controller=new AbortController();$('preview-fit').disabled=true;
    $('fit-error').textContent='Calculating preview…';
    try {
      const result=await post('/api/measurements/fit',request,this.controller.signal);
      if(generation!==this.generation) return;
      const source=request.sources.find(item=>item.id===request.source_id);
      const currentPower=request.types.find(type=>type.id===source?.type_id)?.lwa;
      $('fit-error').textContent='';
      $('fit-result').innerHTML=fitPreview(result,request.measurements,{currentPower});
      $('fit-result').focus({preventScroll:true});$('fit-result').scrollIntoView({block:'start'});
      $('apply-fit').hidden=!result.ready;
      this.preview=result.ready?{request,result,name:this.form.elements.area_name.value}:null;
      if(this.preview) {this.showApply();$('preview-fit').hidden=true;}
    } catch(error) {if(generation===this.generation && error.name!=='AbortError') $('fit-error').textContent=error.message;}
    finally {if(generation===this.generation) $('preview-fit').disabled=false;}
  }

  /** Name the map change on the action that commits the reviewed estimate. */
  showApply() {
    const area=this.preview.request.mode==='area';
    const count=this.store.sources.length;
    const button=$('apply-fit');
    button.textContent='Apply to this machine';
    if(area) {
      button.textContent=count
        ? `Replace ${count} ${count===1?'source':'sources'} with this area estimate`
        : 'Add area estimate to map';
    }
    $('fit-area-next').hidden=!area;
    $('apply-fit-form').hidden=false;
  }

  /** Apply only the current reviewed preview; machine calibration affects one placed instance. */
  apply() {
    const preview=this.preview;if(!preview) return;
    if(!this.store.applyMeasurementFit(preview.request,preview.result,preview.name)) {
      $('fit-error').textContent='Could not apply. Check the selected source and the 50-type catalogue limit.';return;
    }
    this.root.open=false;document.dispatchEvent(new Event('estimate-applied'));
    this.say(preview.request.mode==='area'?'Area estimate added. Use Place machine to add separate equipment.':'Calibration applied to this machine only. Original catalogue data and readings were retained.');
  }

  /** Draw a draggable centre for the draft only.
   * @param {L.LatLng} centre Current draft centre. @param {number} radius Draft radius in metres. */
  drawDraftArea(centre,radius) {
    const circle=L.circle(centre,{radius,color:'#176a63',weight:2,dashArray:'5 5',fillOpacity:.06,interactive:false}).addTo(this.draftLayer);
    const handle=L.marker(centre,{draggable:true,icon:L.divIcon({
      className:'fit-centre-handle',iconSize:[24,24],iconAnchor:[12,12],html:'<span aria-hidden="true">✥</span>'
    })}).addTo(this.draftLayer);
    handle.getElement().setAttribute('aria-label','Drag the draft area centre. Use centre coordinates for keyboard entry.');
    handle.bindTooltip('Drag area centre',{direction:'top'});
    handle.on('drag',()=>circle.setLatLng(handle.getLatLng()));
    handle.on('dragend',()=>{
      const point=handle.getLatLng().wrap();
      this.form.elements.lat.value=Math.max(-85,Math.min(85,point.lat));
      this.form.elements.lng.value=point.lng;
      this.invalidate();
      this.drawArea();
    });
  }

  /** Render the operating footprint as context only, never as an attenuation barrier. */
  drawArea() {
    this.layer.clearLayers();
    for(const source of this.store.activeSources()) {
      const type=this.store.typeFor(source);
      if(type.kind==='area' && type.fitting) L.circle([source.lat,source.lng],{radius:type.fitting.request.radius_m,color:'#176a63',weight:2,dashArray:'5 5',fillOpacity:.04,interactive:false}).addTo(this.layer);
    }
    const f=this.form.elements;
    const fields=[f.lat,f.lng,f.radius];
    const showDraft=this.root.open && !this.root.closest('[hidden]')
      && !this.root.parentElement.closest('details:not([open])') && f.mode.value==='area'
      && fields.every(input=>input.value && input.checkValidity());
    const key=showDraft?fields.map(input=>input.valueAsNumber).join(','):null;
    // A field can commit on blur as the user starts dragging. Keep the current handle
    // attached when that change event describes the same circle.
    if(key===this.draftKey) return;
    this.draftKey=key;
    this.draftLayer.clearLayers();
    if(showDraft) this.drawDraftArea(L.latLng(f.lat.valueAsNumber,f.lng.valueAsNumber),f.radius.valueAsNumber);
  }
}
