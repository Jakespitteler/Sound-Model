/** @fileoverview In-memory state with explicit geometry/receiver/style/UI notifications. */
import {uuid} from './utils.js';
import {MACHINE_PRESETS} from './machine-presets.js';

// Approximate overview of the mine/processing/tailings area, not a surveyed boundary.
export const MINE_BOUNDS = [[-33.94, 116.015], [-33.825, 116.14]];

/** Observable scenario. Camera movement is deliberately not part of this state. */
export class ScenarioStore {
  /** Initialise provisional equipment and four descending decibel thresholds. */
  constructor() {
    /** @type {import('./types.js').MachineType[]} */
    this.types = structuredClone(MACHINE_PRESETS);
    /** @type {import('./types.js').Source[]} */
    this.sources = [];
    /** @type {import('./types.js').Receiver[]} */
    this.receivers = [];
    /** @type {import('./types.js').ContourLevel[]} */
    this.contours = [65, 55, 45, 35].map(level_db => ({id:uuid(), level_db}));
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
    const types = this.types.map(({id,name,lwa,provenance}) => ({id,name,lwa,provenance}));
    return structuredClone({types,sources:this.sources,receivers:this.receivers,cloud_cover:this.cloud_cover});
  }

  /** @param {import('./types.js').Source} source Placed source. @return {import('./types.js').MachineType} Type. */
  typeFor(source) { return this.types.find(t => t.id === source.type_id); }

  /** @param {?string} mode Source/receiver placement, or null to cancel. */
  setMode(mode) { this.mode = mode; this.notify('ui'); }

  /** @param {number} value Recorded percentage, without any acoustic correction. */
  setCloudCover(value) { this.cloud_cover = value; }

  /** @param {string} name Type name. @param {number} lwa Sound power. @param {string} provenance Data class.
   * @param {string} [note] User-recorded source or assumption note. */
  addMachineType(name, lwa, provenance, note = '') {
    this.types.push({id:uuid(), name, lwa, provenance, note}); this.notify('catalogue');
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
    this.contours.push({id:uuid(),level_db:level});
    this.contours.sort((a,b)=>b.level_db-a.level_db);
    this.notify('thresholds');
  }

  /** @param {string} id Contour ID. @param {Object} patch Decibel threshold patch. @return {boolean} Accepted. */
  updateContour(id, patch) {
    const contour = this.contours.find(c => c.id === id);
    if (!contour || !('level_db' in patch)) return false;
    if ('level_db' in patch && (!Number.isFinite(patch.level_db) || patch.level_db < 0 || patch.level_db > 300 ||
      this.contours.some(c=>c.id!==id && c.level_db===patch.level_db))) return false;
    contour.level_db = patch.level_db;
    this.contours.sort((a,b)=>b.level_db-a.level_db);
    this.notify('thresholds'); return true;
  }

  /** @param {string} id Contour to remove; all levels may be removed. */
  removeContour(id) { this.contours = this.contours.filter(c => c.id !== id); this.notify('thresholds'); }

  /** Load fictional demonstration data only on explicit user request. */
  loadDemo() {
    if (this.sources.length || this.receivers.length) return;
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
