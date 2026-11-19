/** @fileoverview Independent request lanes and source/threshold geometry cache. */

/** Debounced request lane; every edit invalidates old work, including cache hits. */
export class RequestLane {
  /** Initialise cancellation/version state. */
  constructor() { this.timer = null; this.controller = null; this.version = 0; }

  /** Cancel pending/in-flight work and invalidate responses. */
  cancel() { clearTimeout(this.timer); this.controller?.abort(); this.version++; }

  /**
   * Snapshot and schedule an API request or a cached result.
   * @param {string} url Endpoint.
   * @param {Object} payload Detached scenario payload.
   * @param {Object} callbacks Start/success/error callbacks.
   * @param {?Object} cached Previously validated data, if any.
   */
  schedule(url, payload, callbacks, cached = null) {
    this.cancel(); const version = this.version;
    if (cached) { callbacks.success(cached); return; }
    callbacks.start?.();
    this.timer = setTimeout(async () => {
      this.controller = new AbortController();
      try {
        const data = await post(url, payload, this.controller.signal);
        if (version === this.version) callbacks.success(data);
      } catch (error) {
        if (version === this.version && error.name !== 'AbortError') callbacks.error(error);
      }
    }, 150);
  }
}

/**
 * Post JSON with readable server validation messages.
 * @param {string} url Endpoint.
 * @param {Object} payload Serializable request.
 * @param {AbortSignal} [signal] Optional cancellation.
 * @return {Promise<Object>} Parsed success response.
 */
export async function post(url, payload, signal) {
  const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Model request failed (${response.status}). Check inputs.`);
  return data;
}

/** Per-level geometry under the current API model/accuracy contract; no camera or style keys. */
export class GeometryCache {
  /** Initialise a session-local LRU of at most 32 successful/empty levels.
   * @param {string} [model] Acoustic model contract; change it when the model changes.
   * @param {number} [toleranceDb] Numerical accuracy contract, not environmental uncertainty. */
  constructor(model='full-space-point-source-v1', toleranceDb=.02) {
    this.entries=new Map(); this.model=model; this.toleranceDb=toleranceDb;
  }

  /** @param {Object} payload Contour request. @param {number} level Threshold.
   * @return {string} Complete geometry signature, retaining source order and multiplicity. */
  key(payload, level) {
    return JSON.stringify({model:this.model,tolerance_db:this.toleranceDb,
      background_db:payload.background_db ?? null,sources:payload.sources.map(s=>[s.lat,s.lng,payload.types.find(t=>t.id===s.type_id).lwa]),level_db:level});
  }

  /** @param {string} key Signature. @return {?Object} Detached cached level; promote on use. */
  get(key) {
    const value=this.entries.get(key);
    if (!value) return null;
    this.entries.delete(key); this.entries.set(key,value);
    return structuredClone(value);
  }

  /** @param {string} key Signature. @param {Object} value One successful or empty contour. */
  set(key, value) {
    if (!['ok','empty','negligible'].includes(value.status)) return;
    this.entries.delete(key); this.entries.set(key,structuredClone(value));
    if (this.entries.size>32) this.entries.delete(this.entries.keys().next().value);
  }
}
