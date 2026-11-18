/** @fileoverview Popup deletion and temporary Ctrl-held controls; no acoustic calculations. */
import {freeMapRectangle} from './local-area.js';
import {receiverLabel} from './state.js';

const CROSS='<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

/** Bind delete actions by collection and stable ID, independently of reading-marker HTML. */
export class MapObjectControls {
  /** @param {L.Map} map Existing map. @param {import('./state.js').ScenarioStore} store Shared state. */
  constructor(map,store) {
    this.map=map; this.store=store; this.records=new Map(); this.group=L.layerGroup();
    this.active=false; this.lastPointer={at:-Infinity,x:0,y:0};
    const pane=map.getPane('object-delete-controls') || map.createPane('object-delete-controls');
    pane.style.zIndex='680'; pane.style.pointerEvents='none';
    const popups=map.getPane('object-popups') || map.createPane('object-popups'); popups.style.zIndex='720';
    document.addEventListener('keydown',event=> {
      if(event.key==='Escape') {this.map.closePopup(); this.setActive(false);}
      else if(event.key==='Control' && !event.repeat && !event.isComposing) this.setActive(!this.editing(event.target));
    });
    document.addEventListener('keyup',event=> {if(event.key==='Control') this.setActive(false);});
    document.addEventListener('focusin',event=> {if(this.editing(event.target)) this.setActive(false);});
    document.addEventListener('visibilitychange',()=>this.setActive(false));
    window.addEventListener('blur',()=>this.setActive(false));
    map.on('moveend resize',()=>this.refresh());
  }

  /** @param {?EventTarget} target Keyboard/focus target. @return {boolean} Whether map shortcuts must stay inactive. */
  editing(target) {
    return !!document.querySelector('dialog[open]') || target instanceof Element &&
      (!!target.closest('input,textarea,select,[role="textbox"],[role="combobox"],dialog') || target.isContentEditable);
  }

  /** @param {boolean} active Show controls only during the current Control hold. */
  setActive(active) {
    this.active=active;
    if(active) {this.group.addTo(this.map); this.refresh();}
    else {
      if(document.activeElement?.closest('.map-delete-marker')) this.focusMap();
      this.group.clearLayers(); this.group.remove();
    }
  }

  /** Return focus to the map before removing the activated control. */
  focusMap() {this.map.getContainer().focus({preventScroll:true});}

  /** Clear bindings before an ordinary marker rebuild, retaining the held-key state. */
  clear() {this.group.clearLayers(); this.records.clear();}

  /** @param {string} collection Source or receiver collection. @param {string} id Stable identity.
   * @param {boolean} shortcut Whether this is the temporary Ctrl control. @param {MouseEvent|KeyboardEvent} event Activation. */
  remove(collection,id,shortcut,event) {
    event.preventDefault(); event.stopImmediatePropagation();
    const repeatedPointer=event instanceof MouseEvent && performance.now()-this.lastPointer.at<300 &&
      Math.hypot(event.clientX-this.lastPointer.x,event.clientY-this.lastPointer.y)<12;
    if(shortcut && (!this.active || event.detail>1 || repeatedPointer)) return;
    if(!this.store[collection].some(item=>item.id===id)) return;
    if(shortcut && event instanceof MouseEvent) this.lastPointer={at:performance.now(),x:event.clientX,y:event.clientY};
    this.focusMap(); this.map.closePopup();
    if(collection==='sources') this.store.removeSource(id); else this.store.removeReceiver(id);
  }

  /** @param {string} collection Source or receiver collection. @param {string} id Stable identity.
   * @param {boolean} shortcut Compact map control, otherwise popup action. @return {HTMLButtonElement} Accessible button. */
  button(collection,id,shortcut) {
    const button=document.createElement('button'); button.type='button';
    button.className=shortcut ? 'map-delete-button' : 'object-popup-delete';
    if(shortcut) button.innerHTML=CROSS;
    else button.textContent=collection==='sources' ? 'Delete machine' : 'Delete receiver';
    button.addEventListener('click',event=>this.remove(collection,id,shortcut,event));
    button.addEventListener('keydown',event=> {
      if(event.key==='Enter' || event.key===' ') {
        event.preventDefault(); event.stopPropagation();
        if(!event.repeat) this.remove(collection,id,shortcut,event);
      }
    });
    return button;
  }

  /** Keep popups in usable map space instead of beneath navigation/guide overlays.
   * @return {Object} Leaflet padding and content-size options. */
  popupOptions() {
    const bounds=this.map.getContainer().getBoundingClientRect();
    const obstacles=[...this.map.getContainer().parentElement.querySelectorAll('.location-bar,.sound-key,.tile-status,.contour-alert,.map-fit-button,.leaflet-control')]
      .map(element=>element.getBoundingClientRect()).filter(rect=>rect.width && rect.height)
      .map(rect=>({left:rect.left-bounds.left,right:rect.right-bounds.left,top:rect.top-bounds.top,bottom:rect.bottom-bounds.top}));
    const space=freeMapRectangle(bounds.width,bounds.height,obstacles);
    return {autoPanPaddingTopLeft:L.point(space.left+10,space.top+10),
      autoPanPaddingBottomRight:L.point(bounds.width-space.right+10,bounds.height-space.bottom+10),
      maxWidth:Math.max(160,Math.min(260,space.right-space.left-40)),
      maxHeight:Math.max(60,Math.min(240,space.bottom-space.top-65))};
  }

  /** Attach a popup action and a separate marker control, so receiver setIcon never destroys it.
   * @param {L.Marker} marker Draggable object. @param {string} collection Source/receiver collection.
   * @param {string} id Stable identity. @param {HTMLElement} popup Existing object information. */
  bind(marker,collection,id,popup) {
    const action=this.button(collection,id,false);
    const reading=popup.querySelector('p');
    if(reading) reading.after(action); else popup.append(action);
    marker.on('click',()=> {
      if(this.store.mode) this.store.setMode(null);
      Object.assign(marker.getPopup().options,this.popupOptions());
    });
    marker.bindPopup(popup,{pane:'object-popups',...this.popupOptions()});
    marker.on('popupopen',()=>marker.closeTooltip());
    marker.on('tooltipopen',()=> {if(marker.isPopupOpen()) marker.closeTooltip();});
    const button=this.button(collection,id,true);
    const overlay=L.marker(marker.getLatLng(),{keyboard:false,pane:'object-delete-controls',
      icon:L.divIcon({className:'map-delete-marker',html:button,iconSize:[24,24],iconAnchor:[0,29]})});
    const record={marker,overlay,button,action,collection,id,popup};
    this.records.set(`${collection}:${id}`,record);
    marker.on('drag',()=>overlay.setLatLng(marker.getLatLng()));
    overlay.on('add',()=> {
      const root=overlay.getElement();
      L.DomEvent.disableClickPropagation(root); L.DomEvent.disableScrollPropagation(root);
      root.addEventListener('pointerdown',event=>event.stopPropagation());
    });
  }

  /** Refresh names, visibility and offsets without state notifications or marker replacement. */
  refresh() {
    for(const record of this.records.values()) {
      const {marker,overlay,button,action,collection,id,popup}=record;
      const index=this.store[collection].findIndex(item=>item.id===id);
      if(index<0) {this.group.removeLayer(overlay); continue;}
      const label=collection==='sources' ? `machine ${index+1}: ${this.store.typeFor(this.store.sources[index]).name}` : receiverLabel(this.store.receivers[index],index);
      button.setAttribute('aria-label',`Delete ${label}`); button.title=`Delete ${label}`;
      action.setAttribute('aria-label',`Delete ${label}`);
      const title=popup.querySelector('[data-object-title]');
      if(title && collection==='receivers') title.textContent=label;
      if(this.active && this.map.getBounds().contains(marker.getLatLng())) {
        this.group.addLayer(overlay);
        const root=overlay.getElement(), icon=marker.getElement();
        if(root && icon) {
          const half=icon.getBoundingClientRect().width/2, point=this.map.latLngToContainerPoint(marker.getLatLng());
          const width=this.map.getSize().x;
          let left=half-12;
          if(point.x+left+24>width-2) left=-half-12;
          root.style.marginLeft=`${Math.max(2-point.x,Math.min(width-point.x-26,left))}px`;
          root.style.marginTop=`${point.y<31 ? 5 : -29}px`;
        }
      } else this.group.removeLayer(overlay);
    }
  }
}
