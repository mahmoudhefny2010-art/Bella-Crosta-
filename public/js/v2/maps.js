let googleLoading;
function loadGoogle(key, language) {
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (googleLoading) return googleLoading;
  googleLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timer;
    const finish = error => {
      clearTimeout(timer);
      delete window.bellaGoogleMapsReady;
      if (error) { script.remove(); reject(error); }
      else resolve(window.google.maps);
    };
    window.bellaGoogleMapsReady = () => finish();
    script.async = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    const params = new URLSearchParams({ key, v: 'quarterly', loading: 'async', libraries: 'marker', language, region: 'EG', callback: 'bellaGoogleMapsReady' });
    script.src = 'https://maps.googleapis.com/maps/api/js?' + params;
    script.onerror = () => finish(new Error('Google Maps could not load. Using the backup map.'));
    timer = setTimeout(() => finish(new Error('Google Maps could not load. Using the backup map.')), 15000);
    document.head.append(script);
  }).catch(error => { googleLoading = null; throw error; });
  return googleLoading;
}
const point = value => Array.isArray(value) ? { lat: Number(value[0]), lng: Number(value[1]) } : { lat: typeof value.lat === 'function' ? value.lat() : value.lat, lng: typeof value.lng === 'function' ? value.lng() : value.lng };

export async function createDeliveryMap(container, initial, settings, language) {
  let warning;
  if (settings.googleMapsApiKey) {
    try {
      const google = await loadGoogle(settings.googleMapsApiKey, language);
      const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([google.importLibrary('maps'), google.importLibrary('marker')]);
      const native = new Map(container, {
        center: point(initial), zoom: 14, minZoom: 6,
        mapId: settings.googleMapsMapId || 'DEMO_MAP_ID',
        restriction: { latLngBounds: { south: 21.7, west: 24.5, north: 31.9, east: 37 }, strictBounds: true },
        streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
        gestureHandling: 'cooperative'
      });
      const markers = new Set();
      return {
        provider: 'google',
        on(name, fn) { native.addListener(name, event => fn({ latlng: point(event.latLng) })); },
        setView(value, zoom) { native.setCenter(point(value)); native.setZoom(zoom); },
        panTo(value) { native.panTo(point(value)); },
        invalidateSize() { google.event.trigger(native, 'resize'); },
        remove() {
          for (const marker of markers) { google.event.clearInstanceListeners(marker); marker.map = null; }
          google.event.clearInstanceListeners(native);
          container.replaceChildren();
        },
        addMarker(value, draggable = false, driver = false) {
          const pin = new PinElement({ background: driver ? '#ffc107' : '#b63e34', borderColor: '#ffffff', glyphColor: '#ffffff' });
          const marker = new AdvancedMarkerElement({ map: native, position: point(value), gmpDraggable: draggable, title: driver ? (language === 'ar' ? 'موقع المندوب' : 'Driver location') : (language === 'ar' ? 'موقع التوصيل' : 'Delivery location') });
          marker.append(pin);
          markers.add(marker);
          return {
            setLatLng(value) { marker.position = point(value); },
            getLatLng() { return point(marker.position); },
            on(name, fn) { marker.addListener(name, fn); }
          };
        }
      };
    } catch (error) { warning = error.message; container.replaceChildren(); }
  }
  const L = window.L;
  const native = L.map(container, { maxBounds: [[21.7, 24.5], [31.9, 37]], maxBoundsViscosity: 1, minZoom: 6 }).setView(initial, 14);
  native.attributionControl.setPrefix('<span lang="en">Egypt 🇪🇬</span>');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }).addTo(native);
  native.addMarker = (value, draggable = false, driver = false) => driver ? L.circleMarker(value, { color: '#ffc107', radius: 9 }).addTo(native) : L.marker(value, { draggable }).addTo(native);
  native.provider = 'openstreetmap';
  native.warning = warning;
  return native;
}
