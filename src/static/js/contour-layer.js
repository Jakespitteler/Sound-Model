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
    this.labels = [];
    this.map.on('zoomend',()=>this.updateLabelVisibility());
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
    for (const {tooltip,bounds} of this.labels) {
      const a = this.map.latLngToContainerPoint(bounds.getNorthWest());
      const b = this.map.latLngToContainerPoint(bounds.getSouthEast());
      const element = tooltip.getElement();
      if (element) element.hidden = Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y)) < 90;
    }
  }

  /**
   * Draw lines that never intercept map drags or source placement clicks.
   * @param {import('./types.js').ContourGeometry[]} geometry Calculated level sets.
   * @param {import('./types.js').ContourLevel[]} settings Current threshold list.
   */
  render(geometry, settings) {
    this.group.clearLayers();
    this.labels = [];
    // Draw outer/lower contours first, then inner/higher contours.
    for (const contour of [...settings].sort((a,b)=>a.level_db-b.level_db)) {
      const result = geometry.find(g=>g.level_db === contour.level_db);
      if (!result?.lines.length) continue;
      const color = soundColor(contour.level_db);
      const lines = [...result.lines].sort((a,b)=>b.length-a.length);
      for (const coords of lines) {
        L.polyline(coords.map(([lng,lat])=>[lat,lng]),
          {color,weight:2.5,opacity:0.95,interactive:false,smoothFactor:0.5}).addTo(this.group);
      }
      const anchor = lines[0][Math.floor(lines[0].length / 4)];
      const label = document.createElement('span');
      label.textContent = `${contour.level_db.toFixed(1)} dB(A)`;
      label.style.color = color;
      const tooltip = L.tooltip({permanent:true,direction:'center',className:'contour-label',opacity:1,interactive:false})
        .setLatLng([anchor[1],anchor[0]]).setContent(label).addTo(this.group);
      this.labels.push({tooltip,bounds:L.latLngBounds(lines[0].map(([lng,lat])=>[lat,lng]))});
    }
    this.syncVisibility();
  }
}
