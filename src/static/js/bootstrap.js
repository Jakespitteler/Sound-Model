/** @fileoverview Explicit, recoverable startup for external and embedded browsers. */
(() => {
  /** @param {*} error Startup failure; show the actual error instead of an endless spinner. */
  function failed(error) {
    const detail = error instanceof Error ? error.message : String(error);
    const text = `Map startup failed: ${detail}. Open this address in Edge, Chrome or Firefox and reload. If it persists, check the browser console.`;
    document.getElementById('tile-status').textContent = text;
    document.getElementById('tile-status').hidden = false;
    document.getElementById('message').textContent = text;
    document.getElementById('calculation-status').textContent = 'Application did not start';
  }

  /** @return {Promise<void>} Resolve after the locally bundled Leaflet library is ready. */
  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('Bundled map library timed out')), 10000);
      script.src = '/vendor/leaflet/leaflet.js';
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Bundled map library could not load')); };
      document.head.appendChild(script);
    });
  }

  loadLeaflet().then(() => import('./main.js')).catch(failed);
})();
