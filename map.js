/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — service-area map

   MapLibre GL + OpenFreeMap vector tiles (OpenStreetMap data).
   No API key, no billing account, no usage caps to babysit —
   which is why this replaced the Google Maps version.

   The style is written here rather than borrowed: the same
   "roads only" idea as Snazzy Maps #7846, rebuilt against the
   OpenMapTiles schema so highways can carry the site's amber.

     motorway / trunk  → amber, with a darker casing
     primary/secondary → muted navy-grey
     everything else   → faint
     labels            → off, except town names we place ourselves

   If the tile host or the library is unreachable, the hand-drawn
   SVG map already in the page simply stays. The section is never
   left blank.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const LIB_JS  = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const LIB_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const TILES   = 'https://tiles.openfreemap.org/planet';

const AMBER = '#E9A13B', AMBER_DK = '#C7821F';
const NAVY = '#1E3160', NAVY_MID = '#9FB0D0', NAVY_FAINT = '#C7D2E6';
const WASH = '#F4F6F9', WATER = '#dde4ee';

/* road width grows with zoom; [zoom, px] stops */
const w = stops => ({ type: 'exponential', base: 1.6, stops });

function buildStyle() {
  return {
    version: 8,
    /* keep the OSM/OpenMapTiles attribution — it is a licence condition */
    sources: {
      ofm: { type: 'vector', url: TILES }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': WASH } },

      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water',
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': WATER } },

      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway',
        paint: { 'line-color': WATER, 'line-width': w([[8, 0.6], [14, 2]]) } },

      /* --- roads, quiet to loud --- */
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track'],
        minzoom: 11,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NAVY_FAINT, 'line-width': w([[11, 0.4], [16, 3]]) } },

      { id: 'road-secondary', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NAVY_FAINT, 'line-width': w([[7, 0.5], [14, 3.5]]) } },

      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['==', 'class', 'primary'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': NAVY_MID, 'line-width': w([[6, 0.7], [14, 5]]) } },

      /* --- the highways: the whole point of the map --- */
      { id: 'hwy-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': AMBER_DK, 'line-width': w([[5, 2.2], [10, 6], [14, 12]]) } },

      { id: 'hwy', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': AMBER, 'line-width': w([[5, 1.2], [10, 3.6], [14, 8]]) } }
    ]
  };
}

/* A circle of fixed ground radius, as a polygon. MapLibre's circle
   layer is sized in screen pixels, which is wrong here — the service
   area is 100 miles whatever the zoom. */
function circlePolygon(lat, lng, miles, points = 128) {
  const R = 3958.7613;                       // earth radius, miles
  const d = miles / R;
  const latR = lat * Math.PI / 180, lngR = lng * Math.PI / 180;
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const brg = (i / points) * 2 * Math.PI;
    const la = Math.asin(Math.sin(latR) * Math.cos(d) +
                         Math.cos(latR) * Math.sin(d) * Math.cos(brg));
    const lo = lngR + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(latR),
                                 Math.cos(d) - Math.sin(latR) * Math.sin(la));
    coords.push([lo * 180 / Math.PI, la * 180 / Math.PI]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

function loadOnce(url, tag) {
  return new Promise((resolve, reject) => {
    const sel = tag === 'script' ? `script[src="${url}"]` : `link[href="${url}"]`;
    if (document.querySelector(sel)) return resolve();
    const el = document.createElement(tag);
    if (tag === 'script') { el.src = url; el.async = true; }
    else { el.rel = 'stylesheet'; el.href = url; }
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(url + ' failed to load'));
    document.head.appendChild(el);
  });
}

let map = null, markers = null, booted = false;

const SFMap = {
  buildStyle, circlePolygon,
  ready: false,

  async init(content, towns, onPick) {
    const cfg = (content && content.area && content.area.map) || {};
    /* the CMS stores this field as text, so "false" is what actually
       arrives — comparing against the boolean alone made the off switch
       do nothing */
    const off = cfg.enabled === false || String(cfg.enabled).trim().toLowerCase() === 'false';
    if (off || booted) return false;

    const host = document.getElementById('gmap');
    if (!host) return false;

    /* Carry each town's original index: onPick and focus() are both called
       with positions in the UNFILTERED list, so dropping a town without
       coordinates would shift every marker after it onto the wrong name. */
    const pts = (towns || [])
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => Number.isFinite(+t.lat) && Number.isFinite(+t.lng));
    if (!pts.length) return false;

    try {
      await loadOnce(LIB_CSS, 'link');
      await loadOnce(LIB_JS, 'script');
      if (!window.maplibregl) throw new Error('maplibre did not initialise');
    } catch (e) {
      console.warn('service-area map:', e.message, '— keeping the drawn map');
      return false;
    }
    booted = true;

    const hq = (pts.find(({ t }) => t.hq) || pts[0]).t;   // first town is home base
    const center = [+(cfg.lng ?? hq.lng), +(cfg.lat ?? hq.lat)];
    const miles = +(cfg.radiusMiles ?? 100);

    try {
      map = new window.maplibregl.Map({
        container: host,
        style: buildStyle(),
        center,
        zoom: +(cfg.zoom ?? 6.4),
        attributionControl: { compact: true },
        cooperativeGestures: true,   // a scroll over the map still scrolls the page
        dragRotate: false,
        pitchWithRotate: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    } catch (e) {
      console.warn('service-area map failed to start:', e.message);
      return false;
    }

    await new Promise(res => map.on('load', res));

    /* service radius */
    map.addSource('radius', { type: 'geojson', data: circlePolygon(center[1], center[0], miles) });
    map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius',
      paint: { 'fill-color': NAVY, 'fill-opacity': 0.07 } });
    map.addLayer({ id: 'radius-line', type: 'line', source: 'radius',
      paint: { 'line-color': NAVY, 'line-width': 2, 'line-opacity': 0.85, 'line-dasharray': [3, 2] } });

    /* towns */
    markers = new Map();
    pts.forEach(({ t, i }) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-pin' + (t.hq ? ' hq' : '');
      el.setAttribute('aria-label', t.name);
      el.innerHTML = `<i></i><span>${String(t.name).replace(/[<>&]/g, '')}</span>`;
      el.addEventListener('click', () => { if (onPick) onPick(i); });
      markers.set(i, new window.maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([+t.lng, +t.lat]).addTo(map));
    });

    /* frame the whole service area */
    const ring = circlePolygon(center[1], center[0], miles).geometry.coordinates[0];
    const b = ring.reduce((bb, c) => bb.extend(c),
      new window.maplibregl.LngLatBounds(ring[0], ring[0]));
    map.fitBounds(b, { padding: 26, duration: 0 });

    const svg = host.parentElement.querySelector('svg');
    if (svg) svg.style.display = 'none';
    host.hidden = false;
    const legend = document.getElementById('mapLegend');
    if (legend) { legend.textContent = `${miles}-mile service radius`; legend.hidden = false; }

    map.resize();
    this.ready = true;
    return true;
  },

  focus(i) {
    const m = markers && markers.get(i);
    if (!map || !m) return;
    markers.forEach((mk, n) => mk.getElement().classList.toggle('on', n === i));
    map.flyTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 8), duration: 700 });
  }
};

window.SFMap = SFMap;
})();
