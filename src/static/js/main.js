/** @fileoverview Bind state, UI and two independent request lanes. No camera fetches. */
import {bindBackgroundSpectrum} from './band-ui.js';
import {boundaryLevel} from './background.js';
import {AddressSearch} from './address-search.js';
import {$} from './utils.js';
import {ScenarioStore} from './state.js';
import {GeometryCache, RequestLane} from './api.js';
import {MapManager} from './map-manager.js';
import {CatalogueUI} from './ui-catalogue.js';
import {EntitiesUI} from './ui-entities.js';
import {ContoursUI} from './ui-contours.js';
import {renderSoundGuide} from './sound-guide.js';
import {setupWorkflow} from './workflow.js';
import {setupSidebar} from './sidebar.js';
import {ScenarioFilesUI} from './scenario-files.js';
import {FittingUI} from './ui-fitting.js';
import {MeasurementUI} from './ui-measurements.js';
import {DraftRecovery} from './draft-recovery.js';

const store = new ScenarioStore();
const manager = new MapManager(store);
new AddressSearch(()=>manager.map.getCenter(),place=> {
  store.setMode(null); manager.map.stop(); manager.map.closePopup();
  if(place.bounds) manager.map.fitBounds([[place.bounds[0],place.bounds[1]],[place.bounds[2],place.bounds[3]]],{padding:[20,20],maxZoom:16,animate:false});
  else manager.map.setView([place.lat,place.lng],16,{animate:false});
});
const cache = new GeometryCache();
const geometryLane = new RequestLane(), receiverLane = new RequestLane(), rangeLane=new RequestLane();
const sliderRanges=new Map();
/** @type {import('./types.js').ContourGeometry[]} Last valid current geometry. */
let geometry = [];
let receiverResults = {}, bandResults={};
let receiverFailed = false, geometryFailed = false, rangeFailed=false;
/** Keep independent request errors visible regardless of which lane finishes first. */
function updateRetry() { $('retry').hidden=!(receiverFailed || geometryFailed || rangeFailed); }
/** @param {string} message Human-readable feedback. */
const say = message => { $('message').textContent = message; };
const catalogue = new CatalogueUI(store,say), entities = new EntitiesUI(store,say), contours = new ContoursUI(store,say);
const measurements=new MeasurementUI(store,manager,say);
new FittingUI(store,manager,say,id=>{document.dispatchEvent(new Event('open-measurement'));measurements.open(id);});
catalogue.bind(); entities.bind(); contours.bind(); renderSoundGuide(); setupSidebar(); setupWorkflow(store);
const syncBackgroundSpectrum=bindBackgroundSpectrum(store,say);

/** @param {Error} error Failure displayed with an explicit retry. */
function failed(error) {
  say(error.message); updateRetry();
}

/** Update receivers only; this lane never rebuilds or removes contours. */
function refreshReceivers() {
  if (!store.receivers.length) {
    receiverLane.cancel(); receiverResults = {}; receiverFailed=false; updateRetry(); entities.renderReceivers({}); return;
  }
  receiverLane.schedule('/api/predict',store.toPayload(),{
    start:()=> {receiverFailed=false; updateRetry(); entities.renderReceivers(); manager.setReceiverReadings(null);},
    success:data=> {receiverFailed=false; updateRetry(); receiverResults=data.receivers; bandResults=data.band_results || {}; entities.renderReceivers(receiverResults,bandResults); manager.setReceiverReadings(receiverResults);},
    error:error=> {
      entities.renderReceivers();
      document.querySelectorAll('#receivers .result').forEach(e=> {e.textContent='Unavailable';});
      receiverFailed=true; manager.setReceiverReadings(null, true); failed(error);
    },
  });
}

/** @param {import('./types.js').ContourGeometry[]} results Current results in threshold order. */
function displayGeometry(results) {
  geometry=results;
  if ($('message').textContent==='Retrying…') say('');
  const failures=geometry.filter(c=>c.status==='failed');
  geometryFailed=!!failures.length; updateRetry(); contours.setResults(geometry);
  manager.contourLayer.render(geometry,store.lineSettings()); manager.contourLayer.setPending(false);
  const empty=geometry.filter(c=>c.status==='empty').map(c=>`${c.level_db} dB(A)`);
  const examples=store.sources.some(s=>store.typeFor(s).provenance==='example');
  $('calculation-status').textContent=store.sources.length ?
    `${store.sources.length} sources · geometry estimate${examples?' · example data':''}${store.sources.some(s=>store.typeFor(s).lwa===300)?' · Extreme input: machinery model unsupported':''}${failures.length?' · '+failures.length+' failed level(s)':''}${empty.length?' · No crossing at '+empty.join(', '):''}` : 'Add a source to begin';
}

/** Reuse exact current-source levels and request only missing ones; every edit still versions the lane. */
function refreshGeometry() {
  const payload=store.toPayload(); payload.receivers=[];
  payload.levels=store.getContourLevels();
  const cached=payload.levels.map(level=>cache.get(cache.key(payload,level))).filter(Boolean);
  const missing=payload.levels.filter(level=>!cached.some(c=>c.level_db===level));
  /** @param {Object[]} fresh New per-level results. @param {string} [error] Missing-result reason.
   * @return {Object[]} Complete, current-order results without omitted levels. */
  const merge=(fresh,error='The server returned no result for this contour.')=>payload.levels.map(level_db=>
    fresh.find(c=>c.level_db===level_db) || cached.find(c=>c.level_db===level_db) || {level_db,lines:[],status:'failed',error});
  geometryLane.schedule('/api/contours',{...payload,levels:missing},{
    start:()=> {
      geometryFailed=false; updateRetry(); contours.setResults(cached);
      // Keep valid unaffected levels; discard old-source/removed-level lines immediately.
      manager.contourLayer.render(cached,store.lineSettings()); manager.contourLayer.setPending(false);
      $('calculation-status').textContent='Updating contours…';
    },
    success:data=> {
      if (data.model!==cache.model || data.tolerance_db!==cache.toleranceDb) {
        // Never combine results from different model/accuracy contracts.
        cache.entries.clear(); cached.length=0;
        throw new Error('Contour model changed. Reload the app before calculating again.');
      }
      for (const result of data.contours) {
        if (payload.levels.includes(result.level_db)) cache.set(cache.key(payload,result.level_db),result);
      }
      displayGeometry(merge(data.contours));
    },
    error:error=> {
      displayGeometry(merge(missing.map(level_db=>({level_db,lines:[],status:'failed',error:error.message})),error.message));
      if (!cached.length) $('calculation-status').textContent='Contours unavailable';
      failed(error);
    },
  },(!payload.sources.length || !payload.levels.length || !missing.length) ?
    {model:cache.model,tolerance_db:cache.toleranceDb,contours:!payload.sources.length ?
      payload.levels.map(level_db=>({level_db,lines:[],status:'empty'})) : cached} : null);
}

/** Fetch checked slider limits only after a source signature changes, never on camera/threshold edits. */
function refreshSliderRange() {
  const payload=store.toPayload();payload.receivers=[];
  if (!payload.sources.length) {rangeLane.cancel(); rangeFailed=false; updateRetry(); contours.setSliderRange({status:'unavailable',reason:'Place a machine to enable the slider.'}); return;}
  const key=cache.key(payload,0);
  rangeLane.schedule('/api/contour-range',payload,{
    start:()=> {rangeFailed=false;updateRetry();contours.setSliderRange(null);},
    success:range=> {
      rangeFailed=false; updateRetry();
      sliderRanges.set(key,range);
      if (sliderRanges.size>8) sliderRanges.delete(sliderRanges.keys().next().value);
      contours.setSliderRange(range);
    },
    error:error=> {rangeFailed=true;updateRetry();contours.setSliderRange({status:'unavailable',reason:'Slider unavailable; retry or enter a number.',error:error.message});},
  },sliderRanges.get(key));
}

/** Refresh bounded history controls without a state notification or sound request. */
function renderHistory() {
  for (const [id,stack] of [['undo-placement',store.undoStack],['redo-placement',store.redoStack]]) {
    $(id).disabled=!stack.length;
    $(id).title=stack.length ? `${id==='undo-placement' ? 'Undo' : 'Redo'}: ${stack.at(-1).label}` : 'No placement edits';
  }
}

/** @param {boolean} redo Replay a placement action in the requested direction. */
function replayPlacement(redo) {
  const label=redo ? store.redo() : store.undo();
  if (label) say(`${redo ? 'Redid' : 'Undid'}: ${label.toLowerCase()}.`);
}
/** Keep the scenario-wide background field and adaptive boundary summary in sync. */
function syncBackground() {
  $('background-level').value=store.background_db===null ? '' : String(store.background_db);
  const boundary=boundaryLevel(store.background_db);
  $('background-status').textContent=boundary===null ? 'Enter background to show the overall-increase boundary.' : `Overall increase: +0.1 dB at ${boundary.toFixed(1)} dB(A) machinery`;
}
$('background-level').onchange=()=> {
  const input=$('background-level');
  if(!input.checkValidity()) {input.reportValidity(); return;}
  store.setBackground(input.value==='' ? null : input.valueAsNumber);
};

$('undo-placement').onclick=()=>replayPlacement(false);
$('redo-placement').onclick=()=>replayPlacement(true);
document.addEventListener('keydown',event=> {
  if (!(event.target instanceof Element) || !(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing ||
    event.target.closest('input,textarea,select,[role="textbox"]') || event.target.isContentEditable ||
    document.querySelector('dialog[open]')) return;
  const key=event.key.toLowerCase();
  if (key!=='z' && key!=='y') return;
  event.preventDefault(); replayPlacement(key==='y' || event.shiftKey);
});

store.subscribe(reason=> {
  renderHistory();
  if (['geometry','catalogue','receivers','thresholds','restore'].includes(reason)) say('');
  manager.syncModeUI();
  if (['geometry','catalogue','background','restore'].includes(reason)) refreshSliderRange();
  if (reason==='background' || reason==='restore') syncBackground();
  if (reason==='restore') syncBackgroundSpectrum();
  if (reason==='spectra') refreshReceivers();
  if (reason==='acceptable-level') contours.syncAcceptable();
  if (reason==='equipment-metadata') {catalogue.render(); manager.renderMarkers();}
  if (reason==='receiver-name') {entities.updateReceiverNames(); manager.updateReceiverLabels();}
  if (reason==='restore') {contours.render(); $('cloud').value=store.cloud_cover; $('cloud-value').textContent=`${store.cloud_cover}%`;}
  if (['geometry','catalogue','restore'].includes(reason)) { catalogue.render(); entities.renderSources(); }
  if (['geometry','catalogue','receivers','background','restore'].includes(reason)) { if(reason!=='background') manager.renderMarkers(); refreshReceivers(); }
  if (['geometry','catalogue','thresholds','acceptable-level','background','restore'].includes(reason)) {
    refreshGeometry();
  }
});

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
$('fit-local-area').onclick=()=> {
  store.setMode(null);
  const count=manager.fitLocalArea();
  say(count ? `Showing ${count} of ${store.sources.length+store.receivers.length} objects in this local area.` : 'Place a machine or receiver first.');
};
$('home').onclick=()=> {store.setMode(null); manager.fitMine();};
$('location-form').onsubmit=event=> {event.preventDefault(); store.setMode(null); manager.map.setView([Number($('site-lat').value),Number($('site-lng').value)],14);};
$('contour-alert').onclick=()=> {document.getElementById('contours-tab').click(); $('contour-errors').scrollIntoView({block:'nearest'});};
$('contour-contrast').onchange=()=>manager.contourLayer.setHighContrast($('contour-contrast').checked);
$('show-overlay').onchange=()=>manager.contourLayer.setVisible($('show-overlay').checked);
$('demo').onclick=()=> {
  store.loadDemo();
  manager.fitMine();
  say('Demonstration positions and guessed machine levels; not actual company operations.');
};
$('retry').onclick=()=> { $('retry').hidden=true; say('Retrying…'); refreshGeometry(); refreshReceivers(); refreshSliderRange(); };

syncBackground(); renderHistory(); catalogue.render(); entities.renderSources(); entities.renderReceivers({}); contours.render(); manager.syncModeUI();
// No request is needed until equipment or receivers are added.

const files = new ScenarioFilesUI(store,manager,say);
files.bind();
const recovery = new DraftRecovery(files);
recovery.start();
