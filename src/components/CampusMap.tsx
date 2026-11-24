import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type {
  CampusPlace,
  ComputedFacilityStatus,
  Facility,
  WalkingRoute,
} from '../types/campus';
import { CATEGORY_META } from '../utils/statusLogic';
import { getCategorySvgPath, getMarkerHex } from './CategoryIcon';

interface CampusMapProps {
  center: [number, number];
  zoom: number;
  selectedCampus: CampusPlace | null;
  nearbyCampuses: CampusPlace[];
  facilities: Facility[];
  statusesByFacilityId: Map<string, ComputedFacilityStatus>;
  selectedFacilityId: string | null;
  userLocation: { lat: number; lon: number } | null;
  activeRoute: WalkingRoute | null;
  isAddingPin: boolean;
  adjustingFacility: Facility | null;
  onSelectCampus: (campus: CampusPlace) => void;
  onSelectFacility: (facility: Facility) => void;
  onMapPinDrop: (lat: number, lon: number) => void;
  onMoveFacilityPin: (facilityId: string, lat: number, lon: number) => void;
  onCancelAdjustPin: () => void;
}

export function CampusMap({
  center,
  zoom,
  selectedCampus,
  nearbyCampuses,
  facilities,
  statusesByFacilityId,
  selectedFacilityId,
  userLocation,
  activeRoute,
  isAddingPin,
  adjustingFacility,
  onSelectCampus,
  onSelectFacility,
  onMapPinDrop,
  onMoveFacilityPin,
  onCancelAdjustPin,
}: CampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    polygon: L.LayerGroup;
    campuses: L.LayerGroup;
    facilities: L.LayerGroup;
    route: L.LayerGroup;
    user: L.LayerGroup;
  } | null>(null);

  const callbacksRef = useRef({
    onSelectCampus,
    onSelectFacility,
    onMapPinDrop,
    onMoveFacilityPin,
    isAddingPin,
    adjustingFacility,
  });
  callbacksRef.current = {
    onSelectCampus,
    onSelectFacility,
    onMapPinDrop,
    onMoveFacilityPin,
    isAddingPin,
    adjustingFacility,
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    layersRef.current = {
      polygon: L.layerGroup().addTo(map),
      campuses: L.layerGroup().addTo(map),
      facilities: L.layerGroup().addTo(map),
      route: L.layerGroup().addTo(map),
      user: L.layerGroup().addTo(map),
    };
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (callbacksRef.current.adjustingFacility) {
        callbacksRef.current.onMoveFacilityPin(
          callbacksRef.current.adjustingFacility.id,
          e.latlng.lat,
          e.latlng.lng
        );
      } else if (callbacksRef.current.isAddingPin) {
        callbacksRef.current.onMapPinDrop(e.latlng.lat, e.latlng.lng);
      }
    });

    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    el.style.cursor = isAddingPin || adjustingFacility ? 'crosshair' : '';
  }, [isAddingPin, adjustingFacility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCampus?.polygon && selectedCampus.polygon.length >= 3) {
      map.fitBounds(L.latLngBounds(selectedCampus.polygon), {
        padding: [40, 40],
        maxZoom: 17,
      });
    } else if (
      selectedCampus?.boundingBox &&
      selectedCampus.placeType !== 'city' &&
      selectedCampus.placeType !== 'state'
    ) {
      const [s, n, w, e] = selectedCampus.boundingBox;
      if (Math.abs(n - s) > 0.0005 && Math.abs(e - w) > 0.0005) {
        map.fitBounds(
          [
            [s, w],
            [n, e],
          ],
          { padding: [44, 44], maxZoom: 17 }
        );
        return;
      }
      map.setView(center, zoom, { animate: true });
    } else {
      map.setView(center, zoom, { animate: true });
    }
  }, [center[0], center[1], zoom, selectedCampus?.id]);

  // Campus boundary polygon
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.polygon.clearLayers();

    if (selectedCampus?.polygon && selectedCampus.polygon.length >= 3) {
      L.polygon(selectedCampus.polygon, {
        color: '#3B82F6',
        weight: 2,
        dashArray: '6 4',
        fillColor: '#6366F1',
        fillOpacity: 0.1,
      }).addTo(layers.polygon);
    }
  }, [selectedCampus]);

  // Nearby universities/colleges markers
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.campuses.clearLayers();

    for (const c of nearbyCampuses) {
      if (c.id === selectedCampus?.id) continue;
      const icon = L.divIcon({
        className: 'campus-radar-campus-pin',
        html: `<div style="display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:8px;background:#0F172A;color:#E2E8F0;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.45);font-size:11px;font-weight:700;white-space:nowrap;max-width:190px;overflow:hidden;">
          <span style="overflow:hidden;text-overflow:ellipsis;"></span>
        </div>`,
        iconSize: [150, 26],
        iconAnchor: [75, 13],
      });

      const marker = L.marker([c.lat, c.lon], { icon, zIndexOffset: 100 });
      marker.on('add', () => {
        const span = marker.getElement()?.querySelector('span');
        if (span) span.textContent = c.name;
      });
      marker.on('click', () => callbacksRef.current.onSelectCampus(c));
      marker.addTo(layers.campuses);
    }
  }, [nearbyCampuses, selectedCampus?.id]);

  // Facility pins (with category icon, status color, building code tag, and drag-to-adjust when editing)
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.facilities.clearLayers();

    for (const fac of facilities) {
      const computed = statusesByFacilityId.get(fac.id);
      const color = computed?.markerColor ?? 'grey';
      const hex = getMarkerHex(color);
      const isSelected = fac.id === selectedFacilityId;
      const isAdjusting = adjustingFacility?.id === fac.id;
      const svgInner = getCategorySvgPath(fac.category);
      const size = isSelected || isAdjusting ? 36 : 30;
      const codeBadge = fac.code
        ? `<div style="margin-top:2px;padding:1px 5px;border-radius:4px;background:#0B1120;border:1px solid ${isAdjusting ? '#A855F7' : '#334155'};color:#F8FAFC;font-size:10px;font-weight:700;letter-spacing:0.03em;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`
        : '';

      const icon = L.divIcon({
        className: 'campus-radar-marker',
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${hex.bg};border:2.5px solid ${isAdjusting ? '#C084FC' : isSelected ? '#60A5FA' : '#0F172A'};box-shadow:0 0 0 ${isSelected || isAdjusting ? '4px' : '2px'} ${hex.ring}, 0 4px 10px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;color:#FFFFFF;">
            <svg width="${isSelected ? 17 : 14}" height="${isSelected ? 17 : 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${svgInner}</svg>
          </div>
          ${codeBadge}
        </div>`,
        iconSize: [size, fac.code ? size + 18 : size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([fac.lat, fac.lon], {
        icon,
        draggable: isAdjusting,
        zIndexOffset: isAdjusting ? 1000 : isSelected ? 900 : color === 'grey' ? 250 : 550,
      });

      marker.on('add', () => {
        if (fac.code) {
          const el = marker.getElement();
          const divs = el?.querySelectorAll('div');
          const badge = divs?.[divs.length - 1];
          if (badge && badge !== divs?.[0]) {
            badge.textContent = fac.code;
          }
        }
      });

      if (isAdjusting) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          callbacksRef.current.onMoveFacilityPin(fac.id, pos.lat, pos.lng);
        });
      }

      // Safe DOM popup builder
      const popupRoot = document.createElement('div');
      popupRoot.className = 'p-3 space-y-1.5';

      const titleEl = document.createElement('div');
      titleEl.className = 'font-semibold text-sm text-white leading-snug';
      titleEl.textContent = fac.name;
      popupRoot.appendChild(titleEl);

      const metaEl = document.createElement('div');
      metaEl.className = 'text-xs text-slate-400';
      const parts = [
        CATEGORY_META[fac.category].shortLabel,
        fac.building,
        fac.floor && fac.floor !== 'Not specified' ? fac.floor : undefined,
        fac.isApproximateLocation ? 'Approximate location' : 'Verified',
      ].filter(Boolean);
      metaEl.textContent = parts.join(' · ');
      popupRoot.appendChild(metaEl);

      const statusEl = document.createElement('div');
      statusEl.className = 'text-xs font-medium text-slate-200 pt-1 border-t border-slate-800';
      statusEl.textContent = `${computed?.freshnessLabel ?? 'UNKNOWN'}: ${computed?.primaryLabel ?? 'Unknown'}`;
      popupRoot.appendChild(statusEl);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'mt-1.5 w-full px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors';
      btn.textContent = 'Open Details & Report';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacksRef.current.onSelectFacility(fac);
      });
      popupRoot.appendChild(btn);

      marker.bindPopup(popupRoot, { closeButton: true, offset: [0, -10] });
      marker.on('click', () => {
        if (!callbacksRef.current.adjustingFacility && !callbacksRef.current.isAddingPin) {
          callbacksRef.current.onSelectFacility(fac);
        }
      });

      marker.addTo(layers.facilities);
    }
  }, [facilities, statusesByFacilityId, selectedFacilityId, adjustingFacility?.id]);

  // User GPS location marker
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.user.clearLayers();

    if (userLocation) {
      L.circleMarker([userLocation.lat, userLocation.lon], {
        radius: 8,
        color: '#FFFFFF',
        weight: 3,
        fillColor: '#3B82F6',
        fillOpacity: 1,
      })
        .bindTooltip('Your location')
        .addTo(layers.user);

      L.circle([userLocation.lat, userLocation.lon], {
        radius: 55,
        color: '#3B82F6',
        weight: 1,
        fillColor: '#60A5FA',
        fillOpacity: 0.16,
      }).addTo(layers.user);
    }
  }, [userLocation]);

  // Walking route polyline
  useEffect(() => {
    const layers = layersRef.current;
    const map = mapRef.current;
    if (!layers || !map) return;
    layers.route.clearLayers();

    if (activeRoute && activeRoute.coordinates.length >= 2) {
      const poly = L.polyline(activeRoute.coordinates, {
        color: activeRoute.source === 'osrm' ? '#60A5FA' : '#A78BFA',
        weight: 4,
        dashArray: activeRoute.source === 'osrm' ? undefined : '6 6',
        opacity: 0.95,
      }).addTo(layers.route);

      map.fitBounds(poly.getBounds(), { padding: [52, 52], maxZoom: 18 });
    }
  }, [activeRoute]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Pin Add / Adjust Banner */}
      {(isAddingPin || adjustingFacility) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[450] bg-[#0F172A] border border-violet-500/70 text-white px-4 py-2 rounded-lg shadow-xl text-xs sm:text-sm font-medium flex items-center gap-3">
          <span>
            {adjustingFacility
              ? `Click on the map (or drag ${adjustingFacility.code || adjustingFacility.name}) to set exact position`
              : 'Click anywhere on the map to add the missing campus facility'}
          </span>
          {adjustingFacility && (
            <button
              type="button"
              onClick={onCancelAdjustPin}
              className="px-2 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Compact Status Legend */}
      <div className="hidden sm:flex items-center gap-3.5 bg-[#0B1120]/95 backdrop-blur-sm border border-slate-700/80 rounded-lg px-3 py-1.5 shadow-lg absolute bottom-5 left-3 z-[400] text-[11px] font-medium text-slate-200">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Available / Quiet</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Moderate / Limited</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Crowded / Issue</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          <span>Unknown / Stale</span>
        </span>
      </div>
    </div>
  );
}
