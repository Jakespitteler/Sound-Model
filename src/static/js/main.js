/** @fileoverview Bind state, UI and two independent request lanes. No camera fetches. */
import {$} from './utils.js';
import {HOME_COORDS, ScenarioStore} from './state.js';
import {GeometryCache, post, RequestLane} from './api.js';
import {MapManager} from './map-manager.js';
import {CatalogueUI} from './ui-catalogue.js';
import {EntitiesUI} from './ui-entities.js';
import {ContoursUI} from './ui-contours.js';

const store = new ScenarioStore();
const manager = new MapManager(store);
const cache = new GeometryCache();
const geometryLane = new RequestLane(), receiverLane = new RequestLane();
/** @type {import('./types.js').ContourGeometry[]} Last valid current geometry. */
let geometry = [];
let receiverResults = {};
let dragVersion = 0;
/** @param {string} message Human-readable feedback. */
const say = message => { $('message').textContent = message; };
const catalogue = new CatalogueUI(store,say), entities = new EntitiesUI(store,say), contours = new ContoursUI(store,say);
catalogue.bind(); entities.bind(); contours.bind();

/** @param {Error} error Failure displayed with an explicit retry. */
function failed(error) {
  say(error.message); $('retry').hidden = false;
}

/** Update receivers only; this lane never rebuilds or removes contours. */
function refreshReceivers() {
  if (!store.receivers.length) {
    receiverLane.cancel(); receiverResults = {}; entities.renderReceivers({}); return;
  }
  receiverLane.schedule('/api/predict',store.toPayload(),{
    start:()=>entities.renderReceivers(),
    success:data=> {receiverResults=data.receivers; entities.renderReceivers(receiverResults);},
    error:error=> {
      entities.renderReceivers();
      document.querySelectorAll('#receivers .result').forEach(e=> {e.textContent='Unavailable';});
      failed(error);
    },
  });
}

/** Refresh geographic lines after source or threshold changes, reusing cached geometry. */
function refreshGeometry() {
  const payload = store.toPayload();
  payload.receivers = [];
  payload.levels = store.contours.map(c=>c.level_db);
  const key = cache.key(payload);
  geometryLane.schedule('/api/contours',payload,{
    start:()=> { manager.contourLayer.setPending(true); $('calculation-status').textContent='Updating contours…'; },
    success:data=> {
      cache.set(key,data); geometry=data.contours;
      manager.contourLayer.render(geometry,store.contours); manager.contourLayer.setPending(false);
      const empty = geometry.filter(c=>!c.lines.length).map(c=>`${c.level_db} dB(A)`);
      const examples = store.sources.some(s=>store.typeFor(s).provenance==='example');
      $('calculation-status').textContent = store.sources.length ?
        `${store.sources.length} sources · combined noise${examples?' · example data':''}${empty.length?' · No line at '+empty.join(', '):''}` : 'Add a source to begin';
    },
    error:error=> {
      geometry=[]; manager.contourLayer.render([],store.contours); manager.contourLayer.setPending(false);
      $('calculation-status').textContent='Contours unavailable'; failed(error);
    },
  },(!payload.sources.length || !payload.levels.length) ? {contours:payload.levels.map(level_db=>({level_db,lines:[]}))} : cache.get(key));
}

store.subscribe(reason=> {
  manager.syncModeUI();
  if (['geometry','catalogue'].includes(reason)) { catalogue.render(); entities.renderSources(); }
  if (['geometry','catalogue','receivers'].includes(reason)) { manager.renderMarkers(); refreshReceivers(); }
  if (['geometry','catalogue','thresholds'].includes(reason)) {
    dragVersion++; $('retry').hidden=true; refreshGeometry();
  }
  if (reason==='styles') { manager.contourLayer.render(geometry,store.contours); contours.renderLegend(); }
});

/**
 * Sample combined noise at a dropped point and use it as the new threshold.
 * @param {string} contourId Edited contour ID.
 * @param {L.LatLng} point Drop coordinate, not an arbitrary geometry control point.
 */
manager.contourLayer.onThresholdDrop = async (contourId, point) => {
  manager.contourLayer.render(geometry,store.contours);
  if (!Number.isFinite(point.lat) || Math.abs(point.lat)>85) return say('Drop within ±85° latitude.');
  const version = ++dragVersion, revision=store.revision;
  say('Sampling combined level at the drop point…');
  const payload=store.toPayload();
  payload.receivers=[{id:'contour-drop',lat:point.lat,lng:((point.lng+180)%360+360)%360-180}];
  try {
    const result = await post('/api/predict',payload);
    if (version!==dragVersion || revision!==store.revision) return;
    const reading=result.receivers['contour-drop'];
    if (reading.near_field) return say('Drop at least 1 metre away from every source.');
    if (reading.level_db===null) return say('Place a source before dragging contours.');
    const level = Math.round(reading.level_db*10)/10;
    if (!store.updateContour(contourId,{level_db:level})) {
      manager.contourLayer.render(geometry,store.contours);
      return say('That drop would duplicate another level or be outside 0–180 dB(A).');
    }
    contours.render(); say(`Contour set to ${level.toFixed(1)} dB(A) from the combined level at the drop point.`);
  } catch (error) {
    if (version!==dragVersion) return;
    manager.contourLayer.render(geometry,store.contours); failed(error);
  }
};

// Delegation keeps handlers stable even when individual entity cards are replaced.
document.querySelector('.sidebar').addEventListener('click',event=> {
  const button=event.target.closest('button'); if (!button) return;
  if (button.dataset.removeType) {
    if (store.sources.some(s=>s.type_id===button.dataset.removeType)) return say('Remove this type’s machines before deleting the type.');
    store.removeMachineType(button.dataset.removeType);
  } else if (button.dataset.removeSource) store.removeSource(button.dataset.removeSource);
  else if (button.dataset.removeReceiver) store.removeReceiver(button.dataset.removeReceiver);
  else return;
  store.setMode(null); say('Removed.');
});
document.querySelector('.sidebar').addEventListener('submit',event=> {
  const form=event.target.closest('[data-position]'); if (!form) return;
  event.preventDefault(); const data=new FormData(form);
  const patch={lat:Number(data.get('lat')),lng:Number(data.get('lng'))};
  if (form.dataset.collection==='sources') store.updateSource(form.dataset.position,patch);
  else store.updateReceiver(form.dataset.position,patch);
  say('Position updated.');
});
$('cancel-mode').onclick=()=>store.setMode(null);
document.addEventListener('keydown',event=> {if(event.key==='Escape') store.setMode(null);});
$('home').onclick=()=> {manager.map.setView(HOME_COORDS,14); $('site-lat').value=HOME_COORDS[0]; $('site-lng').value=HOME_COORDS[1];};
$('location-form').onsubmit=event=> {event.preventDefault(); store.setMode(null); manager.map.setView([Number($('site-lat').value),Number($('site-lng').value)],14);};
$('show-overlay').onchange=()=>manager.contourLayer.setVisible($('show-overlay').checked);
$('demo').onclick=()=> {store.loadDemo(); manager.map.setView(HOME_COORDS,14); say('Fictional equipment, values and placements for demonstration only.');};
$('retry').onclick=()=> { $('retry').hidden=true; say('Retrying…'); refreshGeometry(); refreshReceivers(); };

catalogue.render(); entities.renderSources(); entities.renderReceivers({}); contours.render(); manager.syncModeUI();
// No request is needed until equipment or receivers are added.
