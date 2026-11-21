/** @fileoverview In-session comparison of source configurations at the same receiver locations. */
import {$,escapeHtml} from './utils.js';
import {RequestLane} from './api.js';
import {receiverLabel} from './state.js';
import {request} from './scenario-files.js';

/** Track a captured source configuration separately from the editable scenario. */
export class ReceiverBaseline {
  /** @param {import('./state.js').ScenarioStore} store Current scenario. */
  constructor(store) {
    this.store=store;
    this.lane=new RequestLane();
    this.baseline=null;
    this.results=null;
    this.key=null;
    this.loadRevision=0;
    $('capture-baseline').onclick=()=>this.setBaseline(this.sourceSnapshot(),'Captured baseline');
    $('choose-saved-baseline').onclick=()=>this.listSaved();
    $('saved-baseline-form').onsubmit=event=>{event.preventDefault();this.loadSaved();};
    $('clear-baseline').onclick=()=>this.clear();
    $('retry-baseline').onclick=()=>{this.key=null;this.refresh();};
    store.subscribe(reason=>{
      if(reason==='restore') this.clear();
      else if(reason==='receiver-name') this.render();
      else if(['geometry','receivers','catalogue'].includes(reason)) this.refresh();
    });
    this.clear();
  }

  /** @param {Object} [document] Saved scenario; defaults to the current placement state.
   * @return {Object} Detached acoustic inputs limited to active sources. */
  sourceSnapshot(document) {
    const types=document?.types ?? this.store.types;
    const excluded=new Set(document?.disabled_source_ids ?? []);
    const sources=document?document.sources.filter(source=>!excluded.has(source.id)):this.store.activeSources();
    const activeTypes=new Set(sources.map(source=>source.type_id));
    return {
      sources:sources.map(({id,type_id,lat,lng})=>({id,type_id,lat,lng})),
      types:types.filter(type=>activeTypes.has(type.id)).map(({id,name,lwa})=>({id,name,lwa})),
    };
  }

  /** @param {Object} snapshot Detached baseline sound sources. @param {string} label Display label. */
  setBaseline(snapshot,label) {
    this.loadRevision++;
    this.baseline=snapshot;
    this.baselineLabel=label;
    $('saved-baseline-form').hidden=true;
    $('capture-baseline').textContent='Replace baseline';
    $('clear-baseline').hidden=false;
    this.key=null;
    this.refresh();
  }

  /** Offer stored scenarios without opening or changing the working scene. */
  async listSaved() {
    const revision=++this.loadRevision,form=$('saved-baseline-form'),status=$('saved-baseline-status');
    const select=$('saved-baseline-select'),submit=form.querySelector('[type=submit]');
    form.hidden=false;
    select.replaceChildren(new Option('Choose a saved scenario',''));
    submit.disabled=true;status.textContent='Loading saved scenarios…';
    try {
      const data=await request('/api/scenarios');
      if(revision!==this.loadRevision) return;
      select.append(...data.scenarios.map(item=>new Option(item.name,item.id)));
      submit.disabled=!data.scenarios.length;
      status.textContent=data.scenarios.length?'':'No readable saved scenarios.';
      select.focus();
    } catch(error) {if(revision===this.loadRevision) status.textContent=error.message;}
  }

  /** Load only the saved source configuration as the new comparison baseline. */
  async loadSaved() {
    const id=$('saved-baseline-select').value;
    if(!id) return;
    const revision=++this.loadRevision, status=$('saved-baseline-status');
    status.textContent='Loading baseline…';
    try {
      const saved=await request(`/api/scenarios/${encodeURIComponent(id)}`);
      if(revision===this.loadRevision) this.setBaseline(this.sourceSnapshot(saved.document),saved.name);
    } catch(error) {if(revision===this.loadRevision) status.textContent=error.message;}
  }

  /** Cancel comparison work and remove the in-memory baseline. */
  clear() {
    this.lane.cancel();
    this.loadRevision++;
    $('saved-baseline-form').hidden=true;
    this.baseline=null;
    this.results=null;
    this.key=null;
    $('capture-baseline').textContent='Capture baseline';
    $('clear-baseline').hidden=true;
    $('retry-baseline').hidden=true;
    $('baseline-status').textContent='The baseline lasts until you open or reload a scenario.';
    this.render();
  }

  /** Recalculate only when source acoustics or receiver locations change. */
  refresh() {
    if(!this.baseline) return;
    const current=this.sourceSnapshot();
    current.receivers=this.store.receivers.map(({id,lat,lng})=>({id,lat,lng}));
    const acousticKey=current.sources.map(source=>[
      source.lat,source.lng,current.types.find(type=>type.id===source.type_id).lwa,
    ]);
    const key=JSON.stringify([acousticKey,current.receivers]);
    if(key===this.key) return;
    this.key=key;
    $('retry-baseline').hidden=true;
    if(!current.receivers.length) {
      this.lane.cancel();
      this.results=null;
      $('baseline-status').textContent='Baseline captured. Add a listening point to compare.';
      this.render();
      return;
    }
    this.lane.schedule('/api/receivers/baseline',{baseline:this.baseline,current},{
      start:()=>{
        this.results=null;
        $('baseline-status').textContent='Updating comparison…';
        this.render();
      },
      success:results=>{
        this.results=results;
        const count=this.baseline.sources.length;
        $('baseline-status').textContent=`${this.baselineLabel} · ${count} ${count===1?'source':'sources'}. Levels in dB(A), change in dB.`;
        this.render();
      },
      error:()=>{
        $('baseline-status').textContent='Comparison unavailable.';
        $('retry-baseline').hidden=false;
      },
    });
  }

  /** Render at current receiver names without requesting acoustic work. */
  render() {
    if(!this.results) {$('baseline-results').replaceChildren();return;}
    const level=value=>value==null?'No sources':value.toFixed(1);
    const rows=this.store.receivers.map((receiver,index)=>{
      const row=this.results[receiver.id];
      if(!row) return '';
      const change=row.change_db==null?'—':Math.abs(row.change_db)<0.05?'0.0'
        :`${row.change_db>0?'+':''}${row.change_db.toFixed(1)}`;
      return `<tr><th scope="row">${escapeHtml(receiverLabel(receiver,index))}${row.near_field?'<small>Within 1 m of a source</small>':''}</th><td>${level(row.baseline_db)}</td><td>${level(row.current_db)}</td><td>${change}</td></tr>`;
    }).join('');
    $('baseline-results').innerHTML=`<table class="baseline-table" aria-label="Machinery levels at each receiver">
      <thead><tr><th scope="col">Receiver</th><th scope="col">Baseline</th><th scope="col">Current</th><th scope="col">Change</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
}
