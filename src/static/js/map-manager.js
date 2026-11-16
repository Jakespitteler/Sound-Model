/**
 * Manages the Leaflet map, tile status feedback, draggable markers, and placement clicks.
 */

import { HOME_COORDS } from './state.js';
import { ContourLayer } from './contour-layer.js';
import { $ } from './utils.js';

/** Leaflet map, imagery availability and separately draggable source/receiver markers. */
export class MapManager {
  /** @param {import("./state.js").ScenarioStore} store Scenario controller. */
  constructor(store) {
    this.store = store;
    this.markers = L.layerGroup();
    this.map = L.map('map', {
      minZoom: 3,
      maxZoom: 19,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      maxBoundsViscosity: 1,
    }).setView(HOME_COORDS, 14);
    this.markers.addTo(this.map);

    this.contourLayer = new ContourLayer(this.map);
    this.initTiles();
    this.bindMapEvents();
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
    tiles.on('loading', () => {
      tileErrors = 0;
    });
    tiles.on('tileerror', () => {
      tileErrors++;
      $('tile-status').hidden = false;
      $('tile-status').textContent =
        'Satellite imagery unavailable or incomplete. Check internet access. Coordinates and calculations still work.';
    });
    tiles.on('load', () => {
      if (!tileErrors) $('tile-status').hidden = true;
    });
    tiles.addTo(this.map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
  }

  /** Bind placement only: camera movement never triggers acoustic requests. */
  bindMapEvents() {
    this.map.on('click', (event) => {
      if (!this.store.mode) return;
      const lat = Math.max(-85, Math.min(85, event.latlng.lat));
      const lng = Math.max(-180, Math.min(180, event.latlng.lng));
      if (this.store.mode === 'source') {
        this.store.addSource($('place-type').value, lat, lng);
      } else {
        this.store.addReceiver(lat, lng);
      }
    });
  }

  /** Reflect the active placement mode without replacing forms or markers. */
  syncModeUI() {
    const mode = this.store.mode;
    $('mode-label').textContent =
      mode === 'source'
        ? 'Click the map to place a machine'
        : mode === 'receiver'
          ? 'Click the map to place a receiver'
          : 'Pan to explore · drag markers to move';
    $('cancel-mode').hidden = !mode;
    $('map').classList.toggle('place-mode', Boolean(mode));
  }

  /** Rebuild entity markers only after catalogue/source/receiver mutations. */
  renderMarkers() {
    this.markers.clearLayers();
    for (const collection of ['sources', 'receivers']) {
      this.store[collection].forEach((item, i) => {
        const isSource = collection === 'sources';
        const label = isSource ? `${i + 1}. ${this.store.typeFor(item).name}` : `Receiver ${i + 1}`;
        const icon = L.divIcon({
          className: '',
          html: `<div class="${isSource ? 'machine' : 'receiver'}-marker">${isSource ? i + 1 : 'R' + (i + 1)}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([item.lat, item.lng], {
          icon,
          draggable: true,
          title: label,
          alt: label,
        }).addTo(this.markers);

        const tooltip = document.createElement('span');
        tooltip.textContent = label;
        marker.bindTooltip(tooltip);

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
  }
}
