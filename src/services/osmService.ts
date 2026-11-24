import type { CampusPlace, Facility, FacilityCategory } from '../types/campus';
import { determineLocationScope, haversineDistanceMeters } from '../utils/geo';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.data;
  }
  try {
    const raw = sessionStorage.getItem(`cr_osm_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheEntry<T>;
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function setCached<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { timestamp: Date.now(), data };
  memoryCache.set(key, entry);
  try {
    sessionStorage.setItem(`cr_osm_${key}`, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

interface NominatimItem {
  place_id: number;
  osm_type: 'node' | 'way' | 'relation';
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  boundingbox?: [string, string, string, string];
  geojson?: {
    type: string;
    coordinates: unknown;
  };
  address?: {
    university?: string;
    college?: string;
    city?: string;
    town?: string;
    village?: string;
    state_district?: string;
    state?: string;
  };
}

function extractPolygonFromGeojson(geojson?: NominatimItem['geojson']): [number, number][] | undefined {
  if (!geojson) return undefined;
  try {
    if (geojson.type === 'Polygon') {
      const rings = geojson.coordinates as [number, number][][];
      if (rings[0] && rings[0].length >= 3) {
        return rings[0].map(([lon, lat]) => [lat, lon]);
      }
    } else if (geojson.type === 'MultiPolygon') {
      const polys = geojson.coordinates as [number, number][][][];
      if (polys[0]?.[0] && polys[0][0].length >= 3) {
        return polys[0][0].map(([lon, lat]) => [lat, lon]);
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function classifyNominatimType(item: NominatimItem): CampusPlace['placeType'] {
  if (item.type === 'university' || item.class === 'amenity' && item.type === 'university') {
    return 'university';
  }
  if (item.type === 'college') return 'college';
  if (item.type === 'campus') return 'campus';
  if (item.type === 'state' || item.type === 'administrative' && item.display_name.split(',').length <= 3) {
    if (item.class === 'boundary' && !item.address?.city && !item.address?.town) {
      return 'state';
    }
  }
  if (item.class === 'place' || item.class === 'boundary') {
    return item.type === 'state' ? 'state' : 'city';
  }
  if (item.class === 'amenity' || item.class === 'building') {
    return 'campus';
  }
  return 'city';
}

function nominatimToCampusPlace(item: NominatimItem): CampusPlace {
  const parts = item.display_name.split(',').map((s) => s.trim());
  const name = parts[0] || item.display_name;
  const city = item.address?.city || item.address?.town || item.address?.state_district;
  const state = item.address?.state;
  const subtitleParts = [city, state].filter((p) => p && p !== name);
  const bbox: [number, number, number, number] | undefined = item.boundingbox
    ? [
        parseFloat(item.boundingbox[0]),
        parseFloat(item.boundingbox[1]),
        parseFloat(item.boundingbox[2]),
        parseFloat(item.boundingbox[3]),
      ]
    : undefined;

  return {
    id: `${item.osm_type}/${item.osm_id}`,
    osmId: item.osm_id,
    osmType: item.osm_type,
    name,
    subtitle: subtitleParts.join(', ') || parts.slice(1, 3).join(', ') || 'India',
    city,
    state,
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    boundingBox: bbox,
    polygon: extractPolygonFromGeojson(item.geojson),
    placeType: classifyNominatimType(item),
  };
}

const PHOTON_URL = 'https://photon.komoot.io/api/';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: 'N' | 'W' | 'R';
    osm_key?: string;
    osm_value?: string;
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
  };
}

async function fetchPhotonFallback(
  query: string,
  limit: number,
  signal?: AbortSignal
): Promise<NominatimItem[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(Math.min(limit * 2, 25)),
    lang: 'en',
    bbox: '68.1,6.5,97.4,35.7',
  });

  const res = await fetch(`${PHOTON_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new Error(`OpenStreetMap search failed (${res.status})`);
  }

  const json = (await res.json()) as { features?: PhotonFeature[] };
  const features = (json.features ?? []).filter(
    (f) =>
      f.properties.countrycode === 'IN' ||
      f.properties.country === 'India' ||
      !f.properties.countrycode
  );

  return features.slice(0, limit).map((f, idx) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const osmType: 'node' | 'way' | 'relation' =
      p.osm_type === 'W' ? 'way' : p.osm_type === 'R' ? 'relation' : 'node';
    const name = p.name || p.city || p.state || query;
    const displayParts = [name, p.city, p.state, p.country || 'India'].filter(Boolean);
    const ext = p.extent;
    const boundingbox: [string, string, string, string] | undefined = ext
      ? [String(ext[3]), String(ext[1]), String(ext[0]), String(ext[2])]
      : undefined;

    return {
      place_id: p.osm_id ?? idx + 1,
      osm_type: osmType,
      osm_id: p.osm_id ?? idx + 1,
      lat: String(lat),
      lon: String(lon),
      display_name: Array.from(new Set(displayParts)).join(', '),
      class: p.osm_key || 'place',
      type: p.osm_value || 'city',
      boundingbox,
      address: {
        city: p.city || p.district,
        state: p.state,
      },
    };
  });
}

async function fetchNominatim(query: string, limit = 10, signal?: AbortSignal): Promise<NominatimItem[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'in',
    limit: String(limit),
    polygon_geojson: '1',
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    if (res.ok) {
      const data = (await res.json()) as NominatimItem[];
      if (data.length > 0) return data;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    // Fall through to Photon OSM geocoder fallback
  }

  return fetchPhotonFallback(query, limit, signal);
}

let overpassQueue: Promise<unknown> = Promise.resolve();

function fetchOverpass(query: string, signal?: AbortSignal): Promise<{ elements: OverpassElement[] }> {
  const runTask = async (): Promise<{ elements: OverpassElement[] }> => {
    let lastErr: unknown;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 16000);
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          lastErr = new Error(`Overpass returned ${res.status}`);
          continue;
        }

        const json = (await res.json()) as { elements?: OverpassElement[] };
        return { elements: json.elements ?? [] };
      } catch (err) {
        if (signal?.aborted) throw err;
        lastErr = err;
      }
    }

    throw lastErr instanceof Error
      ? lastErr
      : new Error('Unable to reach OpenStreetMap Overpass servers');
  };

  const next = overpassQueue.then(runTask, runTask);
  overpassQueue = next.catch(() => undefined);
  return next;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

/**
 * Searches universities, colleges, campuses, cities, and states across India using real OSM data.
 * Supports natural queries like "Colleges in Kota" or "Universities in Bangalore".
 */
export async function searchIndiaCampuses(
  rawQuery: string,
  signal?: AbortSignal
): Promise<CampusPlace[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const cacheKey = `search_${q.toLowerCase()}`;
  const cached = getCached<CampusPlace[]>(cacheKey);
  if (cached) return cached;

  // Detect pattern: "colleges in kota", "universities in bangalore", "campuses near jaipur"
  const inMatch = q.match(/^(?:universities|university|colleges|college|campuses|campus)\s+(?:in|near|at)\s+(.+)$/i);
  if (inMatch) {
    const placeName = inMatch[1].trim();
    const placeResults = await fetchNominatim(placeName, 3, signal);
    const results: CampusPlace[] = [];

    if (placeResults.length > 0) {
      const target = nominatimToCampusPlace(placeResults[0]);
      // Query Overpass for real universities & colleges around this city/area
      const campuses = await fetchCampusesNearLocation(
        target.lat,
        target.lon,
        target.placeType === 'state' ? 40000 : 18000,
        signal
      );
      results.push(...campuses);
      if (campuses.length === 0) {
        results.push(target);
      }
    }

    if (results.length > 0) {
      setCached(cacheKey, results);
      return results;
    }
  }

  // Standard Nominatim search across India
  const items = await fetchNominatim(q, 12, signal);
  const mapped = items.map(nominatimToCampusPlace);

  // Prioritize exact/prefix name matches and campus types
  const normQ = q.toLowerCase();
  const sorted = mapped.sort((a, b) => {
    const matchRank = (p: CampusPlace) => {
      const n = p.name.toLowerCase();
      if (n === normQ) return 0;
      if (n.startsWith(normQ)) return 1;
      if (n.includes(normQ)) return 2;
      return 3;
    };
    const mDiff = matchRank(a) - matchRank(b);
    if (mDiff !== 0) return mDiff;

    const typeScore = (p: CampusPlace) =>
      p.placeType === 'university' ? 0 : p.placeType === 'college' ? 1 : p.placeType === 'campus' ? 2 : 3;
    return typeScore(a) - typeScore(b);
  });

  setCached(cacheKey, sorted);
  return sorted;
}

/**
 * Fetches real universities & colleges mapped in OSM near a coordinate (e.g., Jaipur default).
 */
export async function fetchCampusesNearLocation(
  lat: number,
  lon: number,
  radiusMeters = 15000,
  signal?: AbortSignal
): Promise<CampusPlace[]> {
  const cacheKey = `campuses_${lat.toFixed(3)}_${lon.toFixed(3)}_${radiusMeters}`;
  const cached = getCached<CampusPlace[]>(cacheKey);
  if (cached) return cached;

  const overpassQuery = `
    [out:json][timeout:14];
    (
      nwr["amenity"="university"](around:${radiusMeters},${lat},${lon});
      nwr["amenity"="college"](around:${radiusMeters},${lat},${lon});
    );
    out center geom 40;
  `;

  const { elements } = await fetchOverpass(overpassQuery, signal);

  const seenNames = new Set<string>();
  const campuses: CampusPlace[] = [];

  for (const el of elements) {
    const name = el.tags?.name || el.tags?.['name:en'] || el.tags?.short_name;
    if (!name) continue;
    const normName = name.toLowerCase().trim();
    if (seenNames.has(normName)) continue;
    seenNames.add(normName);

    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (typeof elLat !== 'number' || typeof elLon !== 'number') continue;

    let polygon: [number, number][] | undefined;
    if (el.geometry && el.geometry.length >= 3) {
      polygon = el.geometry.map((pt) => [pt.lat, pt.lon]);
    }

    const bbox: [number, number, number, number] | undefined = el.bounds
      ? [el.bounds.minlat, el.bounds.maxlat, el.bounds.minlon, el.bounds.maxlon]
      : undefined;

    const city = el.tags?.['addr:city'] || el.tags?.['addr:district'] || '';
    const state = el.tags?.['addr:state'] || '';

    campuses.push({
      id: `${el.type}/${el.id}`,
      osmId: el.id,
      osmType: el.type,
      name,
      subtitle: [city, state].filter(Boolean).join(', ') || (el.tags?.amenity === 'university' ? 'University Campus' : 'College Campus'),
      city,
      state,
      displayName: `${name}${city ? `, ${city}` : ''}`,
      lat: elLat,
      lon: elLon,
      boundingBox: bbox,
      polygon,
      placeType: el.tags?.amenity === 'university' ? 'university' : 'college',
    });
  }

  // Sort closest to center first
  campuses.sort(
    (a, b) =>
      haversineDistanceMeters(lat, lon, a.lat, a.lon) -
      haversineDistanceMeters(lat, lon, b.lat, b.lon)
  );

  setCached(cacheKey, campuses);
  return campuses;
}

/**
 * Enriches a selected campus with its OSM polygon geometry if Nominatim didn't return one.
 */
export async function enrichCampusPolygon(
  campus: CampusPlace,
  signal?: AbortSignal
): Promise<CampusPlace> {
  if (campus.polygon && campus.polygon.length >= 3) return campus;
  if (campus.placeType === 'city' || campus.placeType === 'state') return campus;

  const cacheKey = `poly_${campus.id}`;
  const cached = getCached<[number, number][]>(cacheKey);
  if (cached) return { ...campus, polygon: cached };

  try {
    if (campus.osmType === 'way' || campus.osmType === 'relation') {
      const q = `[out:json][timeout:10];${campus.osmType}(${campus.osmId});out geom;`;
      const { elements } = await fetchOverpass(q, signal);
      const el = elements[0];
      if (el?.geometry && el.geometry.length >= 3) {
        const poly = el.geometry.map((p) => [p.lat, p.lon] as [number, number]);
        setCached(cacheKey, poly);
        return { ...campus, polygon: poly };
      }
    }
  } catch {
    // non-fatal; keep existing campus bounds
  }
  return campus;
}

function mapOsmTagsToCategory(tags: Record<string, string>): FacilityCategory | null {
  const amenity = tags.amenity;
  const building = tags.building;
  const leisure = tags.leisure;
  const highway = tags.highway;
  const publicTransport = tags.public_transport;
  const manMade = tags.man_made;
  const shop = tags.shop;

  if (
    amenity === 'cafe' ||
    amenity === 'canteen' ||
    amenity === 'fast_food' ||
    amenity === 'restaurant' ||
    amenity === 'food_court'
  ) {
    return 'cafeteria';
  }
  if (amenity === 'library') return 'library';
  if (
    amenity === 'drinking_water' ||
    manMade === 'water_tap' ||
    (amenity === 'fountain' && tags.drinking_water !== 'no') ||
    tags.drinking_water === 'yes'
  ) {
    return 'water';
  }
  if (
    amenity === 'charging_station' ||
    Boolean(tags['socket:type2']) ||
    Boolean(tags['power_supply']) ||
    tags.charging === 'yes'
  ) {
    return 'charging';
  }
  if (amenity === 'toilets') return 'washroom';
  if (
    building === 'laboratory' ||
    amenity === 'research_institute' ||
    Boolean(tags.laboratory) ||
    tags.office === 'research'
  ) {
    return 'lab';
  }
  if (
    building === 'dormitory' ||
    amenity === 'student_accommodation' ||
    tags.residential === 'university' ||
    /hostel/i.test(tags.name || '')
  ) {
    return 'hostel';
  }
  if (
    building === 'university' ||
    building === 'college' ||
    building === 'school' ||
    amenity === 'lecture_hall'
  ) {
    return 'academic';
  }
  if (
    leisure === 'pitch' ||
    leisure === 'sports_centre' ||
    leisure === 'stadium' ||
    leisure === 'track' ||
    leisure === 'fitness_centre'
  ) {
    return 'sports';
  }
  if (amenity === 'parking' || amenity === 'bicycle_parking') return 'parking';
  if (amenity === 'clinic' || amenity === 'hospital' || amenity === 'pharmacy' || amenity === 'doctors') {
    return 'medical';
  }
  if (amenity === 'atm' || amenity === 'bank') return 'atm';
  if (highway === 'bus_stop' || publicTransport === 'platform') return 'bus_stop';
  if (shop) return 'shop';

  // Catch named campus buildings by name heuristics ONLY if explicitly tagged as building
  if (building && tags.name) {
    const lower = tags.name.toLowerCase();
    if (lower.includes('canteen') || lower.includes('cafeteria') || lower.includes('mess')) {
      return 'cafeteria';
    }
    if (lower.includes('library')) return 'library';
    if (lower.includes('lab')) return 'lab';
    if (lower.includes('hostel')) return 'hostel';
    return 'academic';
  }

  return null;
}

function defaultFacilityName(category: FacilityCategory, tags: Record<string, string>): string {
  if (tags.name) return tags.name;
  if (tags['name:en']) return tags['name:en'];
  if (tags.operator) return `${tags.operator} (${category.replace('_', ' ')})`;

  switch (category) {
    case 'water':
      return tags.amenity === 'fountain' ? 'Water Fountain' : 'Drinking Water Point';
    case 'washroom':
      return 'Public Washroom';
    case 'charging':
      return 'Charging Station';
    case 'cafeteria':
      return tags.amenity === 'cafe' ? 'Cafe' : 'Campus Canteen';
    case 'library':
      return 'Library';
    case 'parking':
      return tags.amenity === 'bicycle_parking' ? 'Cycle Parking' : 'Parking Area';
    case 'atm':
      return 'ATM';
    case 'bus_stop':
      return 'Bus Stop';
    case 'medical':
      return tags.amenity === 'pharmacy' ? 'Pharmacy' : 'Medical Center';
    case 'sports':
      return tags.sport ? `${tags.sport} Ground` : 'Sports Ground';
    default:
      return `${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}`;
  }
}

/**
 * Discovers real OpenStreetMap facilities inside & around the selected campus/location.
 * Never fabricates facilities that do not exist in OSM.
 */
export async function fetchFacilitiesAroundCampus(
  campus: CampusPlace,
  radiusMeters = 1400,
  signal?: AbortSignal
): Promise<Facility[]> {
  const cacheKey = `fac_${campus.id}_${campus.lat.toFixed(4)}_${campus.lon.toFixed(4)}_${radiusMeters}`;
  const cached = getCached<Facility[]>(cacheKey);
  if (cached) return cached;

  // Determine search radius: larger if campus has large bounding box
  let effectiveRadius = radiusMeters;
  if (campus.boundingBox && (campus.placeType === 'university' || campus.placeType === 'college')) {
    const [s, n, w, e] = campus.boundingBox;
    const diag = haversineDistanceMeters(s, w, n, e);
    effectiveRadius = Math.min(2800, Math.max(radiusMeters, Math.round(diag * 0.65)));
  }

  const { lat, lon } = campus;

  const query = `
    [out:json][timeout:15];
    (
      nwr["amenity"~"^(cafe|canteen|fast_food|restaurant|food_court|library|drinking_water|fountain|charging_station|toilets|research_institute|student_accommodation|parking|bicycle_parking|clinic|hospital|pharmacy|doctors|atm|bank|lecture_hall)$"](around:${effectiveRadius},${lat},${lon});
      nwr["man_made"="water_tap"](around:${effectiveRadius},${lat},${lon});
      nwr["building"~"^(university|college|laboratory|dormitory)$"](around:${effectiveRadius},${lat},${lon});
      nwr["leisure"~"^(pitch|sports_centre|stadium|track|fitness_centre)$"](around:${effectiveRadius},${lat},${lon});
      node["highway"="bus_stop"](around:${effectiveRadius},${lat},${lon});
      nwr["shop"](around:${Math.min(900, effectiveRadius)},${lat},${lon});
    );
    out center 180;
  `;

  const { elements } = await fetchOverpass(query, signal);

  const facilities: Facility[] = [];
  const seenIds = new Set<string>();

  for (const el of elements) {
    const tags = el.tags ?? {};
    // Skip the campus outer boundary itself if it matches
    if (el.id === campus.osmId && el.type === campus.osmType) continue;

    const category = mapOsmTagsToCategory(tags);
    if (!category) continue;

    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (typeof elLat !== 'number' || typeof elLon !== 'number') continue;

    const osmId = `${el.type}/${el.id}`;
    if (seenIds.has(osmId)) continue;
    seenIds.add(osmId);

    const scope = determineLocationScope(elLat, elLon, campus);
    const name = defaultFacilityName(category, tags);

    const addrParts = [tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean);

    facilities.push({
      id: `osm-${el.type}-${el.id}`,
      osmId,
      name,
      category,
      lat: elLat,
      lon: elLon,
      campusId: campus.id,
      campusName: campus.name,
      scope,
      address: addrParts.length > 0 ? addrParts.join(', ') : undefined,
      osmTags: tags,
      isStudentAdded: false,
      verified: true,
    });
  }

  // Sort inside campus first, then by distance from campus center
  facilities.sort((a, b) => {
    const scopeRank = (s: Facility['scope']) =>
      s === 'inside_campus' ? 0 : s === 'uncertain' ? 1 : 2;
    const rankDiff = scopeRank(a.scope) - scopeRank(b.scope);
    if (rankDiff !== 0) return rankDiff;
    return (
      haversineDistanceMeters(lat, lon, a.lat, a.lon) -
      haversineDistanceMeters(lat, lon, b.lat, b.lon)
    );
  });

  setCached(cacheKey, facilities);
  return facilities;
}

export const DEFAULT_JAIPUR_CENTER: CampusPlace = {
  id: 'relation/jaipur-default',
  osmId: 1942654,
  osmType: 'relation',
  name: 'Jaipur',
  subtitle: 'Rajasthan, India',
  city: 'Jaipur',
  state: 'Rajasthan',
  displayName: 'Jaipur, Rajasthan, India',
  lat: 26.9124,
  lon: 75.7873,
  placeType: 'city',
};
