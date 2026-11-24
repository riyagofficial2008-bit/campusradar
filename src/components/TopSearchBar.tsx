import {
  AlertCircle,
  Bell,
  Building2,
  Cloud,
  CloudOff,
  Compass,
  Database,
  Loader2,
  LogIn,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { JECRC_UNIVERSITY_CAMPUS } from '../data/jecrcSeedData';
import { searchIndiaCampuses } from '../services/osmService';
import type {
  AuthStateInfo,
  BackendSyncStatus,
  CampusPlace,
  Facility,
} from '../types/campus';
import { CATEGORY_META } from '../utils/statusLogic';

const QUICK_SEARCH_EXAMPLES = [
  'NYB',
  'KAB',
  'VIB',
  'NIB',
  'NBC',
  'Cafeteria',
  'Charging',
  'JECRC University',
  'MNIT Jaipur',
  'University of Rajasthan',
];

interface TopSearchBarProps {
  selectedCampus: CampusPlace;
  campusFacilities: Facility[];
  onSelectCampus: (place: CampusPlace) => void;
  onSelectFacility: (facility: Facility) => void;
  onRequestLocation: () => void;
  locationLoading: boolean;
  hasUserLocation: boolean;
  onOpenQuickReport: () => void;
  syncStatus: BackendSyncStatus;
  authState: AuthStateInfo;
  onSignInGoogle: () => void;
  onOpenBackendModal: () => void;
  unreadNotifications?: number;
  onOpenNotifications?: () => void;
}

export function TopSearchBar({
  selectedCampus,
  campusFacilities,
  onSelectCampus,
  onSelectFacility,
  onRequestLocation,
  locationLoading,
  hasUserLocation,
  onOpenQuickReport,
  syncStatus,
  authState,
  onSignInGoogle,
  onOpenBackendModal,
  unreadNotifications = 0,
  onOpenNotifications,
}: TopSearchBarProps) {
  const [query, setQuery] = useState('');
  const [campusResults, setCampusResults] = useState<CampusPlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const trimmedQ = query.trim().toLowerCase();
  const matchingFacilities = trimmedQ
    ? campusFacilities.filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(trimmedQ);
        const codeMatch = f.code?.toLowerCase().includes(trimmedQ);
        const buildingMatch = f.building?.toLowerCase().includes(trimmedQ);
        const descMatch = f.description?.toLowerCase().includes(trimmedQ);
        const catMatch = CATEGORY_META[f.category].label.toLowerCase().includes(trimmedQ);
        return Boolean(nameMatch || codeMatch || buildingMatch || descMatch || catMatch);
      })
    : [];

  const runRemoteSearch = async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setCampusResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const found = await searchIndiaCampuses(trimmed, controller.signal);
      if (!controller.signal.aborted) {
        const list = trimmed.toLowerCase().includes('jecrc')
          ? [
              JECRC_UNIVERSITY_CAMPUS,
              ...found.filter((p) => !p.name.toLowerCase().includes('jecrc university')),
            ]
          : found;
        setCampusResults(list);
        setLoading(false);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setLoading(false);
      setError(
        err instanceof Error
          ? err.message
          : 'University search failed. Check connection and retry.'
      );
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        runRemoteSearch(query);
      } else {
        setCampusResults([]);
        setError(null);
      }
    }, 360);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectFacilityResult = (fac: Facility) => {
    onSelectFacility(fac);
    setIsOpen(false);
    setQuery('');
  };

  const handleSelectCampusResult = (place: CampusPlace) => {
    onSelectCampus(place);
    setIsOpen(false);
    setQuery('');
  };

  const statusBtnClass =
    syncStatus === 'connected'
      ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/50'
      : syncStatus === 'connecting'
        ? 'bg-blue-950/70 border-blue-700/80 text-blue-300 hover:bg-blue-900/50'
        : syncStatus === 'offline'
          ? 'bg-rose-950/70 border-rose-700/80 text-rose-300 hover:bg-rose-900/50'
          : 'bg-amber-950/70 border-amber-700/80 text-amber-300 hover:bg-amber-900/50';

  const statusTextFull =
    syncStatus === 'connected'
      ? 'CLOUD SYNC CONNECTED'
      : syncStatus === 'connecting'
        ? 'CONNECTING TO CLOUD...'
        : syncStatus === 'offline'
          ? 'OFFLINE'
          : 'LOCAL DEMO MODE';

  const statusTextShort =
    syncStatus === 'connected'
      ? 'Cloud Sync'
      : syncStatus === 'connecting'
        ? 'Connecting'
        : syncStatus === 'offline'
          ? 'Offline'
          : 'Local Demo';

  return (
    <header className="relative z-40 h-14 bg-[#0B1120] border-b border-slate-800 px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
      {/* Zone 1: Brand wordmark */}
      <button
        type="button"
        onClick={() => onSelectCampus(JECRC_UNIVERSITY_CAMPUS)}
        className="flex items-center gap-2.5 shrink-0 text-left group"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white flex items-center justify-center shadow-sm">
          <Compass className="w-4.5 h-4.5" />
        </div>
        <div className="flex items-baseline gap-2 whitespace-nowrap shrink-0">
          <span className="font-display font-bold text-sm sm:text-base tracking-tight text-white group-hover:text-blue-300 transition-colors">
            CAMPUS RADAR
          </span>
          <span className="hidden xl:inline text-xs font-medium text-slate-400">
            JECRC University
          </span>
        </div>
      </button>

      {/* Zone 2: Search NYB, KAB, VIB, NIB, NBC, Facilities & Indian Campuses */}
      <div ref={containerRef} className="relative flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (matchingFacilities.length > 0 && matchingFacilities.length <= 3) {
                  handleSelectFacilityResult(matchingFacilities[0]);
                } else if (query.trim().length >= 2) {
                  runRemoteSearch(query);
                }
              } else if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
            placeholder="Search NYB, KAB, VIB, NIB, NBC, charging, water or universities..."
            aria-label="Search campus buildings, facilities, or universities"
            className="w-full h-9 pl-9 pr-8 bg-[#11192C] border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none focus:bg-[#152038] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCampusResults([]);
                setError(null);
              }}
              aria-label="Clear search"
              className="absolute right-2 p-1 text-slate-400 hover:text-slate-200 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search Dropdown */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-11 bg-[#0F172A] border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[72vh] flex flex-col z-50">
            {query.trim().length === 0 ? (
              <div className="p-3.5 space-y-2.5">
                <p className="text-xs font-medium text-slate-400">
                  Quick search ({selectedCampus.name} &amp; India campuses)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SEARCH_EXAMPLES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQuery(item);
                        setIsOpen(true);
                        if (item.length >= 2) runRemoteSearch(item);
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-blue-600/25 hover:text-blue-300 border border-slate-700 rounded-md transition-colors whitespace-nowrap"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar divide-y divide-slate-800">
                {matchingFacilities.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                      {selectedCampus.name} Locations ({matchingFacilities.length})
                    </div>
                    {matchingFacilities.map((fac) => (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => handleSelectFacilityResult(fac)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800/90 flex items-start gap-2.5 transition-colors"
                      >
                        <Building2 className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-100 truncate">
                            {fac.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {CATEGORY_META[fac.category].shortLabel}
                            {fac.building ? ` · ${fac.building}` : ''}
                            {fac.floor && fac.floor !== 'Not specified' ? ` · ${fac.floor}` : ''}
                            {fac.isApproximateLocation ? ' · Approximate location' : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-2">
                  <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Universities &amp; Places (OpenStreetMap)</span>
                    {loading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                  </div>

                  {error ? (
                    <div className="p-2.5 flex items-center justify-between gap-2 text-xs text-rose-300 bg-rose-950/40 rounded-lg border border-rose-800/60">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{error}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => runRemoteSearch(query)}
                        className="px-2.5 py-1 bg-slate-900 border border-rose-700 rounded text-rose-200 hover:bg-slate-800 shrink-0"
                      >
                        Retry
                      </button>
                    </div>
                  ) : campusResults.length === 0 && !loading ? (
                    <div className="px-2.5 py-2 text-xs text-slate-400">
                      {matchingFacilities.length > 0
                        ? 'No other universities matched this query.'
                        : `No campuses found for "${query}".`}
                    </div>
                  ) : (
                    campusResults.map((place) => (
                      <button
                        key={place.id}
                        type="button"
                        onClick={() => handleSelectCampusResult(place)}
                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800/90 flex items-start gap-2.5 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-100 truncate">
                            {place.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {place.placeType.charAt(0).toUpperCase() +
                              place.placeType.slice(1)}{' '}
                            · {place.subtitle}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Actions & Clear Sync Status */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRequestLocation}
          disabled={locationLoading}
          title="Locate Me (requests GPS only on click)"
          className={`h-9 px-2.5 sm:px-3 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
            hasUserLocation
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-[#11192C] border-slate-700 text-slate-200 hover:bg-slate-800'
          }`}
        >
          {locationLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:inline">
            {hasUserLocation ? 'Located' : 'Locate Me'}
          </span>
        </button>

        {syncStatus === 'connected' && !authState.uid && authState.anonymousAuthDisabled && (
          <button
            type="button"
            onClick={onSignInGoogle}
            title="Sign in with Google to submit shared reports"
            className="h-9 px-2.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Sign In</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenQuickReport}
          className="h-9 px-3 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">REPORT / UPDATE STATUS</span>
          <span className="sm:hidden">Report</span>
        </button>

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Open notifications"
            title="Notifications"
            className="relative h-9 w-9 rounded-lg bg-[#11192C] hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center shrink-0 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-[10px] font-bold text-white flex items-center justify-center tabular-nums">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenBackendModal}
          title={
            syncStatus === 'connected'
              ? 'CLOUD SYNC CONNECTED — Shared Firestore database verified'
              : syncStatus === 'connecting'
                ? 'Verifying connection to shared Firestore database...'
                : syncStatus === 'offline'
                  ? 'OFFLINE — Firestore unreachable, shared writes paused'
                  : 'LOCAL DEMO MODE — Backend Not Configured (reports are not shared)'
          }
          className={`h-9 px-2.5 rounded-lg text-[11px] font-bold tracking-wide border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${statusBtnClass}`}
        >
          {syncStatus === 'connected' ? (
            <Cloud className="w-3.5 h-3.5 shrink-0" />
          ) : syncStatus === 'connecting' ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          ) : syncStatus === 'offline' ? (
            <CloudOff className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Database className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="hidden lg:inline">{statusTextFull}</span>
          <span className="lg:hidden">{statusTextShort}</span>
        </button>
      </div>
    </header>
  );
}
