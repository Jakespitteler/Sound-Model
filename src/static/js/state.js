/** @fileoverview In-memory state with explicit geometry/receiver/style/UI notifications. */
import {uuid} from './utils.js';

export const HOME_COORDS = [-33.858, 116.055];

/** Observable scenario. Camera movement is deliberately not part of this state. */
export class ScenarioStore {
  /** Initialise empty equipment and four editable contour levels. */
  constructor() {
    /** @type {import('./types.js').MachineType[]} */
    this.types = [];
    /** @type {import('./types.js').Source[]} */
    this.sources = [];
    /** @type {import('./types.js').Receiver[]} */
    this.receivers = [];
    /** @type {import('./types.js').ContourStyle[]} */
    this.contours = [
      {id:uuid(),level_db:65,color:'#e45656',weight:2,style:'solid',visible:true},
      {id:uuid(),level_db:55,color:'#eda142',weight:2,style:'solid',visible:true},
      {id:uuid(),level_db:45,color:'#a1cf53',weight:2,style:'solid',visible:true},
      {id:uuid(),level_db:35,color:'#41c6db',weight:2,style:'solid',visible:true},
    ];
    this.cloud_cover = 0;
    /** @type {?string} */
    this.mode = null;
    this.revision = 0;
    /** @type {Set<function(string):void>} */
    this.listeners = new Set();
  }

  /** @param {function(string):void} listener State-change handler. */
  subscribe(listener) { this.listeners.add(listener); }

  /** @param {string} reason Geometry, receivers, styles, catalogue, or ui change. */
  notify(reason) {
    if (reason === 'geometry' || reason === 'catalogue') this.revision++;
    for (const listener of this.listeners) listener(reason);
  }

  /** @return {import('./types.js').Scenario} Detached request snapshot. */
  toPayload() {
    return structuredClone({types:this.types,sources:this.sources,receivers:this.receivers,cloud_cover:this.cloud_cover});
  }

  /** @param {import('./types.js').Source} source Placed source. @return {import('./types.js').MachineType} Type. */
  typeFor(source) { return this.types.find(t => t.id === source.type_id); }

  /** @param {?string} mode Source/receiver placement, or null to cancel. */
  setMode(mode) { this.mode = mode; this.notify('ui'); }

  /** @param {number} value Recorded percentage, without any acoustic correction. */
  setCloudCover(value) { this.cloud_cover = value; }

  /** @param {string} name Type name. @param {number} lwa Sound power. @param {string} provenance Data class. */
  addMachineType(name, lwa, provenance) {
    this.types.push({id:uuid(), name, lwa, provenance}); this.notify('catalogue');
  }

  /** @param {string} id Type ID. @param {Object} patch Validated form fields. */
  updateMachineType(id, patch) {
    Object.assign(this.types.find(t => t.id === id), patch); this.notify('geometry');
  }

  /** @param {string} id Unused type ID, guarded by the UI. */
  removeMachineType(id) { this.types = this.types.filter(t => t.id !== id); this.notify('catalogue'); }

  /** @param {string} type_id Selected type. @param {number} lat Latitude. @param {number} lng Longitude. */
  addSource(type_id, lat, lng) {
    if (!this.types.some(t => t.id === type_id) || this.sources.length >= 100) return;
    this.sources.push({id:uuid(), type_id, lat, lng}); this.mode = null; this.notify('geometry');
  }

  /** @param {string} id Source ID. @param {Object} patch Coordinates to apply. */
  updateSource(id, patch) { Object.assign(this.sources.find(s => s.id === id), patch); this.notify('geometry'); }

  /** @param {string} id Source to remove. */
  removeSource(id) { this.sources = this.sources.filter(s => s.id !== id); this.notify('geometry'); }

  /** @param {number} lat Latitude. @param {number} lng Longitude. */
  addReceiver(lat, lng) {
    if (this.receivers.length >= 20) return;
    this.receivers.push({id:uuid(),lat,lng}); this.mode = null; this.notify('receivers');
  }

  /** @param {string} id Receiver ID. @param {Object} patch Coordinates to apply. */
  updateReceiver(id, patch) { Object.assign(this.receivers.find(r => r.id === id), patch); this.notify('receivers'); }

  /** @param {string} id Receiver to remove. */
  removeReceiver(id) { this.receivers = this.receivers.filter(r => r.id !== id); this.notify('receivers'); }

  /** Add a distinct contour threshold up to the API limit. */
  addContour() {
    if (this.contours.length >= 25) return;
    let level = Math.max(0, Math.min(300, Math.min(...this.contours.map(c=>c.level_db), 50) - 5));
    while (this.contours.some(c=>c.level_db===level)) level++;
    if (level > 300) return;
    this.contours.push({id:uuid(),level_db:level,color:'#af85ed',weight:2,style:'solid',visible:true});
    this.notify('thresholds');
  }

  /** @param {string} id Contour ID. @param {Object} patch Threshold or styling fields. @return {boolean} Accepted. */
  updateContour(id, patch) {
    const contour = this.contours.find(c => c.id === id);
    if (!contour) return false;
    if ('level_db' in patch && (!Number.isFinite(patch.level_db) || patch.level_db < 0 || patch.level_db > 300 ||
      this.contours.some(c=>c.id!==id && c.level_db===patch.level_db))) return false;
    Object.assign(contour, patch);
    this.notify('level_db' in patch ? 'thresholds' : 'styles'); return true;
  }

  /** @param {string} id Contour to remove; all levels may be removed. */
  removeContour(id) { this.contours = this.contours.filter(c => c.id !== id); this.notify('thresholds'); }

  /** Load fictional demonstration data only on explicit user request. */
  loadDemo() {
    if (this.types.length || this.sources.length || this.receivers.length) return;
    const truck=uuid(), plant=uuid();
    this.types.push({id:truck,name:'Example haul truck',lwa:110,provenance:'example'},
      {id:plant,name:'Example fixed plant',lwa:105,provenance:'example'});
    this.sources.push({id:uuid(),type_id:truck,lat:-33.866,lng:116.056},
      {id:uuid(),type_id:plant,lat:-33.862,lng:116.061});
    this.receivers.push({id:uuid(),lat:-33.849,lng:116.058}); this.notify('geometry');
  }
}
