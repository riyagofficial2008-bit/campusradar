import type { CampusPlace, LocationScope } from '../types/campus';

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `${mins} min walk`;
  }
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m walk`;
}

/**
 * Ray-casting point-in-polygon check for [lat, lon] pairs.
 */
export function isPointInPolygon(
  lat: number,
  lon: number,
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > lon !== yj > lon &&
      lat < ((xj - xi) * (lon - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Honest classification of whether a facility is inside the selected campus,
 * nearby, or uncertain (when OSM has no boundary polygon for the campus).
 */
export function determineLocationScope(
  lat: number,
  lon: number,
  campus: CampusPlace | null
): LocationScope {
  if (!campus) return 'uncertain';

  if (campus.polygon && campus.polygon.length >= 3) {
    if (isPointInPolygon(lat, lon, campus.polygon)) {
      return 'inside_campus';
    }
    return 'nearby_campus';
  }

  if (campus.boundingBox && (campus.placeType === 'university' || campus.placeType === 'college' || campus.placeType === 'campus')) {
    const [south, north, west, east] = campus.boundingBox;
    const latSpan = Math.abs(north - south);
    const lonSpan = Math.abs(east - west);
    // Only trust bounding box as campus extent if it isn't a single point (< 0.0004 deg)
    if (latSpan > 0.0004 && lonSpan > 0.0004) {
      if (lat >= south && lat <= north && lon >= west && lon <= east) {
        return 'inside_campus';
      }
      return 'nearby_campus';
    }
  }

  const dist = haversineDistanceMeters(lat, lon, campus.lat, campus.lon);
  if (dist <= 450) {
    return 'uncertain';
  }
  return 'nearby_campus';
}

export function scopeLabelText(scope: LocationScope): string {
  switch (scope) {
    case 'inside_campus':
      return 'Inside campus';
    case 'nearby_campus':
      return 'Nearby campus';
    case 'uncertain':
      return 'Location uncertain';
  }
}
