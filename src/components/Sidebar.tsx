import {
  AlertCircle,
  Bookmark,
  BookOpen,
  Building2,
  Coffee,
  Droplets,
  Filter,
  Home,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Search,
  Toilet,
  Trash2,
  Zap,
} from 'lucide-react';
import { submitStatusReport } from '../services/reportService';
import type {
  CampusPlace,
  ComputedFacilityStatus,
  Facility,
  FacilityCategory,
  LiveMapFilter,
  SavedPlaceItem,
  StatusReport,
  WorkspaceTab,
} from '../types/campus';
import { formatDistance, haversineDistanceMeters } from '../utils/geo';
import {
  ALL_CATEGORIES,
  CATEGORY_META,
  formatRelativeTime,
} from '../utils/statusLogic';
import { CategoryIcon } from './CategoryIcon';
import { FreshnessIndicator } from './FreshnessBadge';

const LIVE_FILTERS: { id: LiveMapFilter; label: string }[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'crowded', label: 'Crowded places' },
  { id: 'quiet', label: 'Quiet / open' },
  { id: 'available_charging', label: 'Available charging' },
  { id: 'working_water', label: 'Working water' },
  { id: 'available_study', label: 'Available study' },
  { id: 'problems', label: 'Issues reported' },
  { id: 'unknown', label: 'Unknown / stale' },
];

interface SidebarProps {
  selectedCampus: CampusPlace;
  allCampusFacilities: Facility[];
  filteredFacilities: Facility[];
  facilitiesLoading: boolean;
  facilitiesError: string | null;
  statusesByFacilityId: Map<string, ComputedFacilityStatus>;
  reports: StatusReport[];
  selectedFacilityId: string | null;
  userLocation: { lat: number; lon: number } | null;
  activeTab: WorkspaceTab;
  onChangeTab: (tab: WorkspaceTab) => void;
  campusSearchQuery: string;
  onCampusSearchChange: (q: string) => void;
  selectedCategory: FacilityCategory | 'all';
  onCategoryChange: (cat: FacilityCategory | 'all') => void;
  liveFilter: LiveMapFilter;
  onLiveFilterChange: (f: LiveMapFilter) => void;
  onlyAvailableCharging: boolean;
  onToggleOnlyAvailableCharging: () => void;
  onlyWorkingWater: boolean;
  onToggleOnlyWorkingWater: () => void;
  savedPlaces: SavedPlaceItem[];
  isCampusSaved: boolean;
  onToggleSaveCampus: () => void;
  onSelectFacility: (facility: Facility) => void;
  onRetryLoadFacilities: () => void;
  onStartAddPin: (defaultCategory?: FacilityCategory) => void;
  onOpenQuickReport: () => void;
  onDirectionsToFacility: (facility: Facility) => void;
  onRemoveSavedItem: (item: SavedPlaceItem) => void;
  onOpenSavedItem: (item: SavedPlaceItem) => void;
  onQuickReportSubmitted: (report: StatusReport) => void;
  onQuickReportError?: (error: string, authRequired?: boolean) => void;
}

export function Sidebar({
  selectedCampus,
  allCampusFacilities,
  filteredFacilities,
  facilitiesLoading,
  facilitiesError,
  statusesByFacilityId,
  reports,
  selectedFacilityId,
  userLocation,
  activeTab,
  onChangeTab,
  campusSearchQuery,
  onCampusSearchChange,
  selectedCategory,
  onCategoryChange,
  liveFilter,
  onLiveFilterChange,
  onlyAvailableCharging,
  onToggleOnlyAvailableCharging,
  onlyWorkingWater,
  onToggleOnlyWorkingWater,
  savedPlaces,
  isCampusSaved,
  onToggleSaveCampus,
  onSelectFacility,
  onRetryLoadFacilities,
  onStartAddPin,
  onOpenQuickReport,
  onDirectionsToFacility,
  onRemoveSavedItem,
  onOpenSavedItem,
  onQuickReportSubmitted,
  onQuickReportError,
}: SidebarProps) {
  const chargingFacilities = filteredFacilities.filter((f) => f.category === 'charging');
  const waterFacilities = filteredFacilities.filter((f) => f.category === 'water');

  // Dynamic dashboard slices (strictly computed from actual reports, zero fake data)
  const availableCharging = allCampusFacilities.filter((f) => {
    if (f.category !== 'charging') return false;
    const st = statusesByFacilityId.get(f.id);
    return (
      st?.freshness === 'live' &&
      (st.primaryLabel === 'Charging points available' ||
        st.primaryLabel === 'Few points available')
    );
  });

  const workingWater = allCampusFacilities.filter((f) => {
    if (f.category !== 'water') return false;
    const st = statusesByFacilityId.get(f.id);
    return st?.freshness === 'live' && st.primaryLabel === 'Working';
  });

  const crowdedPlaces = allCampusFacilities.filter((f) => {
    const st = statusesByFacilityId.get(f.id);
    if (!st || st.freshness !== 'live') return false;
    return (
      st.primaryLabel === 'Crowded' ||
      st.primaryLabel === 'Extremely crowded' ||
      st.primaryLabel === 'Full'
    );
  });

  const recentLiveFacilities = allCampusFacilities
    .filter((f) => {
      const st = statusesByFacilityId.get(f.id);
      return st && (st.freshness === 'live' || st.freshness === 'issue');
    })
    .sort((a, b) => {
      const ta = statusesByFacilityId.get(a.id)?.latestReport?.createdAt ?? '';
      const tb = statusesByFacilityId.get(b.id)?.latestReport?.createdAt ?? '';
      return tb.localeCompare(ta);
    });

  const handleQuickWaterReport = async (
    facility: Facility,
    statusValue: 'Working' | 'Water unavailable' | 'Not working' | 'Needs cleaning'
  ) => {
    const res = await submitStatusReport({
      facilityId: facility.id,
      facilityName: facility.name,
      facilityCategory: 'water',
      campusId: facility.campusId,
      building: facility.building,
      floor: facility.floor,
      statusValue,
    });
    if (res.report) {
      onQuickReportSubmitted(res.report);
    } else if (res.error && onQuickReportError) {
      onQuickReportError(res.error, res.authRequired);
    }
  };

  const quickJumpCategory = (cat: FacilityCategory) => {
    if (cat === 'charging') {
      onChangeTab('charging');
    } else if (cat === 'water') {
      onChangeTab('water');
    } else {
      onCategoryChange(cat);
      onLiveFilterChange('all');
      onChangeTab('facilities');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0B1120] border-r border-slate-800 overflow-hidden text-slate-100">
      {/* Campus Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
            Active Campus
          </div>
          <h1 className="font-display font-bold text-base text-white truncate">
            {selectedCampus.name}
          </h1>
          <p className="text-xs text-slate-400 truncate">{selectedCampus.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggleSaveCampus}
          title={isCampusSaved ? 'Remove campus from saved' : 'Save this campus'}
          className={`p-2 rounded-lg border transition-colors shrink-0 ${
            isCampusSaved
              ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
              : 'bg-[#11192C] border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="px-3 py-2 border-b border-slate-800 shrink-0">
        <div className="grid grid-cols-5 gap-1 p-1 bg-[#11192C] rounded-lg border border-slate-800">
          {(
            [
              { id: 'dashboard', label: 'Home', Icon: Home },
              { id: 'facilities', label: 'Explore', Icon: MapPin },
              { id: 'charging', label: 'Power', Icon: Zap },
              { id: 'water', label: 'Water', Icon: Droplets },
              { id: 'saved', label: 'Saved', Icon: Bookmark },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onChangeTab(id)}
              className={`py-1.5 px-1 rounded-md text-[11px] font-medium flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'dashboard' ? (
          <div className="p-3.5 space-y-5">
            {/* Quick Category Buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Quick Find
                </h2>
                <button
                  type="button"
                  onClick={() => onStartAddPin('water')}
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Missing Place</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { cat: 'academic', label: 'Buildings', Icon: Building2 },
                    { cat: 'cafeteria', label: 'Food', Icon: Coffee },
                    { cat: 'charging', label: 'Charging', Icon: Zap },
                    { cat: 'water', label: 'Water', Icon: Droplets },
                    { cat: 'library', label: 'Library', Icon: BookOpen },
                    { cat: 'washroom', label: 'Washrooms', Icon: Toilet },
                  ] as const
                ).map(({ cat, label, Icon }) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => quickJumpCategory(cat)}
                    className="p-2.5 rounded-lg bg-[#11192C] hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 flex flex-col items-start gap-1.5 transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium text-slate-200">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Report CTA */}
            <button
              type="button"
              onClick={onOpenQuickReport}
              className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>REPORT / UPDATE STATUS</span>
            </button>

            {/* Available Charging Points */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Available Charging Points
                </h3>
                <button
                  type="button"
                  onClick={() => onChangeTab('charging')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Open Finder
                </button>
              </div>
              {availableCharging.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#11192C] border border-slate-800 text-xs text-slate-400 space-y-1">
                  <p>No live available charging reports right now.</p>
                  <button
                    type="button"
                    onClick={() => onChangeTab('charging')}
                    className="text-blue-400 hover:underline font-medium"
                  >
                    Check Cafeteria Charging Points &amp; report availability →
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {availableCharging.map((fac) => (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => onSelectFacility(fac)}
                      className="w-full text-left p-2.5 rounded-lg bg-[#11192C] border border-slate-800 hover:border-emerald-500/40 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-white truncate">
                        {fac.name}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                        {statusesByFacilityId.get(fac.id)?.primaryLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Working Water Points */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Working Water Points
                </h3>
                <button
                  type="button"
                  onClick={() => onChangeTab('water')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Water Finder
                </button>
              </div>
              {workingWater.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#11192C] border border-slate-800 text-xs text-slate-400">
                  No verified working water reports yet. Add a water cooler pin or submit a report.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {workingWater.map((fac) => (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => onSelectFacility(fac)}
                      className="w-full text-left p-2.5 rounded-lg bg-[#11192C] border border-slate-800 hover:border-emerald-500/40 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-white truncate">
                        {fac.name}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                        Working
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Crowded Places */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Crowded Places
              </h3>
              {crowdedPlaces.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#11192C] border border-slate-800 text-xs text-slate-400">
                  No places currently reported crowded.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {crowdedPlaces.map((fac) => (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => onSelectFacility(fac)}
                      className="w-full text-left p-2.5 rounded-lg bg-[#11192C] border border-slate-800 hover:border-rose-500/40 flex items-center justify-between gap-2"
                    >
                      <span className="text-xs font-medium text-white truncate">
                        {fac.name}
                      </span>
                      <span className="text-[11px] font-semibold text-rose-400 shrink-0">
                        {statusesByFacilityId.get(fac.id)?.primaryLabel}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Recently Updated Live Reports */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Recently Updated Live Reports
              </h3>
              {recentLiveFacilities.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#11192C] border border-slate-800 text-xs text-slate-400">
                  No active student reports yet ({reports.length} historical). Click any pin or &ldquo;REPORT / UPDATE STATUS&rdquo; to share live campus status.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentLiveFacilities.slice(0, 5).map((fac) => {
                    const st = statusesByFacilityId.get(fac.id)!;
                    return (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => onSelectFacility(fac)}
                        className="w-full text-left p-2.5 rounded-lg bg-[#11192C] border border-slate-800 hover:border-slate-700 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {fac.name}
                          </span>
                          {st.latestReport && (
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {formatRelativeTime(st.latestReport.createdAt)}
                            </span>
                          )}
                        </div>
                        <FreshnessIndicator
                          freshness={st.freshness}
                          markerColor={st.markerColor}
                          label={st.primaryLabel}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Preloaded & Nearby Facilities */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Campus Locations ({allCampusFacilities.length})
                </h3>
                <button
                  type="button"
                  onClick={() => onChangeTab('facilities')}
                  className="text-xs text-blue-400 hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="space-y-1.5">
                {allCampusFacilities.slice(0, 7).map((fac) => (
                  <button
                    key={fac.id}
                    type="button"
                    onClick={() => onSelectFacility(fac)}
                    className="w-full text-left p-2.5 rounded-lg bg-[#11192C] border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <CategoryIcon
                        category={fac.category}
                        className="w-3.5 h-3.5 text-blue-400 shrink-0"
                      />
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {fac.name}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {statusesByFacilityId.get(fac.id)?.freshnessLabel ?? 'UNKNOWN'}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : activeTab === 'saved' ? (
          <div className="p-3.5 space-y-2">
            {savedPlaces.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <Bookmark className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-200">No saved places yet</p>
                <p className="text-xs text-slate-400">
                  Save buildings, cafeterias, charging points, or water stations for quick access.
                </p>
              </div>
            ) : (
              savedPlaces.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-slate-800 bg-[#11192C] hover:border-slate-700 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => onOpenSavedItem(item)}
                    className="text-left min-w-0 flex-1"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-0.5">
                      {item.category ? (
                        <CategoryIcon category={item.category} className="w-3 h-3 text-blue-400" />
                      ) : (
                        <Building2 className="w-3 h-3 text-blue-400" />
                      )}
                      <span>
                        {item.kind === 'campus'
                          ? 'Campus'
                          : CATEGORY_META[item.category ?? 'other'].shortLabel}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveSavedItem(item)}
                    aria-label={`Remove ${item.name}`}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'charging' ? (
          <div>
            <div className="p-3 border-b border-slate-800 space-y-2.5 bg-[#0F172A]/80">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-sm text-white">
                    Find Charging
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Socket counts shown only when reported by students
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartAddPin('charging')}
                  className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Point</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleOnlyAvailableCharging}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                  onlyAvailableCharging
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                    : 'bg-[#11192C] border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Only available charging points</span>
                </span>
                <span>{onlyAvailableCharging ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {chargingFacilities.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <Zap className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  {onlyAvailableCharging
                    ? 'No charging points are currently reported live as available.'
                    : 'No charging points found matching your filter.'}
                </p>
                <button
                  type="button"
                  onClick={() => onStartAddPin('charging')}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Charging Location</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {chargingFacilities.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  const dist = userLocation
                    ? haversineDistanceMeters(userLocation.lat, userLocation.lon, fac.lat, fac.lon)
                    : null;
                  return (
                    <div
                      key={fac.id}
                      className={`p-3.5 hover:bg-slate-800/50 transition-colors space-y-2 ${
                        selectedFacilityId === fac.id ? 'bg-blue-950/40' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectFacility(fac)}
                        className="w-full text-left space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {fac.name}
                          </span>
                          {dist !== null && (
                            <span className="text-xs font-mono text-slate-400 shrink-0">
                              {formatDistance(dist)}
                            </span>
                          )}
                        </div>
                        {fac.preloadedNote && (
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {fac.preloadedNote}
                          </p>
                        )}
                        {st && (
                          <div className="pt-1 flex items-center justify-between gap-2">
                            <FreshnessIndicator
                              freshness={st.freshness}
                              markerColor={st.markerColor}
                              label={st.primaryLabel}
                            />
                            {st.latestReport && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {formatRelativeTime(st.latestReport.createdAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectFacility(fac)}
                          className="flex-1 py-1.5 px-2.5 text-xs font-medium text-blue-300 bg-blue-950/60 border border-blue-800/60 hover:bg-blue-900/50 rounded-md"
                        >
                          Update Availability
                        </button>
                        <button
                          type="button"
                          onClick={() => onDirectionsToFacility(fac)}
                          className="py-1.5 px-2.5 text-xs font-medium text-slate-200 bg-[#11192C] border border-slate-700 hover:bg-slate-800 rounded-md flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Walk</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'water' ? (
          <div>
            <div className="p-3 border-b border-slate-800 space-y-2.5 bg-[#0F172A]/80">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-sm text-white">
                    Water Station Finder
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Add water points or report current status
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStartAddPin('water')}
                  className="px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Water Point</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onToggleOnlyWorkingWater}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-between transition-colors ${
                  onlyWorkingWater
                    ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300'
                    : 'bg-[#11192C] border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Only working water stations</span>
                </span>
                <span>{onlyWorkingWater ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {waterFacilities.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <Droplets className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  {onlyWorkingWater
                    ? 'No water stations currently reported as Working.'
                    : 'No drinking water points mapped here yet. Add a water cooler or tap pin on the campus map.'}
                </p>
                <button
                  type="button"
                  onClick={() => onStartAddPin('water')}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Water Station Pin</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {waterFacilities.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  const dist = userLocation
                    ? haversineDistanceMeters(userLocation.lat, userLocation.lon, fac.lat, fac.lon)
                    : null;
                  return (
                    <div
                      key={fac.id}
                      className={`p-3.5 hover:bg-slate-800/50 transition-colors space-y-2 ${
                        selectedFacilityId === fac.id ? 'bg-blue-950/40' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectFacility(fac)}
                        className="w-full text-left space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {fac.name}
                          </span>
                          {dist !== null && (
                            <span className="text-xs font-mono text-slate-400 shrink-0">
                              {formatDistance(dist)}
                            </span>
                          )}
                        </div>
                        {(fac.building || fac.floor) && (
                          <div className="text-[11px] text-slate-400 truncate">
                            {[fac.building, fac.floor].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        {st && (
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <FreshnessIndicator
                              freshness={st.freshness}
                              markerColor={st.markerColor}
                              label={st.primaryLabel}
                            />
                            {st.latestReport && (
                              <span className="text-[11px] font-mono text-slate-400">
                                {formatRelativeTime(st.latestReport.createdAt)}
                              </span>
                            )}
                          </div>
                        )}
                      </button>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickWaterReport(fac, 'Working')}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-emerald-700/70 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/50"
                        >
                          Working
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickWaterReport(fac, 'Water unavailable')}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-rose-700/70 bg-rose-950/50 text-rose-300 hover:bg-rose-900/50"
                        >
                          Empty
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickWaterReport(fac, 'Not working')}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-rose-700/70 bg-rose-950/50 text-rose-300 hover:bg-rose-900/50"
                        >
                          Broken
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickWaterReport(fac, 'Needs cleaning')}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-amber-700/70 bg-amber-950/50 text-amber-300 hover:bg-amber-900/50"
                        >
                          Needs cleaning
                        </button>
                        <button
                          type="button"
                          onClick={() => onDirectionsToFacility(fac)}
                          className="ml-auto px-2 py-1 text-[11px] font-medium rounded border border-slate-700 bg-[#11192C] text-slate-200 hover:bg-slate-800 flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Go</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* All Facilities Explore Tab */
          <div>
            <div className="p-3 border-b border-slate-800 space-y-2 bg-[#0F172A]/80">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={campusSearchQuery}
                  onChange={(e) => onCampusSearchChange(e.target.value)}
                  placeholder="Filter NYB, KAB, VIB, NIB, NBC..."
                  className="w-full h-8 pl-8 pr-3 bg-[#11192C] border border-slate-700 rounded-md text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  aria-label="Category filter"
                  value={selectedCategory}
                  onChange={(e) =>
                    onCategoryChange(e.target.value as FacilityCategory | 'all')
                  }
                  className="w-full h-8 px-2 bg-[#11192C] border border-slate-700 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All categories ({allCampusFacilities.length})</option>
                  {ALL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat].shortLabel}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Live status filter"
                  value={liveFilter}
                  onChange={(e) => onLiveFilterChange(e.target.value as LiveMapFilter)}
                  className="w-full h-8 px-2 bg-[#11192C] border border-slate-700 rounded-md text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {LIVE_FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {facilitiesLoading ? (
              <div className="p-3 space-y-2.5">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border border-slate-800 bg-[#11192C] animate-pulse space-y-2"
                  >
                    <div className="h-3 bg-slate-800 rounded w-1/3" />
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : facilitiesError ? (
              <div className="p-4 m-3 rounded-lg bg-rose-950/40 border border-rose-800 space-y-2.5">
                <div className="flex items-start gap-2 text-xs text-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{facilitiesError}</span>
                </div>
                <button
                  type="button"
                  onClick={onRetryLoadFacilities}
                  className="px-3 py-1.5 bg-slate-900 border border-rose-700 text-rose-200 text-xs font-medium rounded-md hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            ) : filteredFacilities.length === 0 ? (
              <div className="p-6 text-center space-y-2.5">
                <MapPin className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-200">
                  No matching facilities found
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onCategoryChange('all');
                    onLiveFilterChange('all');
                    onCampusSearchChange('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-blue-300 bg-blue-950/60 border border-blue-800/60 hover:bg-blue-900/50 rounded-md"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {filteredFacilities.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  const isSelected = fac.id === selectedFacilityId;
                  const dist = userLocation
                    ? haversineDistanceMeters(userLocation.lat, userLocation.lon, fac.lat, fac.lon)
                    : null;

                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => onSelectFacility(fac)}
                      className={`w-full text-left p-3.5 hover:bg-slate-800/50 transition-colors space-y-1.5 ${
                        isSelected ? 'bg-blue-950/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 truncate">
                          <CategoryIcon
                            category={fac.category}
                            className="w-3.5 h-3.5 text-blue-400 shrink-0"
                          />
                          <span>{CATEGORY_META[fac.category].shortLabel}</span>
                          {fac.isApproximateLocation && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-300/90">Approximate</span>
                            </>
                          )}
                        </span>
                        {dist !== null && (
                          <span className="font-mono text-[11px] shrink-0">
                            {formatDistance(dist)}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-white leading-snug">
                        {fac.name}
                      </div>

                      {st && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <FreshnessIndicator
                            freshness={st.freshness}
                            markerColor={st.markerColor}
                            label={
                              st.freshness === 'unknown'
                                ? 'UNKNOWN'
                                : `${st.freshnessLabel} · ${st.primaryLabel}`
                            }
                          />
                          {st.latestReport && (
                            <span className="text-[11px] font-mono text-slate-400 shrink-0">
                              {formatRelativeTime(st.latestReport.createdAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
