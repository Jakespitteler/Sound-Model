/** @fileoverview In-session comparison of source configurations at the same receiver locations. */
import {$,escapeHtml} from './utils.js';
import {RequestLane} from './api.js';
import {receiverLabel} from './state.js';

/** Track a captured source configuration separately from the editable scenario. */
export class ReceiverBaseline {
  /** @param {import('./state.js').ScenarioStore} store Current scenario. */
  constructor(store) {
    this.store=store;
    this.lane=new RequestLane();
    this.baseline=null;
    this.results=null;
    this.key=null;
    $('capture-baseline').onclick=()=>{
      this.baseline=this.sourceSnapshot();
      $('capture-baseline').textContent='Replace baseline';
      $('clear-baseline').hidden=false;
      this.key=null;
      this.refresh();
    };
    $('clear-baseline').onclick=()=>this.clear();
    $('retry-baseline').onclick=()=>{this.key=null;this.refresh();};
    store.subscribe(reason=>{
      if(reason==='restore') this.clear();
      else if(reason==='receiver-name') this.render();
      else if(['geometry','receivers','catalogue'].includes(reason)) this.refresh();
    });
    this.clear();
  }

  /** @return {Object} Detached acoustic inputs limited to active sources. */
  sourceSnapshot() {
    const {sources,types}=this.store;
    const activeTypes=new Set(sources.map(source=>source.type_id));
    return {
      sources:structuredClone(sources),
      types:types.filter(type=>activeTypes.has(type.id)).map(({id,name,lwa})=>({id,name,lwa})),
    };
  }

  /** Cancel comparison work and remove the in-memory baseline. */
  clear() {
    this.lane.cancel();
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
        $('baseline-status').textContent=`Baseline captured with ${count} ${count===1?'source':'sources'}. Levels in dB(A), change in dB.`;
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
