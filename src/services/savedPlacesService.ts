import type { CampusPlace, Facility, SavedPlaceItem } from '../types/campus';

const SAVED_PLACES_KEY = 'campus_radar_saved_places_v1';

export function loadSavedPlaces(): SavedPlaceItem[] {
  try {
    const raw = localStorage.getItem(SAVED_PLACES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPlaceItem[];
  } catch {
    return [];
  }
}

export function savePlacesList(items: SavedPlaceItem[]): void {
  try {
    localStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export function toggleSavedCampus(
  current: SavedPlaceItem[],
  campus: CampusPlace
): SavedPlaceItem[] {
  const exists = current.some((i) => i.id === campus.id);
  const next = exists
    ? current.filter((i) => i.id !== campus.id)
    : [
        {
          id: campus.id,
          kind: 'campus' as const,
          name: campus.name,
          subtitle: campus.subtitle,
          lat: campus.lat,
          lon: campus.lon,
          savedAt: new Date().toISOString(),
          campusData: campus,
        },
        ...current,
      ];
  savePlacesList(next);
  return next;
}

export function toggleSavedFacility(
  current: SavedPlaceItem[],
  facility: Facility
): SavedPlaceItem[] {
  const exists = current.some((i) => i.id === facility.id);
  const next = exists
    ? current.filter((i) => i.id !== facility.id)
    : [
        {
          id: facility.id,
          kind: 'facility' as const,
          name: facility.name,
          subtitle: facility.campusName || facility.address || 'Campus facility',
          category: facility.category,
          lat: facility.lat,
          lon: facility.lon,
          savedAt: new Date().toISOString(),
          facilityData: facility,
        },
        ...current,
      ];
  savePlacesList(next);
  return next;
}
