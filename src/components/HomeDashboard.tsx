import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Droplets,
  GraduationCap,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type {
  CampusEvent,
  CampusPlace,
  CampusPoll,
  CommunityPost,
  ComputedFacilityStatus,
  DashboardWidgetId,
  DayOfWeek,
  Facility,
  NavSection,
  PublicStudentProfile,
  StatusReport,
  TimetableSlot,
} from '../types/campus';
import { CATEGORY_META, formatRelativeTime } from '../utils/statusLogic';

const WIDGET_LABELS: { id: DashboardWidgetId; label: string }[] = [
  { id: 'today_events', label: "Today's Events" },
  { id: 'upcoming_classes', label: 'Upcoming Classes' },
  { id: 'live_updates', label: 'Recent Live Updates' },
  { id: 'charging_water', label: 'Charging & Water Stations' },
  { id: 'crowded_spots', label: 'Crowded Locations' },
  { id: 'nearby_facilities', label: 'Campus Facilities' },
  { id: 'community_discussions', label: 'Community Discussions' },
  { id: 'announcements_polls', label: 'Announcements & Polls' },
  { id: 'emergency_shortcuts', label: 'Emergency Contacts' },
];

interface HomeDashboardProps {
  selectedCampus: CampusPlace;
  profile: PublicStudentProfile | null;
  enabledWidgets: DashboardWidgetId[];
  onSaveWidgets: (next: DashboardWidgetId[]) => void;
  facilities: Facility[];
  statusesByFacilityId: Map<string, ComputedFacilityStatus>;
  reports: StatusReport[];
  events: CampusEvent[];
  timetable: TimetableSlot[];
  posts: CommunityPost[];
  polls: CampusPoll[];
  onNavigate: (section: NavSection) => void;
  onSelectFacilityOnMap: (facility: Facility) => void;
  onOpenReportModal: (facility?: Facility) => void;
  onOpenFeedback: () => void;
}

function getTodayDayKey(): DayOfWeek {
  const days: DayOfWeek[] = ['Mon', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const idx = new Date().getDay();
  return days[idx] ?? 'Mon';
}

export function HomeDashboard({
  selectedCampus,
  profile,
  enabledWidgets,
  onSaveWidgets,
  facilities,
  statusesByFacilityId,
  reports,
  events,
  timetable,
  posts,
  polls,
  onNavigate,
  onSelectFacilityOnMap,
  onOpenReportModal,
  onOpenFeedback,
}: HomeDashboardProps) {
  const [customizing, setCustomizing] = useState(false);
  const [quickFilter, setQuickFilter] = useState('');

  const hasWidget = (id: DashboardWidgetId) => enabledWidgets.includes(id);

  const toggleWidget = (id: DashboardWidgetId) => {
    const exists = enabledWidgets.includes(id);
    const next = exists
      ? enabledWidgets.filter((w) => w !== id)
      : [...enabledWidgets, id];
    onSaveWidgets(next.length > 0 ? next : ['live_updates']);
  };

  const todayKey = getTodayDayKey();
  const todaysClasses = timetable.filter((t) => t.dayOfWeek === todayKey);

  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todaysOrUpcomingEvents = events
    .filter((e) => e.startIso.slice(0, 10) >= todayDateStr)
    .slice(0, 4);

  const chargingFacilities = facilities.filter((f) => f.category === 'charging');
  const availableCharging = chargingFacilities.filter((f) => {
    const st = statusesByFacilityId.get(f.id);
    return (
      st?.freshness === 'live' &&
      (st.latestReport?.statusValue === 'Charging points available' ||
        st.latestReport?.statusValue === 'Few points available')
    );
  });

  const waterFacilities = facilities.filter((f) => f.category === 'water');
  const workingWater = waterFacilities.filter((f) => {
    const st = statusesByFacilityId.get(f.id);
    return st?.freshness === 'live' && st.latestReport?.statusValue === 'Working';
  });

  const crowdedFacilities = facilities.filter((f) => {
    const st = statusesByFacilityId.get(f.id);
    return st?.markerColor === 'red' || st?.primaryLabel.toLowerCase().includes('crowded');
  });

  const announcements = posts.filter((p) => p.postType === 'announcement').slice(0, 3);
  const recentDiscussions = posts.filter((p) => p.postType !== 'announcement').slice(0, 4);

  const matchedQuickFacilities = quickFilter.trim()
    ? facilities
        .filter((f) => {
          const q = quickFilter.trim().toLowerCase();
          return (
            f.name.toLowerCase().includes(q) ||
            f.code?.toLowerCase().includes(q) ||
            f.building?.toLowerCase().includes(q) ||
            CATEGORY_META[f.category].label.toLowerCase().includes(q)
          );
        })
        .slice(0, 6)
    : facilities.slice(0, 6);

  const greetingName = profile?.displayName ? `, ${profile.displayName}` : '';

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Welcome Hero & Quick Search */}
        <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-blue-400">
              {selectedCampus.name} · {selectedCampus.subtitle}
            </p>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">
              Welcome back{greetingName}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Live campus conditions, building navigation, student community, academics, and campus utilities in one place.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <div className="relative min-w-[230px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickFilter}
                onChange={(e) => setQuickFilter(e.target.value)}
                placeholder="Quick filter NYB, KAB, NBC, water..."
                aria-label="Quick campus facility filter"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => onNavigate('map')}
              className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Open Campus Map</span>
            </button>

            <button
              type="button"
              onClick={() => setCustomizing((v) => !v)}
              className={`h-10 px-3.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                customizing
                  ? 'bg-violet-600/20 border-violet-500/60 text-violet-200'
                  : 'bg-[#0F172A] border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize</span>
            </button>
          </div>
        </section>

        {/* Dashboard Widget Customizer */}
        {customizing && (
          <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display font-semibold text-sm text-white">
                  Customize Home Dashboard
                </h2>
                <p className="text-xs text-slate-400">
                  Choose which sections appear on your personalized home screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white"
              >
                Done
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {WIDGET_LABELS.map((w) => {
                const active = hasWidget(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWidget(w.id)}
                    className={`min-h-[40px] px-3 py-2 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                      active
                        ? 'bg-blue-600/15 border-blue-500/50 text-blue-200'
                        : 'bg-[#0F172A] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{w.label}</span>
                    <span className="font-mono text-[11px]">
                      {active ? 'Shown' : 'Hidden'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Top Metric Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigate('live')}
            className="bg-[#0B1120] hover:bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-left transition-colors"
          >
            <div className="text-xs text-slate-400">Live Status Reports</div>
            <div className="mt-1 font-display font-bold text-2xl text-white tabular-nums">
              {reports.length}
            </div>
            <div className="mt-1 text-xs text-blue-400">View real-time feed</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('map')}
            className="bg-[#0B1120] hover:bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-left transition-colors"
          >
            <div className="text-xs text-slate-400">Working Water Stations</div>
            <div className="mt-1 font-display font-bold text-2xl text-emerald-400 tabular-nums">
              {workingWater.length} / {waterFacilities.length}
            </div>
            <div className="mt-1 text-xs text-slate-400">Confirmed live</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('map')}
            className="bg-[#0B1120] hover:bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-left transition-colors"
          >
            <div className="text-xs text-slate-400">Available Charging</div>
            <div className="mt-1 font-display font-bold text-2xl text-amber-300 tabular-nums">
              {availableCharging.length} / {chargingFacilities.length}
            </div>
            <div className="mt-1 text-xs text-slate-400">Power spots</div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('events')}
            className="bg-[#0B1120] hover:bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-left transition-colors"
          >
            <div className="text-xs text-slate-400">Upcoming Events</div>
            <div className="mt-1 font-display font-bold text-2xl text-violet-300 tabular-nums">
              {todaysOrUpcomingEvents.length}
            </div>
            <div className="mt-1 text-xs text-slate-400">Workshops &amp; clubs</div>
          </button>
        </section>

        {/* Main Bento Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Recent Live Updates */}
          {hasWidget('live_updates') && (
            <section className="lg:col-span-7 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <h2 className="font-display font-semibold text-base text-white">
                    Recent Campus Updates
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenReportModal()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium whitespace-nowrap"
                  >
                    Report Status
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('live')}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>All updates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {reports.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                  No student reports submitted yet. Be the first to share live crowd, charging, or water status.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {reports.slice(0, 5).map((rep) => (
                    <div
                      key={rep.id}
                      className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {rep.facilityName}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          <span className="text-slate-200 font-medium">
                            {rep.statusValue}
                          </span>
                          {rep.building ? ` · ${rep.building}` : ''}
                          {rep.floor && rep.floor !== 'Not specified'
                            ? ` · ${rep.floor}`
                            : ''}
                          {' · '}
                          {rep.reporterLabel || 'Student'}
                        </div>
                        {rep.note && (
                          <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                            {rep.note}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-mono text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                        {formatRelativeTime(rep.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Upcoming Classes & Today's Events */}
          <div className="lg:col-span-5 space-y-4">
            {hasWidget('upcoming_classes') && (
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-violet-400" />
                    <h2 className="font-display font-semibold text-base text-white">
                      Today&apos;s Classes ({todayKey})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('academic')}
                    className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                  >
                    Manage schedule
                  </button>
                </div>
                {todaysClasses.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No personal classes added for {todayKey}. Add your own timetable in Academic Hub.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todaysClasses.slice(0, 4).map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-3 py-2 border-b border-slate-800/70 last:border-b-0 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">
                            {slot.subject}
                          </div>
                          <div className="text-slate-400 truncate">
                            {slot.building || 'Building not set'}
                            {slot.room ? ` · Room ${slot.room}` : ''}
                          </div>
                        </div>
                        <span className="font-mono text-blue-300 tabular-nums shrink-0">
                          {slot.startTime}–{slot.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {hasWidget('today_events') && (
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <h2 className="font-display font-semibold text-base text-white">
                      Upcoming Campus Events
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('events')}
                    className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                  >
                    Browse all
                  </button>
                </div>
                {todaysOrUpcomingEvents.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No upcoming events posted yet. Check Events &amp; Clubs to explore or publish.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {todaysOrUpcomingEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onNavigate('events')}
                        className="w-full text-left py-2 border-b border-slate-800/70 last:border-b-0 hover:text-blue-300 transition-colors"
                      >
                        <div className="text-sm font-medium text-white truncate">
                          {ev.title}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          {ev.organizerName} · {ev.locationName} · {ev.startIso.replace('T', ' ')}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Charging, Water & Crowded Snapshot */}
          {(hasWidget('charging_water') || hasWidget('crowded_spots')) && (
            <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="font-display font-semibold text-base text-white">
                Utilities &amp; Crowd Snapshot
              </h2>

              {hasWidget('charging_water') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg bg-[#0F172A] border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Charging Points ({chargingFacilities.length})</span>
                    </div>
                    {chargingFacilities.slice(0, 3).map((fac) => (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => onSelectFacilityOnMap(fac)}
                        className="w-full text-left text-xs text-slate-300 hover:text-white truncate block"
                      >
                        {fac.name} ·{' '}
                        <span className="text-slate-400">
                          {statusesByFacilityId.get(fac.id)?.primaryLabel ?? 'Unknown'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#0F172A] border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                      <Droplets className="w-3.5 h-3.5" />
                      <span>Water Stations ({waterFacilities.length})</span>
                    </div>
                    {waterFacilities.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No water stations mapped yet — add one on Campus Map.
                      </p>
                    ) : (
                      waterFacilities.slice(0, 3).map((fac) => (
                        <button
                          key={fac.id}
                          type="button"
                          onClick={() => onSelectFacilityOnMap(fac)}
                          className="w-full text-left text-xs text-slate-300 hover:text-white truncate block"
                        >
                          {fac.name} ·{' '}
                          <span className="text-slate-400">
                            {statusesByFacilityId.get(fac.id)?.primaryLabel ?? 'Unknown'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {hasWidget('crowded_spots') && (
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Crowded / Issue Flagged Locations</span>
                  </div>
                  {crowdedFacilities.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No locations currently flagged as crowded or unavailable.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {crowdedFacilities.slice(0, 5).map((fac) => (
                        <button
                          key={fac.id}
                          type="button"
                          onClick={() => onSelectFacilityOnMap(fac)}
                          className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 hover:bg-rose-900/50 transition-colors"
                        >
                          {fac.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Nearby / Campus Facilities Quick Jump */}
          {hasWidget('nearby_facilities') && (
            <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-semibold text-base text-white">
                  Campus Locations
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('map')}
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  Full map
                </button>
              </div>
              <div className="divide-y divide-slate-800/80">
                {matchedQuickFacilities.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => onSelectFacilityOnMap(fac)}
                      className="w-full py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-left hover:text-blue-300 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {fac.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {CATEGORY_META[fac.category].shortLabel}
                          {fac.building ? ` · ${fac.building}` : ''}
                          {fac.isApproximateLocation ? ' · Approximate location' : ''}
                        </div>
                      </div>
                      <span className="text-xs text-slate-300 shrink-0">
                        {st?.primaryLabel ?? 'Unknown'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Community Discussions */}
          {hasWidget('community_discussions') && (
            <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  <h2 className="font-display font-semibold text-base text-white">
                    New Community Discussions
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('community')}
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  Join community
                </button>
              </div>
              {recentDiscussions.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No student discussions yet. Ask a question or find project partners in Student Community.
                </p>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {recentDiscussions.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => onNavigate('community')}
                      className="w-full py-2.5 first:pt-0 last:pb-0 text-left hover:text-blue-300 transition-colors"
                    >
                      <div className="text-sm font-medium text-white truncate">
                        {post.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {post.postType.replace('_', ' ')} · {post.authorName} ·{' '}
                        {formatRelativeTime(post.createdAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Announcements & Polls */}
          {hasWidget('announcements_polls') && (
            <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <h2 className="font-display font-semibold text-base text-white">
                    Announcements &amp; Campus Polls
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onOpenFeedback}
                  className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
                >
                  Feedback &amp; Polls
                </button>
              </div>
              {announcements.length === 0 && polls.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No official announcements or active student polls yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg bg-[#0F172A] border border-slate-800"
                    >
                      <div className="text-sm font-medium text-white">{a.title}</div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2">{a.body}</p>
                    </div>
                  ))}
                  {polls.slice(0, 2).map((poll) => (
                    <button
                      key={poll.id}
                      type="button"
                      onClick={onOpenFeedback}
                      className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-800 text-left hover:border-blue-500/50 transition-colors"
                    >
                      <div className="text-xs font-semibold text-violet-300">
                        Student Poll · {poll.votedUids.length} votes
                      </div>
                      <div className="text-sm font-medium text-white mt-0.5">
                        {poll.question}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Emergency Shortcuts */}
        {hasWidget('emergency_shortcuts') && (
          <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display font-semibold text-sm text-white">
                  Safety &amp; Emergency Shortcuts
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  For immediate emergencies, dial national helplines directly. Submitting an in-app report does not automatically contact campus security.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="tel:112"
                className="h-9 px-3 rounded-lg bg-rose-950/60 border border-rose-800/70 text-xs font-semibold text-rose-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Emergency 112</span>
              </a>
              <a
                href="tel:108"
                className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ambulance 108</span>
              </a>
              <button
                type="button"
                onClick={() => onNavigate('safety')}
                className="h-9 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white whitespace-nowrap"
              >
                Safety &amp; Help Center
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
