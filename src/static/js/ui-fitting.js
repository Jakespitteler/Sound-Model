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
    this.form.addEventListener('click',this.formClick);
    this.form.addEventListener('input',()=>{this.invalidate();this.syncMode();this.drawArea();});
    this.form.addEventListener('change',()=>{this.invalidate();this.syncMode();this.drawArea();});
    this.form.addEventListener('submit',event=>{event.preventDefault();this.calculate();});
    $('apply-fit').onclick=()=>this.apply();
    $('mark-fit-area').onclick=()=>store.setMode('fit-area');
    manager.map.on('click',event=> {
      if(store.mode!=='fit-area') return;
      this.form.elements.lat.value=Math.max(-85,Math.min(85,event.latlng.lat));
      this.form.elements.lng.value=((event.latlng.lng+180)%360+360)%360-180;
      store.setMode(null);this.invalidate();this.drawArea();$('fit-radius').focus();
    });
    this.root.addEventListener('toggle',()=>{if(!this.root.open && store.mode==='fit-area') store.setMode(null);this.drawArea();});
    store.subscribe(reason=> {
      if(reason==='ui') return;
      this.invalidate();
      if(reason==='restore') {this.form.reset();$('fit-selections').replaceChildren();this.root.open=false;}
      this.choices();this.drawArea();
    });
    this.choices();this.syncMode();
  }

  /** Cancel stale previews after any accepted input or scene change. */
  invalidate() {
    this.generation++;this.controller?.abort();this.preview=null;
    $('fit-result').replaceChildren();$('apply-fit').hidden=true;$('fit-error').textContent='';
    $('preview-fit').disabled=false;
  }

  /** Refresh keyed options without losing roles selected for other records. */
  choices() {
    const select=this.form.elements.source_id,previous=select.value;
    select.innerHTML='<option value="">Choose machine</option>'+this.store.sources.flatMap((s,index)=>this.store.typeFor(s).kind==='area'?[]:[`<option value="${e(s.id)}">${index+1}. ${e(this.store.typeFor(s).name)}</option>`]).join('');
    select.value=previous;
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
    $('replace-fit-sources-label').hidden=!area || !this.store.sources.length;
    this.form.elements.replace.required=area && !!this.store.sources.length;
    $('fit-background').textContent=this.store.background_db==null?'Background not set — enter it in the scenario first.':`Background: ${this.store.background_db} dB(A)`;
  }

  /** @return {Object} Detached fitting request, never a receiver/contour payload. */
  payload() {
    const f=this.form.elements,fit_ids=[],check_ids=[];
    for(const row of $('fit-selections').children) {
      const role=row.querySelector('select').value;
      if(role==='fit') fit_ids.push(row.dataset.fitReading);
      if(role==='check') check_ids.push(row.dataset.fitReading);
    }
    const mode=f.mode.value;
    return {...this.store.toPayload(),receivers:[],measurements:structuredClone(this.store.measurements),
      source_modes:Object.fromEntries(this.store.sources.map(s=>[s.id,this.store.typeFor(s).operating_mode || ''])),
      mode,source_id:mode==='machine'?f.source_id.value:null,centre:mode==='area'?{lat:Number(f.lat.value),lng:Number(f.lng.value)}:null,
      radius_m:mode==='area'?Number(f.radius.value):null,activity:f.activity.value.trim(),
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
      $('fit-error').textContent='';$('fit-result').innerHTML=fitPreview(result,request.measurements);
      $('fit-result').focus({preventScroll:true});$('fit-result').scrollIntoView({block:'start'});
      $('apply-fit').hidden=!result.ready;
      this.preview={request,result,name:this.form.elements.area_name.value,replace:this.form.elements.replace.checked};
    } catch(error) {if(generation===this.generation && error.name!=='AbortError') $('fit-error').textContent=error.message;}
    finally {if(generation===this.generation) $('preview-fit').disabled=false;}
  }

  /** Apply only the current reviewed preview; machine calibration affects one placed instance. */
  apply() {
    const preview=this.preview;if(!preview) return;
    if(!this.store.applyMeasurementFit(preview.request,preview.result,preview.name,preview.replace)) {
      $('fit-error').textContent='Could not apply. Check source selection and the 50-type catalogue limit.';return;
    }
    this.root.open=false;document.dispatchEvent(new Event('estimate-applied'));
    this.say(preview.request.mode==='area'?'Area estimate applied. Receivers and contours now use its combined emission.':'Calibration applied to this machine only. Original catalogue data and readings were retained.');
  }

  /** Render the operating footprint as context only, never as an attenuation barrier. */
  drawArea() {
    this.layer.clearLayers();
    for(const source of this.store.sources) {
      const type=this.store.typeFor(source);
      if(type.kind==='area' && type.fitting) L.circle([source.lat,source.lng],{radius:type.fitting.request.radius_m,color:'#176a63',weight:2,dashArray:'5 5',fillOpacity:.04,interactive:false}).addTo(this.layer);
    }
    const f=this.form.elements;
    if(!this.root.open || f.mode.value!=='area' || !f.lat.value || !f.lng.value || !f.radius.value) return;
    if(![f.lat,f.lng,f.radius].every(input=>input.checkValidity())) return;
    L.circle([Number(f.lat.value),Number(f.lng.value)],{radius:Number(f.radius.value),color:'#176a63',weight:2,dashArray:'5 5',fillOpacity:.06,interactive:false}).addTo(this.layer);
  }
}
