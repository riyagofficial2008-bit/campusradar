import {
  Activity,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  ThumbsUp,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  confirmStatusReport,
  getAnonymousReporterId,
} from '../services/reportService';
import type {
  ComputedFacilityStatus,
  Facility,
  FacilityCategory,
  StatusReport,
} from '../types/campus';
import {
  CATEGORY_META,
  FLOOR_OPTIONS,
  formatRelativeTime,
} from '../utils/statusLogic';

type LiveDomainFilter =
  | 'all'
  | 'crowd'
  | 'cafeteria'
  | 'library'
  | 'charging'
  | 'water'
  | 'washroom'
  | 'issues';

interface LiveUpdatesViewProps {
  facilities: Facility[];
  statusesByFacilityId: Map<string, ComputedFacilityStatus>;
  reports: StatusReport[];
  onOpenReportModal: (facility?: Facility) => void;
  onSelectFacilityOnMap: (facility: Facility) => void;
  onReportUpdated: (report: StatusReport) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

export function LiveUpdatesView({
  facilities,
  statusesByFacilityId,
  reports,
  onOpenReportModal,
  onSelectFacilityOnMap,
  onReportUpdated,
  onAuthRequired,
  onNotify,
}: LiveUpdatesViewProps) {
  const [domainFilter, setDomainFilter] = useState<LiveDomainFilter>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const myId = getAnonymousReporterId();
  const nowMs = Date.now();

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (floorFilter !== 'all') {
        if ((r.floor || 'Not specified') !== floorFilter) return false;
      }
      if (domainFilter === 'all') return true;
      if (domainFilter === 'crowd') {
        return (
          r.facilityCategory === 'cafeteria' ||
          r.facilityCategory === 'library' ||
          r.facilityCategory === 'academic' ||
          r.statusValue.toLowerCase().includes('crowd')
        );
      }
      if (domainFilter === 'issues') {
        const val = r.statusValue.toLowerCase();
        return (
          val.includes('not working') ||
          val.includes('unavailable') ||
          val.includes('cleaning') ||
          val.includes('closed') ||
          val.includes('broken')
        );
      }
      return r.facilityCategory === (domainFilter as FacilityCategory);
    });
  }, [reports, domainFilter, floorFilter]);

  const handleConfirm = async (rep: StatusReport) => {
    setConfirmingId(rep.id);
    const res = await confirmStatusReport(rep);
    setConfirmingId(null);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    if (res.updated) {
      onReportUpdated(res.updated);
      onNotify('Report confirmed in shared Cloud Firestore.');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Live Campus Status &amp; Reports
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time crowd, cafeteria queue, library seating, charging sockets, drinking water, and washroom condition synced across devices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenReportModal()}
            className="h-10 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Live Report</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0B1120] border border-slate-800 rounded-xl p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'All Updates'],
                ['crowd', 'Crowd Levels'],
                ['cafeteria', 'Cafeteria Queue'],
                ['library', 'Library Seating'],
                ['charging', 'Charging Points'],
                ['water', 'Drinking Water'],
                ['washroom', 'Washrooms'],
                ['issues', 'Complaints & Issues'],
              ] as [LiveDomainFilter, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDomainFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  domainFilter === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0F172A] text-slate-300 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="live-floor-filter" className="text-xs text-slate-400">
              Floor:
            </label>
            <select
              id="live-floor-filter"
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All floors</option>
              {FLOOR_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Facility Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {facilities.slice(0, 6).map((fac) => {
            const st = statusesByFacilityId.get(fac.id);
            const dotColor =
              st?.markerColor === 'green'
                ? 'text-emerald-400'
                : st?.markerColor === 'yellow'
                  ? 'text-amber-300'
                  : st?.markerColor === 'red'
                    ? 'text-rose-400'
                    : 'text-slate-400';

            return (
              <div
                key={fac.id}
                className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {fac.name}
                      </h3>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {CATEGORY_META[fac.category].shortLabel}
                        {fac.building ? ` · ${fac.building}` : ''}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${dotColor}`}>
                      {st?.freshnessLabel ?? 'UNKNOWN'}
                    </span>
                  </div>

                  <div className="mt-2.5 text-sm font-medium text-slate-100">
                    {st?.primaryLabel ?? 'No recent reports'}
                  </div>
                  {st?.secondaryLabel && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      {st.secondaryLabel}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => onSelectFacilityOnMap(fac)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>View on Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenReportModal(fac)}
                    className="px-2.5 py-1.5 rounded-md bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Update</span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Recent Report History Feed */}
        <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span>Recent Report History ({filteredReports.length})</span>
            </h2>
            <span className="text-xs text-slate-400">
              Confirmations verify observations without extending expiration
            </span>
          </div>

          {filteredReports.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
              No reports match the selected filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredReports.map((rep) => {
                const expiryMs =
                  (CATEGORY_META[rep.facilityCategory]?.expiryMinutes ?? 60) * 60 * 1000;
                const ageMs = nowMs - new Date(rep.createdAt).getTime();
                const isExpired = ageMs > expiryMs;
                const minsLeft = Math.max(0, Math.ceil((expiryMs - ageMs) / 60000));
                const confirmed = rep.confirmedBy.includes(myId);
                const targetFac = facilities.find((f) => f.id === rep.facilityId);

                return (
                  <div
                    key={rep.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-sm text-white">
                          {rep.facilityName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{CATEGORY_META[rep.facilityCategory]?.shortLabel}</span>
                        {rep.building && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{rep.building}</span>
                          </>
                        )}
                        {rep.floor && rep.floor !== 'Not specified' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{rep.floor}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-blue-300">
                          {rep.statusValue}
                        </span>
                        {rep.secondaryValue && (
                          <span className="text-slate-300">· {rep.secondaryValue}</span>
                        )}
                        {rep.seatingValue && (
                          <span className="text-slate-300">· {rep.seatingValue}</span>
                        )}
                        {typeof rep.freePointsCount === 'number' && (
                          <span className="text-amber-300 font-mono tabular-nums flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {rep.freePointsCount}
                            {typeof rep.totalPointsCount === 'number'
                              ? `/${rep.totalPointsCount}`
                              : ''}{' '}
                            free
                          </span>
                        )}
                      </div>

                      {rep.note && (
                        <p className="text-xs text-slate-300">{rep.note}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>By {rep.reporterLabel || 'Student'}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(rep.createdAt)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {isExpired ? 'Expired (Stale)' : `Active (${minsLeft}m left)`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={confirmed || confirmingId === rep.id}
                        onClick={() => handleConfirm(rep)}
                        className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                          confirmed
                            ? 'bg-emerald-950/50 border-emerald-700/70 text-emerald-300'
                            : 'bg-[#0F172A] border-slate-700 text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {confirmed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <ThumbsUp className="w-3.5 h-3.5" />
                        )}
                        <span className="tabular-nums">
                          {confirmed ? 'Confirmed' : 'Confirm'} ({rep.confirmations})
                        </span>
                      </button>

                      {targetFac && (
                        <button
                          type="button"
                          onClick={() => onOpenReportModal(targetFac)}
                          className="h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 whitespace-nowrap"
                        >
                          Correct
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
