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

/** Cache keyed only by source positions/powers and decibel levels, not camera or styles. */
export class GeometryCache {
  /** Initialise a bounded, session-local cache. */
  constructor() { this.entries = new Map(); }

  /** @param {Object} payload Contour request. @return {string} Canonical geometry signature. */
  key(payload) {
    return JSON.stringify({sources:payload.sources.map(s=>[s.lat,s.lng,payload.types.find(t=>t.id===s.type_id).lwa]),
      levels:[...payload.levels].sort((a,b)=>a-b)});
  }

  /** @param {string} key Signature. @return {?Object} Cached response. */
  get(key) { return this.entries.get(key); }

  /** @param {string} key Signature. @param {Object} value Successful response. */
  set(key, value) {
    this.entries.set(key,value);
    if (this.entries.size > 12) this.entries.delete(this.entries.keys().next().value);
  }
}
