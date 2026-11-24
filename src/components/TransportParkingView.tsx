import {
  Bus,
  Car,
  Info,
  MapPin,
  Navigation,
  RefreshCw,
} from 'lucide-react';
import type {
  CommunityPost,
  ComputedFacilityStatus,
  Facility,
} from '../types/campus';
import { formatRelativeTime } from '../utils/statusLogic';

interface TransportParkingViewProps {
  facilities: Facility[];
  statusesByFacilityId: Map<string, ComputedFacilityStatus>;
  posts: CommunityPost[];
  onDirectionsToFacility: (facility: Facility) => void;
  onOpenReportModal: (facility?: Facility) => void;
  onOpenAddTransportPin: (cat: 'parking' | 'bus_stop') => void;
}

export function TransportParkingView({
  facilities,
  statusesByFacilityId,
  posts,
  onDirectionsToFacility,
  onOpenReportModal,
  onOpenAddTransportPin,
}: TransportParkingViewProps) {
  const parkingFacilities = facilities.filter((f) => f.category === 'parking');
  const transitStops = facilities.filter((f) => f.category === 'bus_stop');
  const transportNotices = posts.filter(
    (p) =>
      p.postType === 'announcement' ||
      p.title.toLowerCase().includes('bus') ||
      p.title.toLowerCase().includes('parking') ||
      p.title.toLowerCase().includes('transport')
  );

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Transport &amp; Parking
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Campus transit points, student-reported parking availability, transport announcements, and walking directions.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAddTransportPin('bus_stop')}
              className="h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-white whitespace-nowrap"
            >
              Add Bus Stop Pin
            </button>
            <button
              type="button"
              onClick={() => onOpenAddTransportPin('parking')}
              className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white whitespace-nowrap"
            >
              Add Parking Pin
            </button>
          </div>
        </div>

        {/* Honest Telemetry Disclaimer */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Verified Campus Transport Policy:</strong> Live GPS vehicle tracking is not connected for campus buses. Exact bus timings and route circulars are published only from official university transport notices; parking space availability below comes directly from live student reports.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Parking Locations & Student-Reported Availability */}
          <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" />
                <span>Parking Areas ({parkingFacilities.length})</span>
              </h2>
            </div>

            {parkingFacilities.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg space-y-2">
                <p>
                  No mapped parking zones found for this campus yet. Click &quot;Add Parking Pin&quot; to drop a verified gate/lot pin on Campus Map.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {parkingFacilities.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  return (
                    <div
                      key={fac.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {fac.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Status:{' '}
                          <span className="text-slate-200 font-medium">
                            {st?.primaryLabel ?? 'Unknown'}
                          </span>
                          {st?.latestReport && (
                            <span> · {formatRelativeTime(st.latestReport.createdAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenReportModal(fac)}
                          className="h-8 px-2.5 rounded bg-[#0F172A] border border-slate-700 text-xs text-slate-200 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Update</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDirectionsToFacility(fac)}
                          className="h-8 px-2.5 rounded bg-blue-600 text-xs font-medium text-white flex items-center gap-1"
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
          </section>

          {/* Campus Bus & Transit Points */}
          <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <Bus className="w-4 h-4 text-violet-400" />
              <span>Bus &amp; Transit Stops ({transitStops.length})</span>
            </h2>

            {transitStops.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg space-y-2">
                <p>
                  No bus stops or pickup points mapped yet. Students can add verified campus gate / Vidhani bus stop pins on the map.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {transitStops.map((fac) => {
                  const st = statusesByFacilityId.get(fac.id);
                  return (
                    <div
                      key={fac.id}
                      className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {fac.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {st?.primaryLabel ?? 'No crowd reports yet'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenReportModal(fac)}
                          className="h-8 px-2.5 rounded bg-[#0F172A] border border-slate-700 text-xs text-slate-200"
                        >
                          Report Wait
                        </button>
                        <button
                          type="button"
                          onClick={() => onDirectionsToFacility(fac)}
                          className="h-8 px-2.5 rounded bg-blue-600 text-xs font-medium text-white flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>Directions</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Transport Announcements */}
        <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="font-display font-semibold text-base text-white">
            Transport Announcements &amp; Campus Bus Info
          </h2>
          <p className="text-xs text-slate-400">
            JECRC University campus location: Plot IS-2036 to 2039, Ramchandrapura Industrial Area, Vidhani, Sitapura Extension, Jaipur (303905). Check official JECRC Transport Desk circulars for semester route numbers and timings.
          </p>
          {transportNotices.length === 0 ? (
            <p className="text-xs text-slate-400 pt-1">
              No recent transport announcements posted in Community yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-800 pt-2">
              {transportNotices.slice(0, 5).map((n) => (
                <div key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="text-sm font-medium text-white">{n.title}</div>
                  <p className="text-xs text-slate-300 mt-0.5">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
