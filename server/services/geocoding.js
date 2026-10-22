const cache = new Map();
const pending = new Map();
let queue = Promise.resolve();
let lastRequestAt = 0;

function formatAddress(address, fallback) {
  if (!address) return fallback || '';
  const road = address.road || address.pedestrian || address.residential || address.footway || address.path;
  const street = [address.house_number, road].filter(Boolean).join(' ');
  const district = address.neighbourhood || address.suburb || address.quarter || address.city_district;
  const city = address.city || address.town || address.village || address.municipality;
  const parts = street ? [street, district, city] : [address.building || address.amenity || address.shop, district, city];
  return (parts.filter(Boolean).join(', ') || fallback || '').slice(0, 300);
}

module.exports = async function reverseGeocode(latitude, longitude, language = 'en') {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)},${language}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.address;
  if (pending.has(key)) return pending.get(key);

  const request = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastRequestAt));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequestAt = Date.now();

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', zoom: '18', lat: String(latitude), lon: String(longitude), 'accept-language': language === 'ar' ? 'ar,en' : 'en' }).toString();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': `BellaCrosta/1.0 (${process.env.APP_URL || 'http://localhost:4000'})`, 'Accept-Language': language === 'ar' ? 'ar,en' : 'en' }
      });
      if (!response.ok) throw new Error(`Reverse geocoding failed (${response.status}).`);
      const data = await response.json();
      const address = formatAddress(data.address, data.display_name);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      cache.set(key, { address, expires: Date.now() + 60 * 60 * 1000 });
      return address;
    } finally { clearTimeout(timeout); }
  });
  pending.set(key, request);
  queue = request.then(() => undefined, () => undefined);
  try { return await request; }
  finally { pending.delete(key); }
};
