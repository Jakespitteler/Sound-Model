/** @fileoverview In-memory state with explicit geometry/receiver/style/UI notifications. */
import {boundaryLevel} from './background.js';
import {uuid} from './utils.js';
import {MACHINE_PRESETS} from './machine-presets.js';
import {SOUND_REFERENCE} from './sound-reference.js';

// Fresh-scenario camera: mine-wide view from the owner's reference image.
export const DEFAULT_VIEW = {lat:-33.8675,lng:116.07647,zoom:14};

/** @param {import('./types.js').Receiver} receiver Listening location.
 * @param {number} index Zero-based list position. @return {string} Name or numbered fallback. */
export function receiverLabel(receiver, index) { return receiver.name || `Receiver ${index+1}`; }

/** Observable scenario. Camera movement is deliberately not part of this state. */
export class ScenarioStore {
  /** Initialise provisional equipment and five descending decibel thresholds. */
  constructor() {
    /** @type {import('./types.js').MachineType[]} */
    this.types = structuredClone(MACHINE_PRESETS);
    /** @type {import('./types.js').Source[]} */
    this.sources = [];
    /** @type {import('./types.js').Receiver[]} */
    this.receivers = [];
    /** @type {import('./types.js').Measurement[]} */
    this.measurements = [];
    /** @type {import('./types.js').ContourLevel[]} */
    this.contours = SOUND_REFERENCE.map(item=>item.level).sort((a,b)=>b-a).map(level_db => ({id:uuid(), level_db}));
    /** @type {Object[]} Completed placement commands, oldest first. */
    this.undoStack=[];
    /** @type {Object[]} Commands available to replay. */
    this.redoStack=[];
    this.acceptable_level_db = null;
    this.background_spectrum = null;
    this.background_db = null;
    this.cloud_cover = 0;
    /** @type {?string} */
    this.mode = null;
    /** @type {Set<function(string):void>} */
    this.listeners = new Set();
  }

  /** @param {function(string):void} listener State-change handler. */
  subscribe(listener) { this.listeners.add(listener); }

  /** @param {string} reason Geometry, receivers, thresholds, catalogue, or UI change. */
  notify(reason) {
    for (const listener of this.listeners) listener(reason);
  }

  /** @return {import('./types.js').Scenario} Detached request snapshot. */
  toPayload() {
    // Equipment notes stay with the browser catalogue; they are not acoustic inputs.
    const types = this.types.map(({id,name,lwa,provenance,spectrum}) => ({id,name,lwa,provenance,...(spectrum ? {spectrum} : {})}));
    return structuredClone({types,sources:this.sources,receivers:this.receivers,cloud_cover:this.cloud_cover,background_spectrum:this.background_spectrum,background_db:this.background_db});
  }

  /** @param {Object} document Validated versioned scenario, supplied by the local backend. */
  restore(document) {
    const acceptable=document.acceptable_level_db ?? null;
    if (acceptable!==null && (typeof acceptable!=='number' || !Number.isFinite(acceptable)) ||
      !this.fitsContourBudget(document.levels,acceptable)) throw new Error('Invalid acceptable level or too many unique contours.');
    const background=document.background_db ?? null;
    if (background!==null && (typeof background!=='number' || !Number.isFinite(background))) throw new Error('Invalid background level.');
    this.background_spectrum=structuredClone(document.background_spectrum ?? null);
    this.background_db=background;
    this.clearHistory(); this.acceptable_level_db=acceptable;
    this.types = structuredClone(document.types);
    this.sources = structuredClone(document.sources);
    this.receivers = structuredClone(document.receivers);
    this.measurements = structuredClone(document.measurements ?? []);
    this.contours = document.levels.map(level_db=>({id:uuid(),level_db})).sort((a,b)=>b.level_db-a.level_db);
    this.cloud_cover = document.cloud_cover;
    this.mode = null;
    this.notify('restore');
  }

  /** @param {import('./types.js').Source} source Placed source. @return {import('./types.js').MachineType} Type. */
  typeFor(source) { return this.types.find(t => t.id === source.type_id); }

  /** @param {?string} mode Source/receiver placement, or null to cancel. */
  setMode(mode) { this.mode = mode; this.notify('ui'); }

  /** @param {?Object} spectrum Accepted optional unweighted evidence. */
  setBackgroundSpectrum(spectrum) {this.background_spectrum=structuredClone(spectrum);this.notify('spectra');}

  /** @param {?number} value Uniform pressure level; null clears it. @return {boolean} Accepted. */
  setBackground(value) {
    if (value!==null && (typeof value!=='number' || !Number.isFinite(value))) return false;
    if (this.background_db!==value) {this.background_db=value; this.notify('background');}
    return true;
  }

  /** @param {number} value Recorded percentage, without any acoustic correction. */
  setCloudCover(value) { this.cloud_cover = value; this.notify('metadata'); }

  /** @param {string} name Type name. @param {number} lwa Sound power. @param {string} provenance Data class.
   * @param {string} [note] User-recorded source or assumption note. */
  addMachineType(name, lwa, provenance, note = '') {
    this.types.push({id:uuid(), name, lwa, provenance, note}); this.notify('catalogue');
  }

  /** @param {string} id Type ID. @param {Object} patch Validated form fields. */
  updateMachineType(id, patch) {
    const type=this.types.find(t=>t.id===id);
    const acoustic=['name','lwa','provenance'].some(field=>field in patch && patch[field]!==type[field]);
    const signature=spectrum=>JSON.stringify([!!spectrum,spectrum?.levels ?? null,spectrum?.period_s ?? null]);
    const spectral='spectrum' in patch && signature(patch.spectrum)!==signature(type.spectrum);
    Object.assign(type,patch); this.notify(acoustic ? 'geometry' : spectral ? 'spectra' : 'equipment-metadata');
  }

  /** @param {string} id Unused type ID. Deleting a type invalidates both history stacks. */
  removeMachineType(id) {
    if (!this.types.some(t=>t.id===id) || this.sources.some(source=>source.type_id===id)) return;
    this.clearHistory(); this.types=this.types.filter(t=>t.id!==id); this.notify('catalogue');
  }

  /** Drop transient history at scenario/reference boundaries; never save it. */
  clearHistory() {this.undoStack=[]; this.redoStack=[];}

  /** Record one completed placement action and notify only its calculation lane.
   * @param {string} collection Sources or receivers. @param {?Object} before Previous record.
   * @param {?Object} after Resulting record. @param {number} index Original list position.
   * @param {string} label Human-readable action. */
  recordPlacement(collection,before,after,index,label) {
    this.undoStack.push(structuredClone({collection,before,after,index,label}));
    if (this.undoStack.length>50) this.undoStack.shift();
    this.redoStack=[]; this.mode=null;
    this.notify(collection==='sources' ? 'geometry' : 'receivers');
  }

  /** Replay a command without creating another command or changing unrelated metadata.
   * @param {boolean} redo Redo rather than undo. @return {?string} Applied action label. */
  replayPlacement(redo) {
    const from=redo ? this.redoStack : this.undoStack, to=redo ? this.undoStack : this.redoStack;
    const command=from.at(-1); if (!command) return null;
    const target=redo ? command.after : command.before;
    if (command.collection==='sources' && target && !this.types.some(t=>t.id===target.type_id)) {
      this.clearHistory(); this.notify('ui'); return null;
    }
    const items=this[command.collection], id=(command.before || command.after).id;
    const index=items.findIndex(item=>item.id===id);
    if (target===null) {
      // Preserve names edited after an add when that add is undone/redone.
      command[redo ? 'before' : 'after']=structuredClone(items[index]);
      items.splice(index,1);
    } else if (index<0) items.splice(command.index,0,structuredClone(target));
    else Object.assign(items[index],{lat:target.lat,lng:target.lng});
    from.pop(); to.push(command); this.mode=null;
    this.notify(command.collection==='sources' ? 'geometry' : 'receivers');
    return command.label;
  }

  /** @return {?string} Undone placement label, or null for empty history. */
  undo() {return this.replayPlacement(false);}

  /** @return {?string} Redone placement label, or null for empty history. */
  redo() {return this.replayPlacement(true);}

  /** @param {string} collection Sources or receivers. @param {string} id Object ID.
   * @param {?Object} patch Coordinates, or null for removal. */
  editPlacement(collection,id,patch) {
    const items=this[collection], index=items.findIndex(item=>item.id===id);
    if (index<0) return;
    const before=structuredClone(items[index]);
    if (patch) {
      const lat=patch.lat ?? before.lat, lng=patch.lng ?? before.lng;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>85 || Math.abs(lng)>180 ||
        lat===before.lat && lng===before.lng) return;
      Object.assign(items[index],{lat,lng});
    } else items.splice(index,1);
    this.recordPlacement(collection,before,patch ? items[index] : null,index,
      `${patch ? 'Move' : 'Remove'} ${collection==='sources' ? 'machine' : 'receiver'}`);
  }

  /** @param {string} type_id Selected type. @param {number} lat Latitude. @param {number} lng Longitude. */
  addSource(type_id, lat, lng) {
    if (!this.types.some(t=>t.id===type_id) || this.sources.length>=100) return;
    const source={id:uuid(),type_id,lat,lng}; this.sources.push(source);
    this.recordPlacement('sources',null,source,this.sources.length-1,'Place machine');
  }

  /** @param {string} id Source ID. @param {Object} patch Coordinates to apply. */
  updateSource(id,patch) {this.editPlacement('sources',id,patch);}

  /** @param {string} id Source to remove. */
  removeSource(id) {this.editPlacement('sources',id,null);}

  /** @param {number} lat Latitude. @param {number} lng Longitude. */
  addReceiver(lat,lng) {
    if (this.receivers.length>=20) return;
    const receiver={id:uuid(),lat,lng,name:''}; this.receivers.push(receiver);
    this.recordPlacement('receivers',null,receiver,this.receivers.length-1,'Place receiver');
  }

  /** @param {string} id Receiver ID. @param {Object} patch Coordinates to apply. */
  updateReceiver(id,patch) {this.editPlacement('receivers',id,patch);}

  /** Rename metadata without scheduling sound requests. Reject invalid input without losing the old name.
   * @param {string} id Receiver ID. @param {string} name Optional display label.
   * @return {boolean} Whether the edit is valid. */
  renameReceiver(id, name) {
    const receiver = this.receivers.find(r=>r.id===id);
    if (!receiver || typeof name!=='string' || [...name.trim()].length>80) return false;
    const trimmed=name.trim();
    if ((receiver.name || '')!==trimmed) {receiver.name=trimmed; this.notify('receiver-name');}
    return true;
  }

  /** @param {string} id Receiver to remove. */
  removeReceiver(id) {this.editPlacement('receivers',id,null);}

  /** @param {Object} record Field observation with known position/pressure. @return {?string} Stable ID. */
  addMeasurement(record) {
    if(this.measurements.length>=100 || !Number.isFinite(record.level_db)) return null;
    const item={isolation:'unknown',name:'',metric:'unknown',test_kind:'unknown',duration_s:null,source_id:null,source_context:null,activity:'',meter:'',note:'',...structuredClone(record),id:uuid()};
    this.measurements.push(item);this.notify('measurements');return item.id;
  }

  /** @param {string} id Observation ID. @param {Object} patch Accepted observation fields. */
  updateMeasurement(id,patch) {
    const item=this.measurements.find(m=>m.id===id);if(!item) return;
    Object.assign(item,structuredClone(patch),{id});this.notify('measurements');
  }

  /** @param {string} id Observation to remove, independently of simulated objects/history. */
  removeMeasurement(id) {this.measurements=this.measurements.filter(m=>m.id!==id);this.notify('measurements');}

  /** Apply a reviewed estimate atomically, retaining originals in its evidence snapshot.
   * @param {Object} request Fitting inputs. @param {Object} result Successful preview.
   * @param {string} name Area name. @param {boolean} replaceSources Explicit area replacement.
   * @return {boolean} Whether the reviewed change was accepted. */
  applyMeasurementFit(request,result,name,replaceSources=false) {
    if(!result.ready || !Number.isFinite(result.lwa) || result.lwa<0 || result.lwa>300 || this.types.length>=50) return false;
    const source=this.sources.find(s=>s.id===request.source_id),area=request.mode==='area';
    if(!area && !source || area && (this.sources.length && !replaceSources || !name.trim())) return false;
    const original=area ? {} : this.typeFor(source),id=uuid();
    const type={...structuredClone(original),id,name:area ? name.trim() : original.name,lwa:result.lwa,
      provenance:'example',spectrum:null,kind:area ? 'area' : original.kind || 'generic',
      operating_mode:request.activity,source_reference:'Measurement-derived geometric estimate',
      note:`Measurement-derived estimate for ${request.activity}. ${request.fit_ids.length} fit readings; ${request.check_ids.length} independent check readings. Background ${request.background_db} dB(A). Full-space point-source fit; not validated sound power.`,
      fitting:{request:structuredClone(request),result:structuredClone(result),model:'full-space-log-fit-v1'}};
    this.types.push(type);
    if(area) this.sources=[{id:uuid(),type_id:id,...result.centre}];
    else source.type_id=id;
    this.clearHistory();this.setMode(null);this.notify('catalogue');return true;
  }

  /** @param {number[]} levels Ordinary levels. @param {?number} [acceptable] Reference level.
   * @return {boolean} Whether all unique levels fit the API budget. */
  fitsContourBudget(levels,acceptable=this.acceptable_level_db) {
    return new Set([...levels,...(acceptable===null ? [] : [acceptable])]).size<=25;
  }

  /** @param {?number} value User-set reference or null to clear. @return {boolean} Accepted. */
  setAcceptableLevel(value) {
    if (value!==null && (typeof value!=='number' || !Number.isFinite(value)) ||
      !this.fitsContourBudget(this.contours.map(c=>c.level_db),value)) return false;
    if (this.acceptable_level_db!==value) {this.acceptable_level_db=value; this.notify('acceptable-level');}
    return true;
  }

  /** @return {number[]} Distinct descending thresholds, including the optional reference. */
  getContourLevels() {
    return [...new Set([...this.contours.map(c=>c.level_db),...(this.acceptable_level_db===null ? [] : [this.acceptable_level_db]),...(this.background_db===null ? [] : [boundaryLevel(this.background_db)])])].sort((a,b)=>b-a);
  }

  /** @return {import('./types.js').ContourLevel[]} One setting per geometry, flagged for the reference. */
  lineSettings() {
    return this.getContourLevels().map(level_db=>({id:this.contours.find(c=>c.level_db===level_db)?.id || 'acceptable-level',
      level_db,background:level_db===boundaryLevel(this.background_db),acceptable:level_db===this.acceptable_level_db}));
  }

  /** Add a distinct threshold without substituting another value for explicit input.
   * @param {number} [requestedLevel] Explicit dB(A), or omitted for programmatic fallback.
   * @return {boolean} Whether the contour was added. */
  addContour(requestedLevel) {
    if (this.contours.length >= 25) return false;
    if (requestedLevel!==undefined && (typeof requestedLevel!=='number' || !Number.isFinite(requestedLevel) ||
      this.contours.some(c=>c.level_db===requestedLevel))) return false;
    let level=requestedLevel ?? Math.max(0, Math.min(300, Math.min(...this.contours.map(c=>c.level_db), 50) - 5));
    if (requestedLevel===undefined) while (this.contours.some(c=>c.level_db===level)) level++;
    if (!this.fitsContourBudget([...this.contours.map(c=>c.level_db),level])) {
      if (requestedLevel!==undefined || this.acceptable_level_db===null || this.contours.some(c=>c.level_db===this.acceptable_level_db)) return false;
      level=this.acceptable_level_db;
    }
    this.contours.push({id:uuid(),level_db:level});
    this.contours.sort((a,b)=>b.level_db-a.level_db);
    this.notify('thresholds'); return true;
  }

  /** @param {string} id Contour ID. @param {Object} patch Decibel threshold patch. @return {boolean} Accepted. */
  updateContour(id, patch) {
    const contour = this.contours.find(c => c.id === id);
    if (!contour || !('level_db' in patch)) return false;
    if ('level_db' in patch && (!Number.isFinite(patch.level_db) ||
      this.contours.some(c=>c.id!==id && c.level_db===patch.level_db))) return false;
    if (!this.fitsContourBudget(this.contours.map(c=>c.id===id ? patch.level_db : c.level_db))) return false;
    contour.level_db = patch.level_db;
    this.contours.sort((a,b)=>b.level_db-a.level_db);
    this.notify('thresholds'); return true;
  }

  /** @param {string} id Contour to remove; all levels may be removed. */
  removeContour(id) { this.contours = this.contours.filter(c => c.id !== id); this.notify('thresholds'); }

  /** Load fictional demonstration data only on explicit user request. */
  loadDemo() {
    if (this.sources.length || this.receivers.length) return;
    this.clearHistory();
    const candidates = MACHINE_PRESETS.filter(p => !this.types.some(t=>t.id===p.id));
    for (const preset of candidates) {
      if (this.types.length < 50) this.types.push(structuredClone(preset));
    }
    const truck = (this.types.find(t=>t.id==='preset-haul') || this.types[0]).id;
    const plant = (this.types.find(t=>t.id==='preset-loader') || this.types[0]).id;
    this.sources.push({id:uuid(),type_id:truck,lat:-33.866,lng:116.056},
      {id:uuid(),type_id:plant,lat:-33.862,lng:116.061});
    this.receivers.push({id:uuid(),lat:-33.849,lng:116.058}); this.notify('geometry');
  }
}
