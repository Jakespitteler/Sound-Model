/* Plain browser JavaScript. Leaflet is the only third-party frontend library. */
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => crypto.randomUUID();
  const state = {types: [], sources: [], receivers: [], cloud_cover: 0};
  const home = [-33.858, 116.055];
  let mode = null, overlay = null, timer, generation = 0, controller;
  const markers = L.layerGroup();
  const map = L.map('map', {minZoom: 3, maxZoom: 19, maxBounds: [[-85,-180],[85,180]], maxBoundsViscosity: 1}).setView(home, 14);
  markers.addTo(map);
  // Keep provider-specific settings here; Google/Apple may need separate adapters.
  const provider = {url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19};
  const tiles = L.tileLayer(provider.url, {attribution: provider.attribution, maxZoom: provider.maxZoom});
  let tileErrors = 0;
  tiles.on('loading', () => { tileErrors = 0; });
  tiles.on('tileerror', () => { tileErrors++; $('tile-status').hidden = false; $('tile-status').textContent = 'Street map unavailable or incomplete. Check internet access. Coordinates and calculations still work.'; });
  tiles.on('load', () => { if (!tileErrors) $('tile-status').hidden = true; });
  tiles.addTo(map);
  L.control.scale({imperial:false, position:'bottomleft'}).addTo(map);
  const say = message => { $('message').textContent = message; };
  const typeFor = source => state.types.find(t => t.id === source.type_id);
  const number = value => value === null ? 'No source contribution' : `${value.toFixed(1)} <small>dB(A)</small>`;
  function setMode(value) {
    mode = value;
    $('mode-label').textContent = value === 'source' ? 'Click the map to place a machine' : value === 'receiver' ? 'Click the map to place a receiver' : 'Pan to explore · drag markers to move';
    $('cancel-mode').hidden = !value;
    $('map').classList.toggle('place-mode', !!value);
  }
  function renderTypes() {
    $('types').innerHTML = state.types.map(t => `<div class="type-card"><div class="row"><strong>${escape(t.name)}</strong><button class="danger" data-remove-type="${t.id}" aria-label="Remove ${escape(t.name)} type">Remove</button></div><p>${t.lwa.toFixed(1)} dB(A) LwA · ${t.provenance === 'example' ? 'EXAMPLE' : 'Measured data'}</p><details><summary>Edit type</summary><form data-edit-type="${t.id}"><label>Name<input name="name" value="${escape(t.name)}" maxlength="80" required></label><div class="two-columns"><label>LwA · dB(A)<input name="lwa" type="number" min="0" max="180" step="0.1" value="${t.lwa}" required></label><label>Data source<select name="provenance"><option value="example" ${t.provenance === 'example'?'selected':''}>Example</option><option value="measured" ${t.provenance === 'measured'?'selected':''}>Measured</option></select></label></div><button class="secondary">Save type</button></form></details></div>`).join('');
    const old = $('place-type').value;
    $('place-type').innerHTML = state.types.length ? state.types.map(t => `<option value="${t.id}">${escape(t.name)}</option>`).join('') : '<option value="">Add a machine type first</option>';
    if (state.types.some(t => t.id === old)) $('place-type').value = old;
    $('place-source').disabled = !state.types.length;
    $('demo').disabled = !!(state.types.length || state.sources.length || state.receivers.length);
  }
  function positionForm(item, collection) {
    return `<details><summary>Edit coordinates</summary><form data-position="${item.id}" data-collection="${collection}" class="position-edit"><div class="two-columns"><label>Latitude<input name="lat" type="number" min="-85" max="85" step="any" value="${item.lat}" required></label><label>Longitude<input name="lng" type="number" min="-180" max="180" step="any" value="${item.lng}" required></label></div><button class="secondary">Move location</button></form></details>`;
  }
  function renderSources() {
    $('source-count').textContent = state.sources.length;
    $('sources').innerHTML = state.sources.length ? state.sources.map((s,i) => `<div class="item-card"><div class="row"><strong>${i+1}. ${escape(typeFor(s).name)}</strong><button class="danger" data-remove-source="${s.id}" aria-label="Remove machine ${i+1}">Remove</button></div><p>${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</p>${positionForm(s,'sources')}</div>`).join('') : '<p class="empty">No machines placed yet. Choose a type, then click the map.</p>';
  }
  function renderReceivers(results) {
    $('receiver-count').textContent = state.receivers.length;
    $('receivers').innerHTML = state.receivers.length ? state.receivers.map((r,i) => {
      const result = results?.find(x => x.id === r.id);
      return `<div class="item-card"><div class="row"><strong>Receiver ${i+1}</strong><button class="danger" data-remove-receiver="${r.id}" aria-label="Remove receiver ${i+1}">Remove</button></div><div class="result">${result ? number(result.level_db) : 'Calculating…'}</div><p>${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</p>${result?.near_field ? '<p>Within 1 m of a source: near-field limit applies.</p>' : ''}${result?.contributions.length ? `<ul class="contributions">${result.contributions.map(c=>`<li>${escape(c.name)} · ${c.distance_m.toFixed(0)} m · ${c.level_db.toFixed(1)} dB(A)${c.provenance==='example'?' · example':''}</li>`).join('')}</ul>`:''}${positionForm(r,'receivers')}</div>`;
    }).join('') : '<p class="empty">Receiver readings appear here.</p>';
  }
  function renderMarkers() {
    markers.clearLayers();
    for (const collection of ['sources','receivers']) state[collection].forEach((item,i) => {
      const source = collection === 'sources';
      const label = source ? `${i+1}. ${typeFor(item).name}` : `Receiver ${i+1}`;
      const icon = L.divIcon({className:'', html:`<div class="${source?'machine':'receiver'}-marker">${source?i+1:'R'+(i+1)}</div>`, iconSize:[32,32], iconAnchor:[16,16]});
      const marker = L.marker([item.lat,item.lng], {icon, draggable:true, title:label, alt:label}).addTo(markers);
      const tooltip = document.createElement('span'); tooltip.textContent = label;
      marker.bindTooltip(tooltip);
      marker.on('dragend', () => { const p = marker.getLatLng(); item.lat = Math.max(-85,Math.min(85,p.lat)); item.lng = Math.max(-180,Math.min(180,p.lng)); renderSources(); renderMarkers(); requestPrediction(); });
    });
  }
  function clearOverlay() { if (overlay) { map.removeLayer(overlay); overlay = null; } }
  function color(level) {
    const colors = [[58,154,140],[169,189,117],[241,206,104],[235,146,84],[198,85,82]];
    const scaled = Math.max(0,Math.min(4,(level-20)/15));
    const lo = Math.min(3,Math.floor(scaled)), mix = scaled-lo;
    return colors[lo].map((v,i)=>Math.round(v+(colors[lo+1][i]-v)*mix));
  }
  function drawOverlay(grid) {
    clearOverlay(); if (!grid) return;
    const canvas = document.createElement('canvas'); canvas.width=grid.columns; canvas.height=grid.rows;
    const ctx = canvas.getContext('2d'), pixels = ctx.createImageData(grid.columns,grid.rows);
    grid.values.forEach((value,i) => { pixels.data.set([...color(value),150],i*4); });
    ctx.putImageData(pixels,0,0);
    const b = grid.bounds;
    overlay = L.imageOverlay(canvas.toDataURL(),[[b.south,b.west],[b.north,b.east]], {interactive:false});
    if ($('show-overlay').checked) overlay.addTo(map);
  }
  function requestPrediction() {
    clearTimeout(timer); controller?.abort(); const current = ++generation;
    clearOverlay(); renderReceivers();
    $('calculation-status').textContent = 'Updating model…';
    timer = setTimeout(async () => {
      controller = new AbortController();
      const b = map.getBounds();
      const bounds = {south:Math.max(-85,b.getSouth()), north:Math.min(85,b.getNorth()), west:Math.max(-180,b.getWest()), east:Math.min(180,b.getEast())};
      try {
        const response = await fetch('/api/predict', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...state,bounds}), signal:controller.signal});
        if (!response.ok) throw new Error(`Model request failed (${response.status}). Check inputs and retry.`);
        const result = await response.json(); if (current !== generation) return;
        drawOverlay(result.grid); renderReceivers(result.receivers);
        $('calculation-status').textContent = state.sources.length ? `${state.sources.length} source${state.sources.length===1?'':'s'} · ${result.example_data?'example data':'user-supplied data'} · indicative results` : 'Add a source to begin';
      } catch (error) {
        if (error.name === 'AbortError' || current !== generation) return;
        $('calculation-status').textContent = 'Calculation unavailable. Check that the Python server is running.';
        document.querySelectorAll('#receivers .result').forEach(el => { el.textContent='Unavailable'; });
        say(error.message);
      }
    },180);
  }
  function refresh() { renderTypes(); renderSources(); renderMarkers(); requestPrediction(); }
  $('type-form').addEventListener('submit', event => {
    event.preventDefault();
    if (state.types.length >= 50) return say('This prototype supports up to 50 machine types.');
    const name = $('type-name').value.trim(); if (!name) return say('Enter a machine name.');
    state.types.push({id:id(),name,lwa:Number($('type-level').value),provenance:$('type-provenance').value});
    $('type-name').value=''; say('Machine type added. Choose “Place a machine on map” next.'); refresh();
  });
  $('types').addEventListener('submit', event => {
    const form = event.target.closest('[data-edit-type]'); if (!form) return;
    event.preventDefault(); const data = new FormData(form), name=String(data.get('name')).trim();
    if (!name) return say('Enter a machine name.');
    Object.assign(state.types.find(t=>t.id===form.dataset.editType),{name,lwa:Number(data.get('lwa')),provenance:data.get('provenance')});
    say('Type updated for all its machines.'); refresh();
  });
  document.querySelector('.sidebar').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    for (const [attribute,collection] of [['removeType','types'],['removeSource','sources'],['removeReceiver','receivers']]) {
      const target = button.dataset[attribute]; if (!target) continue;
      if (collection==='types' && state.sources.some(s=>s.type_id===target)) return say('Remove this type’s machines from the map before deleting the type.');
      state[collection] = state[collection].filter(item=>item.id!==target); say('Removed.'); setMode(null); refresh();
    }
  });
  document.querySelector('.sidebar').addEventListener('submit', event => {
    const form = event.target.closest('[data-position]'); if (!form) return;
    event.preventDefault(); const data = new FormData(form);
    Object.assign(state[form.dataset.collection].find(item=>item.id===form.dataset.position),{lat:Number(data.get('lat')),lng:Number(data.get('lng'))});
    renderSources(); renderMarkers(); requestPrediction(); say('Position updated.');
  });
  $('place-source').onclick = () => { if (state.sources.length>=100) return say('Maximum 100 sources reached.'); setMode('source'); };
  $('place-receiver').onclick = () => { if (state.receivers.length>=20) return say('Maximum 20 receivers reached.'); setMode('receiver'); };
  $('cancel-mode').onclick = () => setMode(null);
  document.addEventListener('keydown', event => { if (event.key==='Escape') setMode(null); });
  map.on('click', event => {
    if (!mode) return;
    const position = {id:id(),lat:Math.max(-85,Math.min(85,event.latlng.lat)),lng:Math.max(-180,Math.min(180,event.latlng.lng))};
    if (mode==='source') state.sources.push({...position,type_id:$('place-type').value}); else state.receivers.push(position);
    setMode(null); refresh();
  });
  map.on('moveend', requestPrediction);
  $('cloud').oninput = () => { state.cloud_cover=Number($('cloud').value); $('cloud-value').textContent=`${state.cloud_cover}%`; requestPrediction(); };
  $('home').onclick = () => { map.setView(home,14); $('site-lat').value=home[0]; $('site-lng').value=home[1]; };
  $('location-form').onsubmit = event => { event.preventDefault(); setMode(null); map.setView([Number($('site-lat').value),Number($('site-lng').value)],14); };
  $('show-overlay').onchange = () => { if (overlay) { if ($('show-overlay').checked) overlay.addTo(map); else map.removeLayer(overlay); } };
  $('demo').onclick = () => {
    if (state.types.length || state.sources.length || state.receivers.length) return;
    const truck=id(), plant=id();
    state.types.push({id:truck,name:'Example haul truck',lwa:110,provenance:'example'},{id:plant,name:'Example fixed plant',lwa:105,provenance:'example'});
    state.sources.push({id:id(),type_id:truck,lat:-33.866,lng:116.056},{id:id(),type_id:plant,lat:-33.862,lng:116.061});
    state.receivers.push({id:id(),lat:-33.849,lng:116.058});
    map.setView(home,14); say('Fictional equipment, values and placements for demonstration only.'); refresh();
  };
  refresh();
})();
