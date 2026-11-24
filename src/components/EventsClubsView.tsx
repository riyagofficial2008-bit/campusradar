import {
  Bell,
  Bookmark,
  Calendar,
  CheckCircle2,
  MapPin,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  createCampusClub,
  createCampusEvent,
  toggleEventRegistration,
  toggleJoinClub,
} from '../services/campusLifeService';
import type {
  CampusClub,
  CampusEvent,
  EventCategory,
  Facility,
} from '../types/campus';

interface EventsClubsViewProps {
  currentUid: string | null;
  isVerifiedOrganizer: boolean;
  events: CampusEvent[];
  clubs: CampusClub[];
  savedEventIds: string[];
  facilities: Facility[];
  onToggleSaveEvent: (eventId: string) => void;
  onSelectFacilityOnMap: (facility: Facility) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

export function EventsClubsView({
  currentUid,
  isVerifiedOrganizer,
  events,
  clubs,
  savedEventIds,
  facilities,
  onToggleSaveEvent,
  onSelectFacilityOnMap,
  onAuthRequired,
  onNotify,
}: EventsClubsViewProps) {
  const [tab, setTab] = useState<'events' | 'clubs'>('events');
  const [categoryFilter, setCategoryFilter] = useState<EventCategory | 'all'>('all');
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateClub, setShowCreateClub] = useState(false);

  // Event form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('workshop');
  const [organizerName, setOrganizerName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [startIso, setStartIso] = useState('');
  const [description, setDescription] = useState('');
  const [isOfficial, setIsOfficial] = useState(isVerifiedOrganizer);

  // Club form
  const [clubName, setClubName] = useState('');
  const [clubCat, setClubCat] = useState('Technical');
  const [clubSpot, setClubSpot] = useState('');
  const [clubDesc, setClubDesc] = useState('');

  const filteredEvents = useMemo(() => {
    return events.filter((e) =>
      categoryFilter === 'all' ? true : e.category === categoryFilter
    );
  }, [events, categoryFilter]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createCampusEvent({
      title,
      category,
      organizerName,
      locationName,
      facilityId: facilityId || undefined,
      startIso: startIso || new Date().toISOString().slice(0, 16),
      description,
      isOfficial: isVerifiedOrganizer && isOfficial,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setTitle('');
    setOrganizerName('');
    setLocationName('');
    setDescription('');
    setShowCreateEvent(false);
    onNotify('Event published to Campus Radar.');
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createCampusClub({
      name: clubName,
      category: clubCat,
      description: clubDesc,
      meetingLocation: clubSpot,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setClubName('');
    setClubSpot('');
    setClubDesc('');
    setShowCreateClub(false);
    onNotify('Club added to campus directory.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Events, Workshops &amp; Clubs
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Discover university workshops, competitions, club meets, register seats, and save reminders.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tab === 'events' ? (
              <button
                type="button"
                onClick={() => setShowCreateEvent((v) => !v)}
                className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{isVerifiedOrganizer ? 'Publish Official Event' : 'Propose Student Event'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateClub((v) => !v)}
                className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Add Club / Society</span>
              </button>
            )}
          </div>
        </div>

        {/* Role authorization note */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck
              className={`w-4 h-4 shrink-0 ${
                isVerifiedOrganizer ? 'text-emerald-400' : 'text-amber-300'
              }`}
            />
            <span>
              {isVerifiedOrganizer
                ? 'Verified Organizer / Admin active: You can publish Official University Events.'
                : 'Only verified event organizers (/organizers/{uid}) or admins can publish Official Events. Regular students can register, save events, or post community meetups.'}
            </span>
          </div>
        </div>

        {/* Toggle Events vs Clubs */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0B1120] border border-slate-800 rounded-xl p-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTab('events')}
              className={`px-4 py-2 rounded-lg text-xs font-medium ${
                tab === 'events'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Events &amp; Workshops ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('clubs')}
              className={`px-4 py-2 rounded-lg text-xs font-medium ${
                tab === 'clubs'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Clubs &amp; Societies ({clubs.length})
            </button>
          </div>

          {tab === 'events' && (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ['all', 'All'],
                  ['workshop', 'Workshops'],
                  ['competition', 'Competitions'],
                  ['seminar', 'Seminars'],
                  ['cultural', 'Cultural'],
                  ['sports', 'Sports'],
                ] as [EventCategory | 'all', string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategoryFilter(id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${
                    categoryFilter === id
                      ? 'bg-violet-600/30 text-violet-200 border border-violet-500/50'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Create Event Form */}
        {showCreateEvent && tab === 'events' && (
          <form
            onSubmit={handleCreateEvent}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display font-semibold text-sm text-white">
              {isVerifiedOrganizer ? 'Publish University Event' : 'Submit Student Club Meetup'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title..."
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                <option value="workshop">Workshop</option>
                <option value="competition">Competition / Hackathon</option>
                <option value="seminar">Seminar / Tech Talk</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="club_meet">Club Meetup</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                value={organizerName}
                onChange={(e) => setOrganizerName(e.target.value)}
                placeholder="Organizer / Club name"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <input
                type="datetime-local"
                value={startIso}
                onChange={(e) => setStartIso(e.target.value)}
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Venue (e.g. VIB Auditorium)"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              >
                <option value="">Link to Campus Map pin (optional)</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, eligibility, and key details..."
              required
              className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
            />
            {isVerifiedOrganizer && (
              <label className="flex items-center gap-2 text-xs text-emerald-300">
                <input
                  type="checkbox"
                  checked={isOfficial}
                  onChange={(e) => setIsOfficial(e.target.checked)}
                />
                <span>Mark as Official Verified University Event</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateEvent(false)}
                className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Publish Event
              </button>
            </div>
          </form>
        )}

        {/* Create Club Form */}
        {showCreateClub && tab === 'clubs' && (
          <form
            onSubmit={handleCreateClub}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-3"
          >
            <h2 className="font-display font-semibold text-sm text-white">
              Register Campus Club or Society
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder="Club name"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <input
                type="text"
                value={clubCat}
                onChange={(e) => setClubCat(e.target.value)}
                placeholder="Category (Technical, Cultural, Sports...)"
                required
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <input
                type="text"
                value={clubSpot}
                onChange={(e) => setClubSpot(e.target.value)}
                placeholder="Meeting location (optional)"
                className="h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
            </div>
            <textarea
              rows={2}
              value={clubDesc}
              onChange={(e) => setClubDesc(e.target.value)}
              placeholder="What this club focuses on..."
              required
              className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateClub(false)}
                className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
              >
                Save Club
              </button>
            </div>
          </form>
        )}

        {/* EVENTS LIST */}
        {tab === 'events' ? (
          filteredEvents.length === 0 ? (
            <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
              No events published yet. Organizers and clubs can add upcoming workshops and competitions here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map((ev) => {
                const isRegistered = currentUid
                  ? ev.registeredUids.includes(currentUid)
                  : false;
                const isSaved = savedEventIds.includes(ev.id);
                const linkedFacility = ev.facilityId
                  ? facilities.find((f) => f.id === ev.facilityId)
                  : undefined;

                return (
                  <div
                    key={ev.id}
                    className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="text-xs text-blue-400 font-medium">
                        {ev.isOfficial ? 'Official Event' : 'Student Meetup'} ·{' '}
                        {ev.category.replace('_', ' ')} · {ev.organizerName}
                      </div>
                      <h3 className="font-display font-semibold text-base text-white">
                        {ev.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {ev.startIso.replace('T', ' ')}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {ev.locationName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed pt-1">
                        {ev.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await toggleEventRegistration(ev);
                            if (res.error) {
                              onNotify(res.error);
                              if (res.authRequired) onAuthRequired();
                              return;
                            }
                            onNotify(
                              isRegistered
                                ? 'Registration cancelled.'
                                : 'Registered! Reminder added.'
                            );
                          }}
                          className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                            isRegistered
                              ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                        >
                          {isRegistered ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Bell className="w-3.5 h-3.5" />
                          )}
                          <span className="tabular-nums">
                            {isRegistered ? 'Registered' : 'Register'} ({ev.registrationCount})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleSaveEvent(ev.id)}
                          className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                            isSaved
                              ? 'bg-violet-600/20 border-violet-500/60 text-violet-200'
                              : 'bg-[#0F172A] border-slate-700 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                          <span>{isSaved ? 'Saved' : 'Save'}</span>
                        </button>
                      </div>

                      {linkedFacility && (
                        <button
                          type="button"
                          onClick={() => onSelectFacilityOnMap(linkedFacility)}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Map location
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : clubs.length === 0 ? (
          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            No campus clubs added yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => {
              const joined = currentUid ? club.memberUids.includes(currentUid) : false;
              return (
                <div
                  key={club.id}
                  className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs text-violet-300 font-medium">
                      {club.category}
                    </div>
                    <h3 className="font-display font-semibold text-base text-white">
                      {club.name}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {club.description}
                    </p>
                    {club.meetingLocation && (
                      <div className="text-xs text-slate-400">
                        Venue: {club.meetingLocation}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                    <span className="text-xs font-mono text-slate-400 tabular-nums flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {club.memberUids.length} members
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await toggleJoinClub(club);
                        onNotify(
                          res.error ?? (joined ? 'Left club.' : `Joined ${club.name}!`)
                        );
                      }}
                      className={`h-9 px-3 rounded-lg text-xs font-semibold ${
                        joined
                          ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                          : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      {joined ? 'Member' : 'Join Club'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
