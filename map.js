/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — service-area map

   Google Maps styled with a modified Snazzy Maps "Roads only"
   (style #7846), rebranded: highways in the site's amber,
   everything else pulled back so the road network and the
   100-mile service radius are what you actually read.

   Needs a Google Maps JavaScript API key. Without one — or if
   the key is rejected — the hand-drawn SVG map already in the
   page stays exactly as it is. The section is never broken by
   a missing or bad key.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const MILES_TO_M = 1609.344;

/* ── the style ────────────────────────────────────────────────
   Base is Snazzy Maps #7846 "Roads only": administrative,
   landscape and POI off, roads and water on, all labels off.
   Changed from the original:
     · highways    → amber #E9A13B with a darker casing
     · arterials   → muted navy-grey, so highways dominate
     · local roads → barely there
     · water       → brand navy instead of #12608d
   ═══════════════════════════════════════════════════════════ */
const STYLE = [
  /* --- unchanged from the original style --- */
  { featureType: 'administrative', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'all', stylers: [{ visibility: 'on' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'all', stylers: [{ visibility: 'on' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ visibility: 'off' }] },

  /* --- brand modifications --- */
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde4ee' }] },

  /* highways: the hero. Amber fill, darker casing so they read at
     any zoom without labels to help. */
  { featureType: 'road.highway', elementType: 'geometry.fill',
    stylers: [{ color: '#E9A13B' }, { weight: 2.2 }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke',
    stylers: [{ color: '#C7821F' }, { weight: 0.6 }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.fill',
    stylers: [{ color: '#E9A13B' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke',
    stylers: [{ color: '#C7821F' }] },

  /* everything else steps back */
  { featureType: 'road.arterial', elementType: 'geometry',
    stylers: [{ color: '#9FB0D0' }, { weight: 0.9 }] },
  { featureType: 'road.local', elementType: 'geometry',
    stylers: [{ color: '#C7D2E6' }, { weight: 0.5 }] },
  { featureType: 'transit', elementType: 'geometry',
    stylers: [{ color: '#C7D2E6' }, { visibility: 'simplified' }] }
];

/* SVG pin drawn in brand colours, no image asset needed */
const pinIcon = (fill, scale) => ({
  path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z',
  fillColor: fill, fillOpacity: 1,
  strokeColor: '#ffffff', strokeWeight: 2.5,
  scale, anchor: { x: 12, y: 36 }
});

let map = null, circle = null, markers = [], loaded = false;

function loadScript(key) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    /* Google calls this global when the library is ready */
    window.__sfMapReady = () => resolve();
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
            `&callback=__sfMapReady&loading=async`;
    s.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(s);
    /* a rejected key fires no callback and no error, so time out */
    setTimeout(() => { if (!window.google || !window.google.maps) reject(new Error('timed out')); }, 8000);
  });
}

const SFMap = {
  style: STYLE,
  ready: false,

  /* towns: [{name, lat, lng, hq, meta}]  onPick: (index) => void */
  async init(content, towns, onPick) {
    const cfg = (content && content.area && content.area.map) || {};
    const key = cfg.key || '';
    const host = document.getElementById('gmap');
    if (!host || !key || loaded) return false;

    const pts = (towns || []).filter(t => Number.isFinite(+t.lat) && Number.isFinite(+t.lng));
    if (!pts.length) return false;

    try { await loadScript(key); }
    catch (e) {
      /* leave the SVG in place — a broken key must not blank the section */
      console.warn('service-area map:', e.message, '— keeping the drawn map');
      return false;
    }
    loaded = true;

    const g = window.google.maps;
    const hq = pts.find(t => t.hq) || pts[0];
    const center = { lat: +(cfg.lat ?? hq.lat), lng: +(cfg.lng ?? hq.lng) };
    const radiusMiles = +(cfg.radiusMiles ?? 100);

    map = new g.Map(host, {
      center,
      zoom: cfg.zoom ?? 7,
      styles: STYLE,
      backgroundColor: '#F4F6F9',
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'cooperative',   // page scroll wins over map zoom
      keyboardShortcuts: true,
      clickableIcons: false
    });

    /* the service radius */
    circle = new g.Circle({
      map, center, radius: radiusMiles * MILES_TO_M,
      strokeColor: '#1E3160', strokeOpacity: 0.85, strokeWeight: 2,
      fillColor: '#1E3160', fillOpacity: 0.07,
      clickable: false
    });

    markers = pts.map((t, i) => {
      const m = new g.Marker({
        map,
        position: { lat: +t.lat, lng: +t.lng },
        title: t.name,
        icon: pinIcon(t.hq ? '#E9A13B' : '#1E3160', t.hq ? 1.15 : 0.9),
        zIndex: t.hq ? 10 : 1
      });
      m.addListener('click', () => { if (onPick) onPick(i); });
      return m;
    });

    /* frame the circle rather than trusting a fixed zoom */
    if (circle.getBounds()) map.fitBounds(circle.getBounds(), 24);

    /* swap the drawn map out only once the real one is up */
    const svg = host.parentElement.querySelector('svg');
    if (svg) svg.style.display = 'none';
    host.hidden = false;
    const legend = document.getElementById('mapLegend');
    if (legend) {
      legend.textContent = `${radiusMiles}-mile service radius`;
      legend.hidden = false;
    }

    this.ready = true;
    return true;
  },

  /* called when a town is chosen elsewhere on the page */
  focus(i) {
    if (!map || !markers[i]) return;
    markers.forEach((m, n) => {
      const t = n === i;
      m.setIcon(pinIcon(t ? '#E9A13B' : '#1E3160', t ? 1.2 : 0.9));
      m.setZIndex(t ? 20 : 1);
    });
    map.panTo(markers[i].getPosition());
  }
};

window.SFMap = SFMap;
})();
