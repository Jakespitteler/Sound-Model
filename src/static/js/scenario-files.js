/** @fileoverview Explicit named local saves, reopen and last-saved-URL restoration. */
import {$,escapeHtml} from './utils.js';
import {ScenarioStore} from './state.js';

/** @param {string} path API route. @param {string} [method] HTTP method. @param {Object} [body] JSON body. @return {Promise<Object>} Validated API result. */
async function request(path, method = 'GET', body) {
  const response = await fetch(path,{method,headers:body ? {'Content-Type':'application/json'} : {},body:body ? JSON.stringify(body) : undefined});
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail==='string' ? data.detail : `Scenario request failed (${response.status}).`);
  return data;
}

/** Save documents separately from acoustic payloads, retaining estimate notes and source kinds. */
export class ScenarioFilesUI {
  /** @param {ScenarioStore} store Browser state. @param {import('./map-manager.js').MapManager} manager Map/presentation. @param {function(string):void} say Message writer. */
  constructor(store,manager,say) {
    this.store=store; this.manager=manager; this.say=say;
    this.id=null; this.name=''; this.revision=0; this.savedRevision=0; this.busy=false; this.applying=false;
    store.subscribe(reason=> {if(!this.applying && !['ui'].includes(reason)) {this.revision++; this.renderStatus();}});
    manager.map.on('moveend',()=>this.markDirty());
  }

  /** Record a saved-input or presentation change without causing an acoustic request. */
  markDirty() {if(!this.applying) {this.revision++; this.renderStatus();}}

  /** Bind Save/Open dialogs and optional copied saves. */
  bind() {
    $('save-scenario').onclick=()=> {if(this.id) this.save(); else {$('scenario-name').value=this.name; $('save-dialog-error').textContent=''; $('save-dialog').showModal();}};
    $('open-scenario').onclick=()=>this.openList();
    $('save-form').onsubmit=event=> {event.preventDefault(); this.save($('scenario-name').value.trim());};
    document.querySelectorAll('[data-close-dialog]').forEach(button=> {button.onclick=()=>$(button.dataset.closeDialog).close();});
    $('new-scenario').onclick=()=> {
      if(!this.confirmDiscard()) return;
      this.applying=true;
      const fresh=new ScenarioStore();
      this.store.restore({...fresh.toPayload(), types:fresh.types, levels:fresh.contours.map(c=>c.level_db)});
      this.manager.fitMine();
      $('contour-contrast').checked=false; this.manager.contourLayer.setHighContrast(false);
      $('show-overlay').checked=true; this.manager.contourLayer.setVisible(true);
      this.id=null; this.name=''; this.revision=0; this.savedRevision=0; this.applying=false;
      this.setUrl(null); this.renderStatus(); $('open-dialog').close();
    };
    $('scenario-list').onclick=event=> {
      const button=event.target.closest('[data-open-scenario]'); if(button && this.confirmDiscard()) this.load(button.dataset.openScenario);
      const copy=event.target.closest('[data-copy-scenario]');
      if(copy) {$('open-dialog').close(); $('scenario-name').value=this.name ? this.name+' copy' : ''; $('save-dialog').showModal();}
    };
    $('contour-contrast').addEventListener('change',()=>this.markDirty());
    $('show-overlay').addEventListener('change',()=>this.markDirty());
    this.renderStatus();
  }

  /** @return {boolean} Whether the user accepted discarding changes or there are none. */
  confirmDiscard() {return this.revision===this.savedRevision || confirm('Open another scenario and discard unsaved changes?');}

  /** @return {Object} Detached, versioned document with all notes and current map settings. */
  snapshot() {
    const centre=this.manager.map.getCenter();
    return structuredClone({version:1,types:this.store.types,sources:this.store.sources,receivers:this.store.receivers,
      levels:this.store.contours.map(c=>c.level_db),cloud_cover:this.store.cloud_cover,
      view:{lat:centre.lat,lng:((centre.lng+180)%360+360)%360-180,zoom:this.manager.map.getZoom()},
      high_contrast:$('contour-contrast').checked,show_contours:$('show-overlay').checked});
  }

  /** @param {string} [newName] Supplying a name creates a new copy; otherwise update selected save. */
  async save(newName) {
    if(this.busy) return;
    const creating=newName!==undefined;
    const name=creating ? newName : this.name;
    if(!name) {$('save-dialog-error').textContent='Enter a scenario name.'; return;}
    const revision=this.revision, payload={name,document:this.snapshot()};
    this.setBusy(true);
    try {
      const record=await request(creating ? '/api/scenarios' : `/api/scenarios/${this.id}`,creating ? 'POST' : 'PUT',payload);
      this.id=record.id; this.name=record.name; this.savedRevision=revision;
      this.setUrl(this.id); $('save-dialog').close(); this.renderStatus();
      this.say('Scenario saved locally. Save again after further edits.');
    } catch(error) {$('save-dialog-error').textContent=error.message; this.say(error.message);}
    finally {this.setBusy(false);}
  }

  /** Show named saves and explicit unreadable-file status. */
  async openList() {
    if(this.busy) return;
    $('open-dialog').showModal(); $('scenario-list-status').textContent='Loading saved scenarios…'; $('scenario-list').replaceChildren();
    try {
      const data=await request('/api/scenarios');
      $('scenario-list-status').textContent=data.unreadable_count ? `${data.unreadable_count} saved file(s) could not be read. Original files were preserved.` : data.scenarios.length ? 'Choose a scenario. Saved files stay on the computer running this backend.' : 'No saved scenarios yet.';
      $('scenario-list').innerHTML=data.scenarios.map(record=>`<button type="button" data-open-scenario="${record.id}" class="scenario-list-item"><strong>${escapeHtml(record.name)}</strong><small>${new Date(record.updated_at).toLocaleString('en-AU')}</small></button>`).join('')+
        (this.id ? '<button type="button" data-copy-scenario="true" class="text-button">Save current work as a new copy…</button>' : '');
    } catch(error) {$('scenario-list-status').textContent=error.message;}
  }

  /** @param {string} id Validated scenario identifier returned by the server. */
  async load(id) {
    if(this.busy) return;
    this.setBusy(true);
    try {
      const record=await request(`/api/scenarios/${encodeURIComponent(id)}`);
      this.applying=true;
      this.store.restore(record.document);
      const view=record.document.view;
      if(view) this.manager.map.setView([view.lat,view.lng],view.zoom,{animate:false}); else this.manager.fitMine();
      $('contour-contrast').checked=record.document.high_contrast; this.manager.contourLayer.setHighContrast(record.document.high_contrast);
      $('show-overlay').checked=record.document.show_contours; this.manager.contourLayer.setVisible(record.document.show_contours);
      this.id=record.id; this.name=record.name; this.revision=0; this.savedRevision=0;
      this.setUrl(id); $('open-dialog').close(); this.say('Opened the last saved scenario.');
    } catch(error) {this.say(error.message);}
    finally {this.applying=false; this.setBusy(false); this.renderStatus();}
  }

  /** Reopen only an explicitly saved URL, never silently restore unsaved edits. */
  restoreFromUrl() {const id=new URL(location.href).searchParams.get('scenario'); if(id) this.load(id);}

  /** @param {?string} id Saved scenario to retain in the reloadable local URL. */
  setUrl(id) {
    try {const url=new URL(location.href); if(id) url.searchParams.set('scenario',id); else url.searchParams.delete('scenario'); history.replaceState({},'',url);}
    catch {this.say('Saved locally. This browser cannot update the URL; use Open to restore the save.');}
  }

  /** Reflect saved versus edited state without claiming autosave. */
  renderStatus() {
    $('save-status').textContent=this.id ? `${this.name} · ${this.revision===this.savedRevision ? 'Saved' : 'Unsaved changes'}` : 'Unsaved scenario · Save to keep your work';
  }

  /** @param {boolean} busy Prevent conflicting save/open operations from double clicks. */
  setBusy(busy) {this.busy=busy; $('save-scenario').disabled=busy; $('open-scenario').disabled=busy; $('new-scenario').disabled=busy; $('save-form').querySelector('[type=submit]').disabled=busy;}
}
