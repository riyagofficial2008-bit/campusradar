import {
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  addAssignmentItem,
  addTimetableSlot,
  deleteAssignmentItem,
  deleteTimetableSlot,
  toggleAssignmentCompleted,
} from '../services/academicService';
import { toggleJoinStudyGroup } from '../services/communityService';
import type {
  AssignmentItem,
  CommunityPost,
  DayOfWeek,
  NavSection,
  StudyGroup,
  TimetableSlot,
} from '../types/campus';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AcademicHubViewProps {
  currentUid: string | null;
  timetable: TimetableSlot[];
  assignments: AssignmentItem[];
  posts: CommunityPost[];
  groups: StudyGroup[];
  onNavigate: (section: NavSection) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

export function AcademicHubView({
  currentUid,
  timetable,
  assignments,
  posts,
  groups,
  onNavigate,
  onAuthRequired,
  onNotify,
}: AcademicHubViewProps) {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Mon');

  // Timetable form
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:50');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);

  // Assignment / exam form
  const [kind, setKind] = useState<'assignment' | 'exam'>('assignment');
  const [taskTitle, setTaskTitle] = useState('');
  const [course, setCourse] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const daySlots = timetable.filter((s) => s.dayOfWeek === selectedDay);
  const sharedResources = posts.filter(
    (p) => p.postType === 'resource' || p.postType === 'question'
  );

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addTimetableSlot({
      dayOfWeek: selectedDay,
      startTime,
      endTime,
      subject,
      building,
      room,
      reminderEnabled,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setSubject('');
    setRoom('');
    onNotify(`Added ${subject} to ${selectedDay} timetable.`);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addAssignmentItem({
      kind,
      title: taskTitle,
      course,
      dueDate,
    });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setTaskTitle('');
    setCourse('');
    onNotify(`${kind === 'exam' ? 'Exam' : 'Assignment'} added to tracker.`);
  };

  const getDaysRemaining = (isoDate: string): string => {
    const target = new Date(`${isoDate}T00:00:00`).getTime();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `${diff}d left`;
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Academic Hub
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Your personal class timetable, assignment tracker, exam countdowns, shared notes, doubt circles, and project teams.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('community')}
            className="h-10 px-4 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            Share Notes or Ask Doubt
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Personal Timetable */}
          <section className="lg:col-span-7 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                <h2 className="font-display font-semibold text-base text-white">
                  Personal Timetable (Student-Entered)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Private to your account
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    selectedDay === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#0F172A] border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {daySlots.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                No classes saved for {selectedDay}. Enter your actual timetable below.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {daySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate">
                        {slot.subject}
                      </div>
                      <div className="text-slate-400 mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-blue-300 tabular-nums">
                          {slot.startTime}–{slot.endTime}
                        </span>
                        {slot.building && <span>· {slot.building}</span>}
                        {slot.room && <span>· Room {slot.room}</span>}
                        {slot.reminderEnabled && (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <Bell className="w-3 h-3" />
                            Reminder on
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteTimetableSlot(slot.id)}
                      aria-label="Delete class slot"
                      className="p-1.5 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleAddClass}
              className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
            >
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject (e.g. Operating Systems)"
                required
                className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <div className="flex gap-2">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="flex-1 h-9 px-2 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white font-mono"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="flex-1 h-9 px-2 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white font-mono"
                />
              </div>
              <input
                type="text"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                placeholder="Building (e.g. KAB / VIB / NYB)"
                className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Room / Lab (optional)"
                className="h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                <span>Class reminder active</span>
              </label>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to {selectedDay}</span>
              </button>
            </form>
          </section>

          {/* Assignment Tracker & Exam Countdown */}
          <section className="lg:col-span-5 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-violet-400" />
              <h2 className="font-display font-semibold text-base text-white">
                Assignments &amp; Exam Countdown
              </h2>
            </div>

            {assignments.length === 0 ? (
              <div className="p-4 rounded-lg border border-dashed border-slate-800 text-xs text-slate-400 text-center">
                No assignments or exams tracked yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {assignments.map((item) => (
                  <div
                    key={item.id}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAssignmentCompleted(item)}
                      className="flex items-start gap-2.5 text-left min-w-0 flex-1"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 mt-0.5 shrink-0 ${
                          item.completed ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div
                          className={`font-medium truncate ${
                            item.completed ? 'line-through text-slate-500' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{item.kind === 'exam' ? 'Exam' : 'Assignment'}</span>
                          {item.course && <span>· {item.course}</span>}
                          <span>·</span>
                          <span className="font-mono text-amber-300 tabular-nums inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.dueDate} ({getDaysRemaining(item.dueDate)})
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAssignmentItem(item.id)}
                      aria-label="Delete item"
                      className="p-1.5 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddTask} className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as 'assignment' | 'exam')}
                  className="h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                >
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam Countdown</option>
                </select>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white font-mono"
                />
              </div>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Title (e.g. DBMS Lab Record / Mid-Sem Exam)"
                required
                className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="Course code / subject"
                  className="flex-1 h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
                >
                  Add
                </button>
              </div>
            </form>
          </section>

          {/* Notes, Resources & Doubt Discussions */}
          <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" />
                <h2 className="font-display font-semibold text-base text-white">
                  Shared Notes, Resources &amp; Doubts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('community')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Post in Community
              </button>
            </div>
            {sharedResources.length === 0 ? (
              <p className="text-xs text-slate-400">
                No study resources or doubts shared yet. Post a link or question in Student Community.
              </p>
            ) : (
              <div className="divide-y divide-slate-800">
                {sharedResources.slice(0, 5).map((p) => (
                  <div key={p.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="text-xs text-blue-400">
                      {p.postType === 'resource' ? 'Study Resource' : 'Doubt / Question'} ·{' '}
                      {p.authorName}
                    </div>
                    <div className="text-sm font-medium text-white">{p.title}</div>
                    <p className="text-xs text-slate-300 line-clamp-2">{p.body}</p>
                    {p.resourceUrl && (
                      <a
                        href={p.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-400 underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open notes link</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Study Partners & Project Teams */}
          <section className="lg:col-span-6 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />
                <h2 className="font-display font-semibold text-base text-white">
                  Study Partners &amp; Project Collaboration
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('community')}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Create group
              </button>
            </div>
            {groups.length === 0 ? (
              <p className="text-xs text-slate-400">
                No active study or project collaboration groups yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-800">
                {groups.slice(0, 4).map((grp) => {
                  const joined = currentUid ? grp.memberUids.includes(currentUid) : false;
                  return (
                    <div
                      key={grp.id}
                      className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {grp.name}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {grp.subject} · {grp.memberUids.length} members
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await toggleJoinStudyGroup(grp);
                          onNotify(res.error ?? (joined ? 'Left group.' : 'Joined group!'));
                        }}
                        className={`h-8 px-3 rounded-lg text-xs font-medium shrink-0 ${
                          joined
                            ? 'bg-emerald-950/60 border border-emerald-700 text-emerald-300'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        {joined ? 'Joined' : 'Join'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
