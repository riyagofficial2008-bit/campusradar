import { Loader2, LogIn, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { addStudentFacility } from '../services/reportService';
import type {
  AuthStateInfo,
  BackendSyncStatus,
  CampusPlace,
  Facility,
  FacilityCategory,
} from '../types/campus';
import { ALL_CATEGORIES, CATEGORY_META, FLOOR_OPTIONS } from '../utils/statusLogic';

interface AddFacilityModalProps {
  coords: { lat: number; lon: number };
  defaultCategory?: FacilityCategory;
  selectedCampus: CampusPlace | null;
  onClose: () => void;
  onCreated: (facility: Facility) => void;
  syncStatus: BackendSyncStatus;
  authState: AuthStateInfo;
  onSignInGoogle: () => void;
}

export function AddFacilityModal({
  coords,
  defaultCategory = 'water',
  selectedCampus,
  onClose,
  onCreated,
  syncStatus,
  authState,
  onSignInGoogle,
}: AddFacilityModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FacilityCategory>(defaultCategory);
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState<string>('Ground Floor');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError('Please enter a clear facility name (at least 2 characters).');
      return;
    }

    setSubmitting(true);
    setError(null);
    setNeedsAuth(false);

    const res = await addStudentFacility({
      name: name.trim(),
      category,
      lat: coords.lat,
      lon: coords.lon,
      campusId: selectedCampus?.id,
      campusName: selectedCampus?.name,
      building: building.trim() || undefined,
      floor: floor !== 'Not specified' ? floor : undefined,
      note: note.trim() || undefined,
    });

    setSubmitting(false);

    if (res.error || !res.facility) {
      setError(res.error ?? 'Could not add missing place.');
      setNeedsAuth(Boolean(res.authRequired));
      return;
    }

    onCreated(res.facility);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-facility-title"
    >
      <div className="bg-[#0F172A] w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-700 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2
              id="add-facility-title"
              className="font-display font-bold text-base text-white"
            >
              Add Missing Campus Place
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Pin: {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar">
          <div className="flex items-start gap-2 text-xs text-slate-300 bg-[#0B1120] border border-slate-800 rounded-lg px-3 py-2.5">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Student-added places are labeled{' '}
              <strong className="font-semibold text-amber-300">
                Approximate location
              </strong>{' '}
              until verified or repositioned.
            </span>
          </div>

          <div>
            <label
              htmlFor="new-fac-category"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Facility Category
            </label>
            <select
              id="new-fac-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FacilityCategory)}
              className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_META[cat].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="new-fac-name"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Facility Name
            </label>
            <input
              id="new-fac-name"
              type="text"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Water Cooler – In Cafeteria"
              className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="new-fac-building"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Building / Area
              </label>
              <input
                id="new-fac-building"
                type="text"
                maxLength={80}
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="e.g., Cafeteria, NYB, VIB"
                className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="new-fac-floor"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Floor
              </label>
              <select
                id="new-fac-floor"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-700 bg-[#0B1120] text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {FLOOR_OPTIONS.map((fl) => (
                  <option key={fl} value={fl}>
                    {fl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="new-fac-note"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Helpful note (optional)
            </label>
            <input
              id="new-fac-note"
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Near staircase entrance"
              className="w-full h-9 px-3 rounded-lg border border-slate-700 bg-[#0B1120] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {syncStatus === 'connected' ? (
            <p className="text-xs text-emerald-300 bg-emerald-950/50 border border-emerald-800/60 rounded-lg px-3 py-2">
              <strong>CLOUD SYNC CONNECTED:</strong> Shared across all students&apos; phones and laptops immediately.
            </p>
          ) : syncStatus === 'connecting' ? (
            <p className="text-xs text-blue-300 bg-blue-950/50 border border-blue-800/60 rounded-lg px-3 py-2">
              <strong>CONNECTING TO CLOUD:</strong> Verifying connection to shared Firestore database...
            </p>
          ) : syncStatus === 'offline' ? (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
              <strong>OFFLINE:</strong> Network connection required to publish new campus facilities.
            </p>
          ) : (
            <p className="text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 rounded-lg px-3 py-2">
              <strong>LOCAL DEMO MODE:</strong> Saved in this browser only — reports are not shared.
            </p>
          )}

          {syncStatus === 'connected' && !authState.uid && (needsAuth || authState.anonymousAuthDisabled) && (
            <div className="p-3 rounded-lg bg-blue-950/50 border border-blue-700/70 space-y-2">
              <p className="text-xs text-blue-200">
                Sign in with Google to verify your submission (or enable Anonymous Auth in Firebase Console).
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
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 rounded-lg hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Save Place</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
