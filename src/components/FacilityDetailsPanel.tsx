import {
  Bookmark,
  Check,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Move,
  Navigation,
  RefreshCw,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  confirmStatusReport,
  getAnonymousReporterId,
} from '../services/reportService';
import type {
  ComputedFacilityStatus,
  Facility,
  StatusReport,
  WalkingRoute,
} from '../types/campus';
import { formatDistance, formatDuration, haversineDistanceMeters, scopeLabelText } from '../utils/geo';
import { CATEGORY_META, formatRelativeTime } from '../utils/statusLogic';
import { CategoryIcon } from './CategoryIcon';
import { FreshnessIndicator } from './FreshnessBadge';

interface FacilityDetailsPanelProps {
  facility: Facility;
  allCampusFacilities: Facility[];
  computedStatus: ComputedFacilityStatus;
  allReportsForFacility: StatusReport[];
  userLocation: { lat: number; lon: number } | null;
  isSaved: boolean;
  activeRoute: WalkingRoute | null;
  routeLoading: boolean;
  isAdjustingThisPin: boolean;
  onClose: () => void;
  onOpenReportModal: () => void;
  onToggleSave: () => void;
  onRequestDirections: (fromFacilityId?: string) => void;
  onClearRoute: () => void;
  onReportUpdated: (report: StatusReport) => void;
  onStartAdjustPin: () => void;
  onVerifyPinInPlace: () => void;
  onAuthRequired?: () => void;
}

export function FacilityDetailsPanel({
  facility,
  allCampusFacilities,
  computedStatus,
  allReportsForFacility,
  userLocation,
  isSaved,
  activeRoute,
  routeLoading,
  isAdjustingThisPin,
  onClose,
  onOpenReportModal,
  onToggleSave,
  onRequestDirections,
  onClearRoute,
  onReportUpdated,
  onStartAdjustPin,
  onVerifyPinInPlace,
  onAuthRequired,
}: FacilityDetailsPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [routeOriginId, setRouteOriginId] = useState<string>('auto');

  const meta = CATEGORY_META[facility.category] ?? CATEGORY_META.other;
  const myId = getAnonymousReporterId();

  const distanceFromUser = userLocation
    ? haversineDistanceMeters(
        userLocation.lat,
        userLocation.lon,
        facility.lat,
        facility.lon
      )
    : null;

  const latestActive = computedStatus.recentReports[0];
  const alreadyConfirmedLatest = latestActive
    ? latestActive.confirmedBy.includes(myId)
    : false;

  const handleConfirm = async () => {
    if (!latestActive) return;
    setConfirming(true);
    setConfirmMessage(null);
    const res = await confirmStatusReport(latestActive);
    setConfirming(false);

    if (res.error) {
      setConfirmMessage(res.error);
      if (res.authRequired && onAuthRequired) {
        onAuthRequired();
      }
      return;
    }
    if (res.updated) {
      onReportUpdated(res.updated);
      setConfirmMessage('Confirmed! (Confirmations do not extend report expiration.)');
    }
  };

  const osmDirectionsUrl = userLocation
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${userLocation.lat}%2C${userLocation.lon}%3B${facility.lat}%2C${facility.lon}`
    : `https://www.openstreetmap.org/?mlat=${facility.lat}&mlon=${facility.lon}#map=18/${facility.lat}/${facility.lon}`;

  return (
    <aside
      aria-label="Facility details"
      className="bg-[#0B1120] border-t md:border-t-0 md:border-l border-slate-800 flex flex-col h-full overflow-hidden text-slate-100"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-800 flex items-start justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <CategoryIcon category={facility.category} className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{scopeLabelText(facility.scope)}</span>
          </div>
          <h2 className="font-display font-bold text-base text-white leading-snug">
            {facility.name}
          </h2>
          {(facility.building || (facility.floor && facility.floor !== 'Not specified')) && (
            <p className="text-xs text-slate-300 mt-0.5">
              {[facility.building, facility.floor].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="text-xs mt-0.5 text-slate-400">
            {facility.isApproximateLocation ? (
              <span className="text-amber-300 font-medium">Approximate location</span>
            ) : (
              <span className="text-emerald-400 font-medium">Verified pin location</span>
            )}
            {facility.description ? ` · ${facility.description}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close facility details"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {/* Preloaded factual note if present (e.g. NBC behind VIB, Cafeteria Charging unknown sockets) */}
        {facility.preloadedNote && (
          <div className="p-3 rounded-lg bg-blue-950/35 border border-blue-800/50 text-xs text-blue-200 leading-relaxed">
            {facility.preloadedNote}
          </div>
        )}

        {/* Status & Freshness Card */}
        <div className="p-3.5 rounded-xl bg-[#11192C] border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <FreshnessIndicator
              freshness={computedStatus.freshness}
              markerColor={computedStatus.markerColor}
              label={computedStatus.freshnessLabel}
            />
            {computedStatus.latestReport && (
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeTime(computedStatus.latestReport.createdAt)}
              </span>
            )}
          </div>

          <div>
            <div className="text-base font-display font-bold text-white">
              {computedStatus.primaryLabel}
            </div>
            {computedStatus.secondaryLabel && (
              <div className="text-xs text-slate-300 mt-0.5">
                {computedStatus.secondaryLabel}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              {computedStatus.confidenceLabel} · {computedStatus.agreementSummary}
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              {computedStatus.recentCount} active
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Student-reported status (expires after {meta.expiryLabel}). Never fabricated or sensor-guessed.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onOpenReportModal}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>REPORT / UPDATE STATUS</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!latestActive || confirming || alreadyConfirmedLatest}
              title={
                latestActive
                  ? 'Confirm this report is still accurate'
                  : 'No active report to confirm'
              }
              className="py-2 px-2 rounded-lg border border-slate-700 bg-[#11192C] hover:bg-slate-800 disabled:opacity-45 text-xs font-medium text-slate-200 flex items-center justify-center gap-1 transition-colors"
            >
              {confirming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="w-3.5 h-3.5" />
              )}
              <span className="truncate">
                {alreadyConfirmedLatest
                  ? `Confirmed (${latestActive?.confirmations ?? 0})`
                  : `Confirm${latestActive ? ` (${latestActive.confirmations})` : ''}`}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenReportModal}
              className="py-2 px-2 rounded-lg border border-slate-700 bg-[#11192C] hover:bg-slate-800 text-xs font-medium text-slate-200 flex items-center justify-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Changed</span>
            </button>

            <button
              type="button"
              onClick={onToggleSave}
              className={`py-2 px-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                isSaved
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-[#11192C] border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isSaved ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          {confirmMessage && (
            <p className="text-xs text-slate-300 bg-slate-800/80 rounded-md px-3 py-1.5">
              {confirmMessage}
            </p>
          )}
        </div>

        {/* Walking Directions Section (Between Selected Locations or from GPS) */}
        <div className="p-3.5 rounded-xl bg-[#11192C] border border-slate-800 space-y-2.5">
          <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span>Walking Directions</span>
            {distanceFromUser !== null && (
              <span className="font-mono text-blue-400">
                {formatDistance(distanceFromUser)} from you
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Starting location for walking directions"
              value={routeOriginId}
              onChange={(e) => setRouteOriginId(e.target.value)}
              className="flex-1 h-8 px-2 rounded-md border border-slate-700 bg-[#0B1120] text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="auto">
                {userLocation ? 'From: My GPS Location' : 'From: Campus Center'}
              </option>
              {allCampusFacilities
                .filter((f) => f.id !== facility.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    From: {f.code || f.name}
                  </option>
                ))}
            </select>

            <button
              type="button"
              onClick={() =>
                onRequestDirections(routeOriginId === 'auto' ? undefined : routeOriginId)
              }
              disabled={routeLoading}
              className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              {routeLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Navigation className="w-3.5 h-3.5" />
              )}
              <span>Walk</span>
            </button>
          </div>

          {activeRoute && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-white tabular-nums">
                  {formatDistance(activeRoute.distanceMeters)} ·{' '}
                  {formatDuration(activeRoute.durationSeconds)}
                </span>
                <button
                  type="button"
                  onClick={onClearRoute}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Clear
                </button>
              </div>
              {activeRoute.fallbackReason && (
                <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded p-2">
                  {activeRoute.fallbackReason}
                </p>
              )}
              <a
                href={osmDirectionsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:underline"
              >
                <span>Open in OpenStreetMap</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Pin Verification & Repositioning */}
        <div className="p-3.5 rounded-xl bg-[#11192C] border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200">Pin Accuracy</span>
            <span className="font-mono text-slate-400">
              {facility.lat.toFixed(5)}, {facility.lon.toFixed(5)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartAdjustPin}
              className={`flex-1 py-1.5 px-2.5 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                isAdjustingThisPin
                  ? 'bg-violet-600 border-violet-500 text-white'
                  : 'bg-[#0B1120] border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Move className="w-3.5 h-3.5" />
              <span>{isAdjustingThisPin ? 'Click/Drag on Map...' : 'Adjust Pin'}</span>
            </button>
            {facility.isApproximateLocation && (
              <button
                type="button"
                onClick={onVerifyPinInPlace}
                className="py-1.5 px-2.5 rounded-md border border-emerald-700/70 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-medium"
              >
                Mark Verified
              </button>
            )}
          </div>
        </div>

        {/* Recent Status History */}
        <div className="space-y-2.5 border-t border-slate-800 pt-4">
          <h3 className="font-display font-semibold text-white text-sm">
            Recent Student Reports
          </h3>

          {allReportsForFacility.length === 0 ? (
            <div className="p-3.5 rounded-lg border border-dashed border-slate-800 text-center space-y-1.5">
              <MapPin className="w-4 h-4 text-slate-500 mx-auto" />
              <p className="text-xs text-slate-400">
                No student reports yet. Submit the first observation for this location.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {allReportsForFacility.slice(0, 8).map((rep) => {
                const ageMs = Date.now() - new Date(rep.createdAt).getTime();
                const isExpired = ageMs > meta.expiryMinutes * 60 * 1000;
                return (
                  <li
                    key={rep.id}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      isExpired
                        ? 'bg-[#0B1120]/60 border-slate-800/70 text-slate-500'
                        : 'bg-[#11192C] border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">
                        {rep.statusValue}
                        {typeof rep.freePointsCount === 'number'
                          ? ` (${rep.freePointsCount}${typeof rep.totalPointsCount === 'number' ? `/${rep.totalPointsCount}` : ''} free)`
                          : ''}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">
                        {formatRelativeTime(rep.createdAt)}
                        {isExpired ? ' · Expired' : ''}
                      </span>
                    </div>
                    {(rep.building || rep.floor || rep.secondaryValue || rep.seatingValue) && (
                      <div className="text-slate-400">
                        {[
                          rep.building,
                          rep.floor,
                          rep.secondaryValue,
                          rep.seatingValue,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    )}
                    {rep.note && (
                      <p className="text-slate-300 bg-[#0B1120] rounded px-2 py-1.5 mt-1">
                        &ldquo;{rep.note}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>{rep.reporterLabel || rep.reporterId.slice(0, 12)}</span>
                      <span>
                        {rep.confirmations} confirmation{rep.confirmations === 1 ? '' : 's'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
