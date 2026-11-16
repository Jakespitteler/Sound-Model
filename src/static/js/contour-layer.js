/** @fileoverview Geographic polylines with threshold-drag interaction, independent of camera. */
import {escapeHtml} from './utils.js';

/** Persistent geographic lines, retained on pan/zoom and receiver changes. */
export class ContourLayer {
  /** @param {L.Map} map Leaflet map with the existing provider. */
  constructor(map) {
    this.map = map;
    this.group = L.layerGroup().addTo(map);
    this.visible = true;
    this.pending = false;
    this.revision = 0;
    /** @type {function(string, L.LatLng):void} */
    this.onThresholdDrop = () => {};
  }

  /** @param {boolean} visible Whether the user wants any contours shown. */
  setVisible(visible) { this.visible = visible; this.syncVisibility(); }

  /** @param {boolean} pending Hide outdated geometry during source/threshold edits. */
  setPending(pending) { this.pending = pending; this.syncVisibility(); }

  /** Apply combined user-visibility and calculation-pending state. */
  syncVisibility() {
    if (this.visible && !this.pending) this.group.addTo(this.map);
    else this.map.removeLayer(this.group);
  }

  /**
   * Render cached geometry using the current local styling, with a labelled drag handle.
   * @param {import('./types.js').ContourGeometry[]} geometry Calculated lines.
   * @param {import('./types.js').ContourStyle[]} settings Editable presentation settings.
   */
  render(geometry, settings) {
    this.revision++;
    this.group.clearLayers();
    for (const contour of settings) {
      const result = geometry.find(g=>g.level_db === contour.level_db);
      if (!contour.visible || !result?.lines.length) continue;
      const dashArray = {solid:null,dashed:'8 5',dotted:'2 5'}[contour.style];
      const options = {color:contour.color,weight:contour.weight,dashArray,opacity:0.95,bubblingMouseEvents:false};
      // Draw longer outer components first; labels never imply arbitrary editable shapes.
      const lines = [...result.lines].sort((a,b)=>b.length-a.length);
      for (const coords of lines) {
        const path = L.polyline(coords.map(([lng,lat])=>[lat,lng]), options).addTo(this.group);
        path.bindTooltip(`${contour.level_db.toFixed(1)} dB(A) · drag to set threshold`,{sticky:true});
        this.bindLineDrag(path, contour.id);
      }
      // One touch/keyboard-focusable labelled handle per level, anchored on its largest component.
      const anchor = lines[0][Math.floor(lines[0].length / 4)];
      const marker = L.marker([anchor[1],anchor[0]], {draggable:true,bubblingMouseEvents:false,
        title:`Drag ${contour.level_db.toFixed(1)} dB(A) contour to change its threshold`,
        icon:L.divIcon({className:'contour-handle',html:`<span style="border-color:${escapeHtml(contour.color)}">${contour.level_db.toFixed(1)} dB</span>`,iconSize:[68,24],iconAnchor:[34,12]})}).addTo(this.group);
      const revision = this.revision;
      marker.on('dragend',()=> { if (revision === this.revision) this.onThresholdDrop(contour.id,marker.getLatLng()); });
    }
    this.syncVisibility();
  }

  /**
   * Let a mouse drag any point on the actual polyline; the drop sets a new dB level.
   * A marker handle provides the corresponding touch interaction.
   * @param {L.Polyline} path Individual connected line.
   * @param {string} id Contour setting ID.
   */
  bindLineDrag(path, id) {
    path.on('mousedown', event => {
      if (event.originalEvent.button !== 0) return;
      L.DomEvent.stop(event.originalEvent);
      const revision = this.revision, start = this.map.latLngToLayerPoint(event.latlng);
      const original = path.getLatLngs();
      const dragging = this.map.dragging.enabled();
      this.map.dragging.disable();
      let moved = false;
      const move = e => {
        const delta = this.map.latLngToLayerPoint(e.latlng).subtract(start);
        if (delta.distanceTo(L.point(0,0)) < 3) return;
        moved = true;
        path.setLatLngs(original.map(p=>this.map.layerPointToLatLng(this.map.latLngToLayerPoint(p).add(delta))));
      };
      const finish = e => {
        this.map.off('mousemove',move); this.map.off('mouseup',finish);
        document.removeEventListener('mouseup',outside);
        if (dragging) this.map.dragging.enable();
        path.setLatLngs(original);
        if (moved && revision === this.revision) this.onThresholdDrop(id,e.latlng);
      };
      const outside = e => {
        if (!this.map.getContainer().contains(e.target)) finish({latlng:event.latlng});
      };
      document.addEventListener('mouseup',outside);
      this.map.on('mousemove',move); this.map.on('mouseup',finish);
    });
  }
}
