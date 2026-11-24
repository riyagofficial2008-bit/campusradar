import { CheckCircle2, Loader2, LogIn, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { submitStatusReport } from '../services/reportService';
import type {
  AuthStateInfo,
  BackendSyncStatus,
  Facility,
  StatusReport,
} from '../types/campus';
import { CATEGORY_META, FLOOR_OPTIONS } from '../utils/statusLogic';
import { CategoryIcon } from './CategoryIcon';

interface ReportStatusModalProps {
  initialFacility: Facility | null;
  facilities: Facility[];
  onClose: () => void;
  onSubmitted: (report: StatusReport) => void;
  syncStatus: BackendSyncStatus;
  authState: AuthStateInfo;
  onSignInGoogle: () => void;
}

export function ReportStatusModal({
  initialFacility,
  facilities,
  onClose,
  onSubmitted,
  syncStatus,
  authState,
  onSignInGoogle,
}: ReportStatusModalProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    initialFacility?.id ?? facilities[0]?.id ?? ''
  );

  const activeFacility =
    facilities.find((f) => f.id === selectedFacilityId) ?? initialFacility;

  const meta = activeFacility
    ? CATEGORY_META[activeFacility.category] ?? CATEGORY_META.other
    : CATEGORY_META.other;

  const [building, setBuilding] = useState<string>(
    activeFacility?.building ?? activeFacility?.code ?? activeFacility?.name ?? ''
  );
  const [floor, setFloor] = useState<string>(
    activeFacility?.floor ?? 'Not specified'
  );
  const [statusValue, setStatusValue] = useState<string>(
    meta.primaryOptions[0]?.value ?? ''
  );
  const [secondaryValue, setSecondaryValue] = useState<string>(
    meta.secondaryOptions?.[0] ?? ''
  );
  const [seatingValue, setSeatingValue] = useState<string>(
    meta.seatingOptions?.[0] ?? ''
  );
  const [freePointsCount, setFreePointsCount] = useState<string>('');
  const [totalPointsCount, setTotalPointsCount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!activeFacility) return;
    const nextMeta = CATEGORY_META[activeFacility.category] ?? CATEGORY_META.other;
    setBuilding(
      activeFacility.building ?? activeFacility.code ?? activeFacility.name ?? ''
    );
    setFloor(activeFacility.floor ?? 'Not specified');
    setStatusValue(nextMeta.primaryOptions[0]?.value ?? '');
    setSecondaryValue(nextMeta.secondaryOptions?.[0] ?? '');
    setSeatingValue(nextMeta.seatingOptions?.[0] ?? '');
    setFreePointsCount('');
    setTotalPointsCount('');
    setError(null);
    setNeedsAuth(false);
  }, [activeFacility?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFacility) {
      setError('Please select a campus location.');
      return;
    }
    if (!statusValue) {
      setError('Please select the current condition.');
      return;
    }

    let parsedFree: number | undefined;
    let parsedTotal: number | undefined;

    if (meta.supportsSocketCounts) {
      if (freePointsCount.trim() !== '') {
        const n = Number(freePointsCount);
        if (!Number.isInteger(n) || n < 0 || n > 200) {
          setError('Available sockets must be a whole number (0–200).');
          return;
        }
        parsedFree = n;
      }
      if (totalPointsCount.trim() !== '') {
        const t = Number(totalPointsCount);
        if (!Number.isInteger(t) || t < 1 || t > 200) {
          setError('Total sockets must be a whole number (1–200).');
          return;
        }
        parsedTotal = t;
      }
      if (
        parsedFree !== undefined &&
        parsedTotal !== undefined &&
        parsedFree > parsedTotal
      ) {
        setError('Available sockets cannot exceed total sockets.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setNeedsAuth(false);

    const res = await submitStatusReport({
      facilityId: activeFacility.id,
      facilityName: activeFacility.name,
      facilityCategory: activeFacility.category,
      campusId: activeFacility.campusId,
      building: building.trim() || undefined,
      floor: floor !== 'Not specified' ? floor : undefined,
      statusValue,
      secondaryValue: secondaryValue || undefined,
      seatingValue: seatingValue || undefined,
      freePointsCount: parsedFree,
      totalPointsCount: parsedTotal,
      note: note.trim() || undefined,
    });

    setSubmitting(false);

    if (res.error || !res.report) {
      setError(res.error ?? 'Could not submit status report.');
      setNeedsAuth(Boolean(res.authRequired));
      return;
    }

    setSuccess(true);
    onSubmitted(res.report);
    setTimeout(() => {
      onClose();
    }, 550);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="bg-[#0F172A] w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-700/80 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              {activeFacility && (
                <CategoryIcon
                  category={activeFacility.category}
                  className="w-3.5 h-3.5 text-blue-400"
                />
              )}
              <span>{meta.label}</span>
              <span aria-hidden="true">·</span>
              <span>Expires in {meta.expiryLabel}</span>
            </div>
            <h2
              id="report-modal-title"
              className="font-display font-bold text-base text-white truncate"
            >
              Report / Update Status
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reporting modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-5 space-y-4 overflow-y-auto custom-scrollbar"
        >
          {/* Step 1: Select Location, Building & Floor */}
          <div className="space-y-2.5">
            <div>
              <label
                htmlFor="report-location-select"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                1. Campus Facility
              </label>
              <select
                id="report-location-select"
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} ({CATEGORY_META[fac.category].shortLabel})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="report-building-input"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Building
                </label>
                <input
                  id="report-building-input"
                  type="text"
                  maxLength={80}
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="e.g., JECRC Cafeteria"
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0B1120] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="report-floor-select"
                  className="block text-[11px] font-medium text-slate-400 mb-1"
                >
                  Floor
                </label>
                <select
                  id="report-floor-select"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg border border-slate-700 bg-[#0B1120] text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  {FLOOR_OPTIONS.map((fl) => (
                    <option key={fl} value={fl}>
                      {fl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Appropriate Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              2. {meta.primaryQuestion}
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {meta.primaryOptions.map((opt) => {
                const selected = statusValue === opt.value;
                const dotColor =
                  opt.color === 'green'
                    ? 'bg-emerald-400'
                    : opt.color === 'yellow'
                      ? 'bg-amber-400'
                      : opt.color === 'red'
                        ? 'bg-rose-500'
                        : 'bg-slate-400';

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatusValue(opt.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-left text-sm font-medium flex items-center justify-between transition-colors ${
                      selected
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-slate-800 bg-[#0B1120] text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      <span>{opt.value}</span>
                    </span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {meta.secondaryOptions && meta.secondaryLabel && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {meta.secondaryLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {meta.secondaryOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSecondaryValue(opt)}
                    className={`px-2 py-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                      secondaryValue === opt
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-slate-800 bg-[#0B1120] text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta.seatingOptions && meta.seatingLabel && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {meta.seatingLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {meta.seatingOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setSeatingValue(opt)}
                    className={`px-2 py-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                      seatingValue === opt
                        ? 'border-violet-500 bg-violet-600/20 text-white'
                        : 'border-slate-800 bg-[#0B1120] text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meta.supportsSocketCounts && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="free-sockets-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Available sockets (optional)
                </label>
                <input
                  id="free-sockets-input"
                  type="number"
                  min={0}
                  max={200}
                  value={freePointsCount}
                  onChange={(e) => setFreePointsCount(e.target.value)}
                  placeholder="Unknown"
                  className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="total-sockets-input"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Total sockets (optional)
                </label>
                <input
                  id="total-sockets-input"
                  type="number"
                  min={1}
                  max={200}
                  value={totalPointsCount}
                  onChange={(e) => setTotalPointsCount(e.target.value)}
                  placeholder="Unknown"
                  className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 3: Optional Comment */}
          <div>
            <label
              htmlFor="report-note-input"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              3. Optional Comment
            </label>
            <textarea
              id="report-note-input"
              rows={2}
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Short helpful note (e.g., power sockets free near back wall)"
              className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-[#0B1120] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {syncStatus === 'connected' ? (
            <p className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 rounded-lg px-3 py-2">
              <strong>CLOUD SYNC CONNECTED:</strong> Publishes to shared Firestore immediately for all devices.
            </p>
          ) : syncStatus === 'connecting' ? (
            <p className="text-xs text-blue-300 bg-blue-950/50 border border-blue-800/60 rounded-lg px-3 py-2">
              <strong>CONNECTING TO CLOUD:</strong> Verifying connection to shared Firestore database...
            </p>
          ) : syncStatus === 'offline' ? (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
              <strong>OFFLINE:</strong> Reconnect to network to sync your report to Firestore.
            </p>
          ) : (
            <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-3 py-2">
              <strong>LOCAL DEMO MODE:</strong> Saved in this browser only — reports are not shared.
            </p>
          )}

          {syncStatus === 'connected' && !authState.uid && (needsAuth || authState.anonymousAuthDisabled) && (
            <div className="p-3 rounded-lg bg-blue-950/50 border border-blue-700/70 space-y-2">
              <p className="text-xs text-blue-200">
                Sign in with Google to verify your report (or enable Anonymous Auth in Firebase Console).
              </p>
              <button
                type="button"
                onClick={onSignInGoogle}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign in with Google</span>
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {success && (
            <p className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Report published! Synced across devices.</span>
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Submit Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
