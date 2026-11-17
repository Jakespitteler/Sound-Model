/** @fileoverview Read-only geographic contour lines; map gestures only pan/zoom. */
import {soundColor} from './sound-style.js';

/** Fixed line weight and automatic colours keep contour editing in the sidebar. */
export class ContourLayer {
  /** @param {L.Map} map Leaflet map with the existing imagery provider. */
  constructor(map) {
    this.map = map;
    this.group = L.layerGroup().addTo(map);
    this.visible = true;
    this.pending = false;
    this.highContrast = false;
    this.halos = L.layerGroup();
    if (!this.map.getPane('contour-halos')) {
      const pane = this.map.createPane('contour-halos'); pane.style.zIndex='390'; pane.style.pointerEvents='none';
    }
    if (!this.map.getPane('contour-labels')) {
      const pane = this.map.createPane('contour-labels'); pane.style.zIndex='450'; pane.style.pointerEvents='none';
    }
    this.labels = [];
    this.map.on('zoomend',()=>this.updateLabelVisibility());
  }

  /** @param {boolean} enabled Add/remove white line halos without a model request. */
  setHighContrast(enabled) {
    this.highContrast = enabled;
    if (enabled) this.group.addLayer(this.halos); else this.group.removeLayer(this.halos);
  }

  /** @param {boolean} visible Whether the user wants contours shown. */
  setVisible(visible) { this.visible = visible; this.syncVisibility(); }

  /** @param {boolean} pending Hide obsolete geometry during source/threshold updates. */
  setPending(pending) { this.pending = pending; this.syncVisibility(); }

  /** Combine user visibility with pending-state visibility. */
  syncVisibility() {
    if (this.visible && !this.pending) this.group.addTo(this.map);
    else this.map.removeLayer(this.group);
    this.updateLabelVisibility();
  }

  /** Hide labels on very small rings to keep machine markers readable; no requests. */
  updateLabelVisibility() {
    for (const {tooltip,bounds,acceptable} of this.labels) {
      const a = this.map.latLngToContainerPoint(bounds.getNorthWest());
      const b = this.map.latLngToContainerPoint(bounds.getSouthEast());
      const element = tooltip.getElement();
      if (element) element.hidden = !acceptable && Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y)) < 90;
    }
  }

  /**
   * Draw lines that never intercept map drags or source placement clicks.
   * @param {import('./types.js').ContourGeometry[]} geometry Calculated level sets.
   * @param {import('./types.js').ContourLevel[]} settings Current threshold list.
   */
  render(geometry, settings) {
    this.group.clearLayers();
    this.halos.clearLayers();
    if (this.highContrast) this.group.addLayer(this.halos);
    this.labels = [];
    // Draw outer/lower contours first, then inner/higher contours.
    for (const contour of [...settings].sort((a,b)=>a.level_db-b.level_db)) {
      const result = geometry.find(g=>g.level_db === contour.level_db);
      if (!result?.lines.length) continue;
      const color = soundColor(contour.level_db);
      const dashArray=contour.acceptable ? '10 6' : undefined;
      const lines = [...result.lines].sort((a,b)=>b.length-a.length);
      for (const coords of lines) {
        L.polyline(coords.map(([lng,lat])=>[lat,lng]), {pane:'contour-halos',color:'#fff',weight:contour.acceptable ? 8 : 7,dashArray,opacity:.95,interactive:false,smoothFactor:.5}).addTo(this.halos);
        L.polyline(coords.map(([lng,lat])=>[lat,lng]),
          {color,weight:contour.acceptable ? 4 : 2.5,dashArray,opacity:0.95,interactive:false,smoothFactor:0.5}).addTo(this.group);
      }
      const anchor = lines[0][Math.floor(lines[0].length / 4)];
      const label = document.createElement('span');
      label.textContent = `${contour.acceptable ? 'Acceptable level — user-set · ' : ''}${contour.level_db.toFixed(1)} dB(A)`;
      label.style.color = color;
      const tooltip = L.tooltip({pane:'contour-labels',permanent:true,direction:'center',className:contour.acceptable ? 'contour-label acceptable-label' : 'contour-label',opacity:1,interactive:false})
        .setLatLng([anchor[1],anchor[0]]).setContent(label).addTo(this.group);
      this.labels.push({tooltip,acceptable:contour.acceptable,bounds:L.latLngBounds(lines[0].map(([lng,lat])=>[lat,lng]))});
    }
    this.syncVisibility();
  }
}
