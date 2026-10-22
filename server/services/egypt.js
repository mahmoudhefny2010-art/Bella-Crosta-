// Natural Earth 1:10m country boundary; shared data with the map picker.
const geometry = require('../../public/assets/egypt-boundary.json');
module.exports = function inEgypt(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const inside = ring => {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [px, py] = ring[j];
      if ((y > latitude) !== (py > latitude) && longitude < (px - x) * (latitude - y) / (py - y) + x) hit = !hit;
    }
    return hit;
  };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(rings => inside(rings[0]) && !rings.slice(1).some(inside));
};
