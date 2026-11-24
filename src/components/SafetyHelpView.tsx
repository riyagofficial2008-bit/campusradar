import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  MapPin,
  Navigation,
  PhoneCall,
  Plus,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import {
  submitSafetyReport,
  updateSafetyReportStatus,
} from '../services/academicService';
import type { Facility, SafetyReport } from '../types/campus';
import { FLOOR_OPTIONS, formatRelativeTime } from '../utils/statusLogic';

interface SafetyHelpViewProps {
  isAdmin: boolean;
  facilities: Facility[];
  mySafetyReports: SafetyReport[];
  adminSafetyReports: SafetyReport[];
  onSelectFacilityOnMap: (facility: Facility) => void;
  onDirectionsToFacility: (facility: Facility) => void;
  onOpenAddMedicalPin: () => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

const EMERGENCY_NUMBERS = [
  {
    label: 'National Emergency Helpline',
    number: '112',
    desc: 'Police, Fire & Immediate Emergency Response (India)',
  },
  {
    label: 'Medical Ambulance',
    number: '108',
    desc: '24x7 Emergency Medical & Ambulance Service',
  },
  {
    label: 'Women Helpline',
    number: '1091',
    desc: '24x7 Women Safety & Assistance Helpline',
  },
];

export function SafetyHelpView({
  isAdmin,
  facilities,
  mySafetyReports,
  adminSafetyReports,
  onSelectFacilityOnMap,
  onDirectionsToFacility,
  onOpenAddMedicalPin,
  onAuthRequired,
  onNotify,
}: SafetyHelpViewProps) {
  const [reportType, setReportType] = useState<'unsafe_location' | 'maintenance'>(
    'unsafe_location'
  );
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState<string>('Not specified');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [locationNote, setLocationNote] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const medicalFacilities = facilities.filter((f) => f.category === 'medical');
  const visibleReports = isAdmin ? adminSafetyReports : mySafetyReports;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await submitSafetyReport({
      reportType,
      building,
      floor,
      locationNote,
      description,
      severity,
    });
    setSubmitting(false);

    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }

    setLocationNote('');
    setDescription('');
    setBuilding('');
    onNotify('Safety / maintenance report logged to shared campus queue.');
  };

  const handleStatusChange = async (
    reportId: string,
    nextStatus: SafetyReport['status']
  ) => {
    const res = await updateSafetyReportStatus(reportId, nextStatus);
    if (res.error) {
      onNotify(res.error);
      return;
    }
    onNotify(`Report marked as ${nextStatus}.`);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Campus Safety, Medical &amp; Help
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified national emergency helplines, campus medical pins, and unsafe-location or maintenance reporting.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAddMedicalPin}
            className="h-9 px-3.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-rose-400" />
            <span>Add Medical Room Pin</span>
          </button>
        </div>

        {/* Honest Dispatch Disclaimer */}
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>
            <strong>Important Safety Notice:</strong> Submitting an unsafe-location or maintenance report inside Campus Radar stores the ticket in the campus review database for administrators, and{' '}
            <strong>does not automatically contact or dispatch campus security, police, or medical teams</strong>. For any immediate threat or medical emergency, dial <strong>112</strong> or <strong>108</strong> directly or approach the nearest campus security gate.
          </span>
        </div>

        {/* Emergency Helplines */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {EMERGENCY_NUMBERS.map((item) => (
            <a
              key={item.number}
              href={`tel:${item.number}`}
              className="bg-[#0B1120] border border-slate-800 hover:border-rose-500/50 rounded-xl p-4 flex items-center justify-between gap-3 transition-colors group"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white group-hover:text-rose-200">
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {item.desc}
                </div>
              </div>
              <div className="h-10 px-3 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 font-mono font-bold text-sm flex items-center gap-1.5 shrink-0">
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{item.number}</span>
              </div>
            </a>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Report Form */}
          <section className="lg:col-span-5 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Report Unsafe Area or Maintenance Issue</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReportType('unsafe_location')}
                  className={`h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
                    reportType === 'unsafe_location'
                      ? 'bg-rose-600/20 border-rose-500 text-rose-200'
                      : 'bg-[#0F172A] border-slate-800 text-slate-300'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Unsafe Location</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('maintenance')}
                  className={`h-9 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 ${
                    reportType === 'maintenance'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-200'
                      : 'bg-[#0F172A] border-slate-800 text-slate-300'
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Maintenance</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Building (optional)
                  </label>
                  <input
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    placeholder="e.g., VIB, KAB, Hostel Gate"
                    className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Floor
                  </label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  >
                    {FLOOR_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Exact Spot / Landmark *
                </label>
                <input
                  type="text"
                  required
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  placeholder="e.g., Unlit pathway behind NIB, broken handrail on 2nd floor"
                  className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Urgency / Severity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSeverity(lvl)}
                      className={`h-8 rounded-lg border text-xs font-medium capitalize ${
                        severity === lvl
                          ? lvl === 'high'
                            ? 'bg-rose-600 text-white border-rose-500'
                            : lvl === 'medium'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[#0F172A] border-slate-800 text-slate-300'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Details *
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the hazard, broken light, electrical issue, or maintenance concern..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white"
              >
                {submitting ? 'Submitting...' : 'Submit Safety / Maintenance Report'}
              </button>
            </form>
          </section>

          {/* Right: Medical Facilities + Report Tracker */}
          <div className="lg:col-span-7 space-y-5">
            <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                  <span>Campus Medical &amp; First-Aid Locations ({medicalFacilities.length})</span>
                </h2>
              </div>

              {medicalFacilities.length === 0 ? (
                <div className="p-4 rounded-lg border border-dashed border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span>
                    No medical room pin has been added on this campus map yet. If you know where the campus medical center or first-aid desk is located, you can pin it for students.
                  </span>
                  <button
                    type="button"
                    onClick={onOpenAddMedicalPin}
                    className="px-3 py-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 font-medium whitespace-nowrap shrink-0"
                  >
                    Pin Medical Room
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {medicalFacilities.map((fac) => (
                    <div
                      key={fac.id}
                      className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-2.5"
                    >
                      <div>
                        <div className="text-sm font-semibold text-white">{fac.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {fac.building || 'Campus Medical Facility'}
                          {fac.isApproximateLocation ? ' · Approximate location' : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDirectionsToFacility(fac)}
                          className="h-8 px-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Directions</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectFacilityOnMap(fac)}
                          className="h-8 px-2.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          <span>View Pin</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-base text-white">
                  {isAdmin ? 'Admin Safety & Maintenance Queue' : 'My Submitted Safety Reports'} (
                  {visibleReports.length})
                </h2>
                <span className="text-[11px] text-slate-400">
                  Private to reporter &amp; campus admins
                </span>
              </div>

              {visibleReports.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                  No safety or maintenance reports logged yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {visibleReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={`font-semibold uppercase text-[11px] ${
                              rep.severity === 'high'
                                ? 'text-rose-400'
                                : rep.severity === 'medium'
                                  ? 'text-amber-300'
                                  : 'text-blue-300'
                            }`}
                          >
                            {rep.severity} ·{' '}
                            {rep.reportType === 'unsafe_location'
                              ? 'Unsafe Area'
                              : 'Maintenance'}
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400 font-mono text-[11px]">
                            {formatRelativeTime(rep.createdAt)}
                          </span>
                        </div>

                        <span
                          className={`text-[11px] font-semibold flex items-center gap-1 ${
                            rep.status === 'resolved'
                              ? 'text-emerald-400'
                              : rep.status === 'acknowledged'
                                ? 'text-blue-400'
                                : 'text-amber-300'
                          }`}
                        >
                          {rep.status === 'resolved' && (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          <span className="capitalize">{rep.status}</span>
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-white">
                        {rep.locationNote}
                        {rep.building ? ` (${rep.building})` : ''}
                        {rep.floor ? ` · ${rep.floor}` : ''}
                      </div>
                      <p className="text-xs text-slate-300">{rep.description}</p>

                      {isAdmin && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                          <span className="text-[11px] text-slate-400">Admin status:</span>
                          {(['open', 'acknowledged', 'resolved'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(rep.id, st)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize ${
                                rep.status === st
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
