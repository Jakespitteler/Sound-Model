/**
 * Manages the Leaflet map, tile status feedback, draggable markers, and placement clicks.
 */

import {MapObjectControls} from './map-object-controls.js';
import { DEFAULT_VIEW, receiverLabel } from './state.js';
import { ContourLayer } from './contour-layer.js';
import { $, escapeHtml } from './utils.js';
import {soundColor} from './sound-style.js';
import {illustration} from './illustrations.js';
import {localGroup,nearestObject,freeMapRectangle} from './local-area.js';

/** Leaflet map, imagery availability and separately draggable source/receiver markers. */
export class MapManager {
  /** @param {import("./state.js").ScenarioStore} store Scenario controller. */
  constructor(store) {
    this.store = store;
    this.markers = L.layerGroup();
    this.receiverMarkers = new Map();
    this.receiverReadings = null;
    this.receiverFailed = false;
    this.map = L.map('map', {
      minZoom: 3,
      zoomAnimation: false,
      maxZoom: 19,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
    });
    const historyControl=L.control({position:'topleft'});
    historyControl.onAdd=()=> {
      const group=$('placement-history'); group.hidden=false;
      L.DomEvent.disableClickPropagation(group); L.DomEvent.disableScrollPropagation(group);
      return group;
    };
    historyControl.addTo(this.map);
    this.fitMine();
    this.markers.addTo(this.map);
    this.objectControls=new MapObjectControls(this.map,store);

    this.contourLayer = new ContourLayer(this.map);
    this.initTiles();
    this.bindMapEvents();
  }

  /** Open the mine-wide starting view; saved scenarios restore their own camera. */
  fitMine() {
    this.map.stop();
    this.map.setView([DEFAULT_VIEW.lat,DEFAULT_VIEW.lng],DEFAULT_VIEW.zoom,{animate:false});
    const centre = this.map.getCenter();
    $('site-lat').value = centre.lat.toFixed(5);
    $('site-lng').value = centre.lng.toFixed(5);
  }

  /** @return {import('./local-area.js').MapObject[]} All locations with collection-qualified identities. */
  mapObjects() {
    return ['sources','receivers','measurements'].flatMap(collection=>(this.store[collection] || []).map(item=>({...item,collection})));
  }

  /** Fit the 10 km pairwise group nearest the current map centre, keeping all sources in the acoustic scenario.
   * @return {number} Number of objects fitted; zero leaves an empty scene's camera unchanged. */
  fitLocalArea() {
    const objects=this.mapObjects();
    const anchor=nearestObject(objects,this.map.getCenter());
    const group=localGroup(objects,anchor);
    if (!group.length) return 0;
    const bounds=this.map.getContainer().getBoundingClientRect();
    const obstacles=[...this.map.getContainer().parentElement.querySelectorAll('.location-bar,.sound-key,.tile-status,.contour-alert,.map-fit-button,.leaflet-control')]
      .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width && rect.height)
      .map(rect=>({left:rect.left-bounds.left,right:rect.right-bounds.left,top:rect.top-bounds.top,bottom:rect.bottom-bounds.top}));
    const space=freeMapRectangle(bounds.width,bounds.height,obstacles);
    this.map.stop(); this.map.closePopup();
    this.map.fitBounds(group.map(item=>[item.lat,item.lng]),{animate:false,maxZoom:16,
      paddingTopLeft:[space.left,space.top],paddingBottomRight:[bounds.width-space.right,bounds.height-space.bottom]});
    return group.length;
  }

  /**
   * Update receiver badges without moving the map or replacing source markers.
   * @param {?Object<string, import('./types.js').Reading>} results Fresh readings; null while pending.
   * @param {boolean} failed Whether the request failed rather than remaining pending.
   */
  setReceiverReadings(results, failed = false) {
    this.receiverReadings = results;
    this.receiverFailed = failed;
    this.updateReceiverLabels();
  }

  /** Refresh hover/focus names and reading descriptions without replacing marker elements. */
  updateReceiverLabels() {
    for (const [id,marker] of this.receiverMarkers) {
      const index=this.store.receivers.findIndex(receiver=>receiver.id===id);
      const label=receiverLabel(this.store.receivers[index],index);
      const reading=this.receiverReadings?.[id];
      const description=this.receiverFailed ? 'unavailable' : !reading ? 'calculating' : reading.status==='negligible' ? 'negligible overall increase over background (less than 0.1 dB)' : reading.level_db===null
        ? 'no source contribution' : `${reading.level_db.toFixed(1)} dB(A) predicted source contribution`;
      const root=marker.getElement(), badge=root?.querySelector('.receiver-marker');
      if(badge) {
        const hasLevel=!this.receiverFailed && reading?.level_db!=null && reading.status!=='negligible';
        const value=this.receiverFailed ? 'Unavailable' : !reading ? '…' : reading.status==='negligible' ? 'Negligible overall increase' : reading.level_db===null ? 'No sources' : reading.level_db.toFixed(1);
        const name=badge.querySelector('.receiver-name'); name.textContent=label;
        const reference=badge.querySelector('.receiver-id'); reference.textContent=`R${index+1}`; reference.hidden=!this.store.receivers[index].name;
        badge.querySelector('.receiver-value').textContent=value;
        badge.querySelector('.receiver-number small').hidden=!hasLevel;
        badge.classList.toggle('is-status',!hasLevel);
        badge.style.setProperty('--level-color',soundColor(hasLevel ? reading.level_db : null));
        const size=badge.getBoundingClientRect();
        root.style.marginLeft=`${-size.width/2}px`; root.style.marginTop=`${-size.height/2}px`;
        marker.options.icon.options.iconSize=[size.width,size.height]; marker.options.icon.options.iconAnchor=[size.width/2,size.height/2];
      }
      marker.getTooltip().getContent().querySelector('strong').textContent=label;
      marker.getElement()?.setAttribute('aria-label',`${label} (R${index+1}): ${description}. Select for details.`);
      const popup=marker.getPopup()?.getContent();
      if(popup instanceof HTMLElement) popup.querySelector('[data-receiver-reading]').textContent=description;
      if (marker.isTooltipOpen()) this.fitObjectTooltip(marker.getTooltip(),marker);
    }
    this.objectControls.refresh();
  }

  /**
   * Build a draggable location badge with a coloured numeric sound-pressure reading.
   * @param {string} id Receiver ID.
   * @param {number} index Receiver position in the scenario list.
   * @return {L.DivIcon} A clear unknown/empty/error or numeric badge, never a false 0 dB.
   */
  receiverIcon(id, index) {
    const receiver=this.store.receivers[index],label=receiverLabel(receiver,index);
    return L.divIcon({className:'receiver-location',iconSize:null,iconAnchor:[0,0],
      html:`<div class="receiver-marker is-status" data-receiver-id="${escapeHtml(id)}" style="--level-color:${soundColor(null)}"><span class="receiver-identity"><span class="receiver-name">${escapeHtml(label)}</span><span class="receiver-id"${receiver.name ? '' : ' hidden'}>R${index+1}</span></span><strong class="receiver-number"><span class="receiver-value">…</span><small hidden>dB(A)</small></strong></div>`});
  }

  /**
   * Keep an open detail card inside the map without panning or moving its marker.
   * @param {L.Tooltip} tooltip Newly opened object tooltip with its measured content.
   * @param {L.Marker} [marker] Object whose current height determines the gap.
   */
  fitObjectTooltip(tooltip,marker) {
    const bounds = this.map.getContainer().getBoundingClientRect();
    const obstacles = [...this.map.getContainer().parentElement.querySelectorAll('.tile-status,.location-bar,.sound-key,.contour-alert,.map-fit-button,.leaflet-control')]
      .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width && rect.height);
    let best;
    for (const direction of ['top','bottom']) {
      const gap=marker ? Math.max(18,marker.getElement().getBoundingClientRect().height/2+2) : 18;
      const vertical = direction==='top' ? -gap : gap;
      tooltip.options.direction = direction;
      tooltip.options.offset = L.point(0,vertical);
      tooltip.update();
      const rect = tooltip.getElement().getBoundingClientRect();
      // Also try either side of controls, keeping the arrow within the card's width.
      const minimum = Math.max(bounds.left+8-rect.left,-rect.width/2+10);
      const maximum = Math.min(bounds.right-8-rect.right,rect.width/2-10);
      const candidates = [0,...obstacles.flatMap(obstacle=>[obstacle.left-8-rect.right,obstacle.right+8-rect.left])];
      const overflow = Math.max(0,bounds.top+8-rect.top)+Math.max(0,rect.bottom-bounds.bottom+8);
      for (const candidate of candidates) {
        const shift = Math.max(minimum,Math.min(maximum,candidate));
        const left=rect.left+shift, right=rect.right+shift;
        // Prefer an in-map card, then clear controls, then the least sideways movement.
        const covered = obstacles.reduce((area,obstacle)=>area+
          Math.max(0,Math.min(right,obstacle.right)-Math.max(left,obstacle.left))*
          Math.max(0,Math.min(rect.bottom,obstacle.bottom)-Math.max(rect.top,obstacle.top)),0);
        const score = overflow*rect.width*10+covered+Math.abs(shift)*.05;
        if (!best || score<best.score) best={direction,vertical,shift,width:rect.width,score};
      }
    }
    tooltip.options.direction = best.direction;
    tooltip.options.offset = L.point(best.shift,best.vertical);
    tooltip.getElement().style.setProperty('--tooltip-arrow-x',`${best.width/2-best.shift}px`);
    tooltip.update();
  }

  /** Initialise the existing Esri imagery provider and explicit loading failure state. */
  initTiles() {
    const tiles = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      },
    );

    let tileErrors = 0;
    let timeout;
    const unavailable = () => {
      $('tile-status').hidden = false;
      $('tile-status').textContent = 'Satellite imagery is slow to load. You can still place machines and calculate.';
    };
    tiles.on('loading', () => {
      tileErrors = 0;
      clearTimeout(timeout);
      timeout = setTimeout(unavailable, 10000);
    });
    tiles.on('tileerror', () => {
      tileErrors++;
      $('tile-status').hidden = false;
      $('tile-status').textContent =
        'Satellite imagery unavailable. You can still place machines and calculate.';
    });
    tiles.on('load', () => {
      clearTimeout(timeout);
      if (!tileErrors) $('tile-status').hidden = true;
    });
    tiles.addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
  }

  /** Bind placement only: camera movement never triggers acoustic requests. */
  bindMapEvents() {
    this.map.on('resize',()=>this.markers.eachLayer(marker=> {
      if (marker.isTooltipOpen()) this.fitObjectTooltip(marker.getTooltip(),marker);
    }));
    this.map.on('movestart',()=>this.markers.eachLayer(marker=>marker.closeTooltip()));
    this.map.on('click', (event) => {
      if (!this.store.mode) return;
      const lat = Math.max(-85, Math.min(85, event.latlng.lat));
      const lng = Math.max(-180, Math.min(180, event.latlng.lng));
      if (this.store.mode === 'source') {
        const count=this.store.sources.length;
        this.store.addSource($('place-type').value, lat, lng);
        // The store commits one ordinary placement (including history/recovery).
        // Resume only after an accepted Ctrl-click, and stop at the source cap.
        if (event.originalEvent?.ctrlKey && this.store.sources.length>count && this.store.sources.length<100) {
          this.store.setMode('source');
        }
      } else if(this.store.mode==='receiver') {
        this.store.addReceiver(lat, lng);
      }
    });
  }

  /** Reflect the active placement mode without replacing forms or markers. */
  syncModeUI() {
    $('fit-local-area').disabled=!(this.store.sources.length || this.store.receivers.length || this.store.measurements?.length);
    const mode = this.store.mode;
    $('mode-label').textContent =
      mode === 'source'
        ? 'Click to place · Ctrl-click to place multiple · Esc to cancel'
        : mode === 'receiver'
          ? 'Click the map to place a receiver'
          : mode === 'fit-area' ? 'Click the centre of the operating area' : mode === 'measurement' ? 'Click the map to mark a measured location' : 'Pan to explore · drag markers to move';
    $('cancel-mode').hidden = !mode;
    $('map').classList.toggle('place-mode', Boolean(mode));
  }

  /** Rebuild entity markers only after catalogue/source/receiver mutations. */
  renderMarkers() {
    this.objectControls.clear(['sources','receivers']);
    this.markers.clearLayers();
    this.receiverMarkers.clear();
    for (const collection of ['sources', 'receivers']) {
      this.store[collection].forEach((item, i) => {
        const isSource = collection === 'sources';
        const label = isSource ? `${i + 1}. ${this.store.typeFor(item).name}${item.disabled?' · Off':''}` : receiverLabel(item,i);
        const machine = isSource ? this.store.typeFor(item) : null;
        const icon = !isSource ? this.receiverIcon(item.id,i) : L.divIcon({
          className:'machine-location',iconSize:[32,32],iconAnchor:[16,16],
          html:`<div class="machine-marker source-badge" data-source-id="${escapeHtml(item.id)}"><span class="source-symbol">${illustration(machine.kind)}</span><span class="source-number" aria-hidden="true">${i+1}</span></div>`,
        });
        const marker = L.marker([item.lat, item.lng], {
          icon,
          draggable: machine?.kind!=='area',
          alt: label,
          riseOnHover: true,
          opacity:isSource && item.disabled?0.55:1,
        }).addTo(this.markers);

        if (!isSource) this.receiverMarkers.set(item.id, marker);
        const tooltip = document.createElement('span');
        const tooltipTitle = document.createElement('strong'); tooltipTitle.textContent = label;
        tooltip.append(tooltipTitle);
        if (isSource) {
          const emission = document.createElement('small'); emission.textContent = `Sound power · ${machine.lwa.toFixed(1)} dB(A) LwA`;
          tooltip.append(emission);
        }
        marker.getElement()?.setAttribute('aria-label', isSource ? `${label}. Sound power ${machine.lwa.toFixed(1)} dB(A) LwA. Select for details.` : label);
        marker.bindTooltip(tooltip,{direction:'top',offset:[0,-18],className:'object-tooltip',opacity:1});
        marker.on('tooltipopen',event=>this.fitObjectTooltip(event.tooltip,marker));
        const popup = document.createElement('div');
        popup.className = 'source-popup object-popup';
        const title = document.createElement('strong'); title.textContent = label; title.dataset.objectTitle='';
        popup.append(title);
        if (isSource) {
          const power = document.createElement('p'); power.textContent = `Sound power: ${machine.lwa.toFixed(1)} dB(A) LwA. Sound at a listening point depends on distance.`;
          const evidence = document.createElement('p'); evidence.textContent = machine.note || 'No source note recorded.';
          const toggle=document.createElement('button');
          toggle.type='button';toggle.className='secondary compact';
          toggle.textContent=item.disabled?'Switch on':'Switch off';
          toggle.onclick=()=>{this.map.closePopup();this.store.toggleSource(item.id);};
          popup.append(power,evidence,toggle);
        } else {
          const reading=document.createElement('p'); reading.dataset.receiverReading=''; popup.append(reading);
        }
        this.objectControls.bind(marker,collection,item.id,popup);

        marker.on('dragend', () => {
          const p = marker.getLatLng();
          const lat = Math.max(-85, Math.min(85, p.lat));
          const lng = Math.max(-180, Math.min(180, p.lng));
          if (isSource) {
            this.store.updateSource(item.id, { lat, lng });
          } else {
            this.store.updateReceiver(item.id, { lat, lng });
          }
        });
      });
    }
    this.updateReceiverLabels();
  }
}
