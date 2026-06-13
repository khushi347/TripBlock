/**
 * Calculates the distance between two coordinates in meters using the Haversine formula.
 * @param {number[]} coord1 [longitude, latitude]
 * @param {number[]} coord2 [longitude, latitude]
 * @returns {number} Distance in meters
 */
const getDistance = (coord1, coord2) => {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((R * c).toFixed(2));
};

/**
 * Calculates the centroid of multiple coordinates.
 * @param {number[][]} coords Array of [longitude, latitude] arrays
 * @returns {number[]} Centroid [longitude, latitude]
 */
const getCentroid = (coords) => {
  if (!coords || coords.length === 0) return [0, 0];
  let totalLat = 0;
  let totalLon = 0;
  coords.forEach(([lon, lat]) => {
    totalLat += lat;
    totalLon += lon;
  });
  return [
    Number((totalLon / coords.length).toFixed(6)),
    Number((totalLat / coords.length).toFixed(6))
  ];
};

module.exports = {
  getDistance,
  getCentroid
};
