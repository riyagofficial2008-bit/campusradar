import type { WalkingRoute } from '../types/campus';
import { haversineDistanceMeters } from '../utils/geo';

const OSRM_FOOT_BASE = 'https://router.project-osrm.org/route/v1/foot';

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    legs?: {
      steps?: {
        distance: number;
        name?: string;
        maneuver?: {
          type?: string;
          modifier?: string;
        };
      }[];
    }[];
  }[];
}

function formatManeuver(type?: string, modifier?: string, name?: string): string {
  const street = name ? ` onto ${name}` : '';
  if (type === 'depart') return `Start walking${street}`;
  if (type === 'arrive') return 'Arrive at destination';
  if (type === 'turn') return `Turn ${modifier || ''}${street}`.trim();
  if (type === 'continue') return `Continue${street}`;
  return `${type ? type.replace('_', ' ') : 'Walk'}${street}`;
}

/**
 * Fetches walking directions via OSRM public routing server.
 * Falls back honestly with straight-line distance and an explanation if OSRM fails.
 */
export async function fetchWalkingRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  signal?: AbortSignal
): Promise<WalkingRoute> {
  try {
    const url = `${OSRM_FOOT_BASE}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Routing service responded with ${res.status}`);
    }

    const data = (await res.json()) as OsrmResponse;
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error('No walking path returned by routing service');
    }

    const route = data.routes[0];
    const coords = route.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as [number, number]
    );
    const steps =
      route.legs?.[0]?.steps?.map((s) => ({
        instruction: formatManeuver(s.maneuver?.type, s.maneuver?.modifier, s.name),
        distanceMeters: s.distance,
      })) ?? [];

    return {
      coordinates: coords,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      steps,
      source: 'osrm',
    };
  } catch (err) {
    const straightMeters = haversineDistanceMeters(fromLat, fromLon, toLat, toLon);
    // Approximate walking speed 1.3 m/s
    const approxSeconds = Math.round(straightMeters / 1.3);
    return {
      coordinates: [
        [fromLat, fromLon],
        [toLat, toLon],
      ],
      distanceMeters: straightMeters,
      durationSeconds: approxSeconds,
      steps: [],
      source: 'fallback',
      fallbackReason:
        err instanceof Error
          ? `Live street routing unavailable (${err.message}). Showing straight-line distance.`
          : 'Live street routing unavailable. Showing straight-line distance.',
    };
  }
}
