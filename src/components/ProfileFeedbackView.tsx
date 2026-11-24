import {
  BarChart3,
  Bell,
  Bookmark,
  Camera,
  CheckCircle2,
  Cloud,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  MessageSquare,
  Plus,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  createCampusPoll,
  markNotificationRead,
  respondToFeedback,
  submitFeedback,
  voteCampusPoll,
} from '../services/academicService';
import {
  DEFAULT_DASHBOARD_WIDGETS,
  savePrivateUserSettings,
  savePublicProfile,
} from '../services/communityService';
import type {
  AuthStateInfo,
  BackendSyncStatus,
  CampusEvent,
  CampusNotification,
  CampusPoll,
  DirectMessagePolicy,
  FeedbackItem,
  NavSection,
  PrivateUserSettings,
  ProfileVisibility,
  PublicStudentProfile,
  SavedPlaceItem,
} from '../types/campus';
import { compressImageToDataUrl } from '../utils/imageUtils';
import { formatRelativeTime } from '../utils/statusLogic';

export type ProfileSubTab = 'profile' | 'notifications' | 'feedback';

interface ProfileFeedbackViewProps {
  initialSubTab: ProfileSubTab;
  currentUid: string | null;
  authState: AuthStateInfo;
  syncStatus: BackendSyncStatus;
  isAdmin: boolean;
  isVerifiedOrganizer: boolean;
  myProfile: PublicStudentProfile | null;
  privateSettings: PrivateUserSettings | null;
  savedPlaces: SavedPlaceItem[];
  savedEvents: CampusEvent[];
  notifications: CampusNotification[];
  myFeedback: FeedbackItem[];
  publicFeedback: FeedbackItem[];
  adminAllFeedback: FeedbackItem[];
  polls: CampusPoll[];
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onOpenBackendModal: () => void;
  onOpenSavedPlace: (item: SavedPlaceItem) => void;
  onRemoveSavedPlace: (item: SavedPlaceItem) => void;
  onNavigate: (section: NavSection) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

export function ProfileFeedbackView({
  initialSubTab,
  currentUid,
  authState,
  syncStatus,
  isAdmin,
  isVerifiedOrganizer,
  myProfile,
  privateSettings,
  savedPlaces,
  savedEvents,
  notifications,
  myFeedback,
  publicFeedback,
  adminAllFeedback,
  polls,
  onSignInGoogle,
  onSignOut,
  onOpenBackendModal,
  onOpenSavedPlace,
  onRemoveSavedPlace,
  onNavigate,
  onAuthRequired,
  onNotify,
}: ProfileFeedbackViewProps) {
  const [subTab, setSubTab] = useState<ProfileSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // Profile editor state
  const [displayName, setDisplayName] = useState(
    myProfile?.displayName ?? authState.displayName ?? ''
  );
  const [department, setDepartment] = useState(myProfile?.department ?? '');
  const [course, setCourse] = useState(myProfile?.course ?? '');
  const [year, setYear] = useState(myProfile?.year ?? '');
  const [section, setSection] = useState(myProfile?.section ?? '');
  const [bio, setBio] = useState(myProfile?.bio ?? '');
  const [interestsText, setInterestsText] = useState(
    myProfile?.interests?.join(', ') ?? ''
  );
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(
    myProfile?.photoDataUrl
  );
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    myProfile?.visibility ?? 'campus'
  );
  const [allowDirectMessages, setAllowDirectMessages] = useState<DirectMessagePolicy>(
    myProfile?.allowDirectMessages ?? 'everyone'
  );
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!myProfile) return;
    setDisplayName(myProfile.displayName);
    setDepartment(myProfile.department ?? '');
    setCourse(myProfile.course ?? '');
    setYear(myProfile.year ?? '');
    setSection(myProfile.section ?? '');
    setBio(myProfile.bio ?? '');
    setInterestsText(myProfile.interests?.join(', ') ?? '');
    setPhotoDataUrl(myProfile.photoDataUrl);
    setVisibility(myProfile.visibility);
    setAllowDirectMessages(myProfile.allowDirectMessages);
  }, [myProfile]);

  // Feedback form state
  const [feedbackType, setFeedbackType] =
    useState<FeedbackItem['feedbackType']>('anonymous_feedback');
  const [fbCategory, setFbCategory] = useState('Infrastructure');
  const [fbBuilding, setFbBuilding] = useState('');
  const [fbSubject, setFbSubject] = useState('');
  const [fbDetails, setFbDetails] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [fbVisibility, setFbVisibility] = useState<'public' | 'private'>('private');
  const [submittingFb, setSubmittingFb] = useState(false);

  // Poll creation state
  const [showNewPoll, setShowNewPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('');

  // Admin response drafts keyed by feedbackId
  const [adminResponses, setAdminResponses] = useState<Record<string, string>>({});

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await compressImageToDataUrl(file);
      setPhotoDataUrl(url);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    const interests = interestsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await savePublicProfile({
      displayName,
      department,
      course,
      year,
      section,
      bio,
      interests,
      photoDataUrl,
      visibility,
      allowDirectMessages,
    });
    setSavingProfile(false);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    onNotify('Student profile & privacy preferences saved to Cloud Firestore.');
  };

  const handleToggleNotifyPref = async (
    key: 'notifyEvents' | 'notifyClasses' | 'notifyMessages' | 'notifySafety'
  ) => {
    const base: Omit<PrivateUserSettings, 'uid' | 'updatedAt'> = {
      savedEventIds: privateSettings?.savedEventIds ?? [],
      blockedUids: privateSettings?.blockedUids ?? [],
      dashboardWidgets: privateSettings?.dashboardWidgets ?? DEFAULT_DASHBOARD_WIDGETS,
      notifyEvents: privateSettings?.notifyEvents ?? true,
      notifyClasses: privateSettings?.notifyClasses ?? true,
      notifyMessages: privateSettings?.notifyMessages ?? true,
      notifySafety: privateSettings?.notifySafety ?? true,
    };
    base[key] = !base[key];
    const res = await savePrivateUserSettings(base);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    onNotify('Notification setting updated.');
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingFb(true);
    const res = await submitFeedback({
      feedbackType,
      category: fbCategory,
      subject: fbSubject,
      details: fbDetails,
      building: fbBuilding,
      isAnonymous,
      visibility: fbVisibility,
    });
    setSubmittingFb(false);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setFbSubject('');
    setFbDetails('');
    setFbBuilding('');
    onNotify(
      isAnonymous
        ? 'Anonymous feedback submitted (not linked to your public profile).'
        : 'Feedback submitted and synced.'
    );
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = pollOptionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await createCampusPoll({ question: pollQuestion, options: opts });
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    setPollQuestion('');
    setPollOptionsText('');
    setShowNewPoll(false);
    onNotify('Student poll published.');
  };

  const handleVote = async (poll: CampusPoll, index: number) => {
    const res = await voteCampusPoll(poll, index);
    if (res.error) {
      onNotify(res.error);
      if (res.authRequired) onAuthRequired();
      return;
    }
    onNotify('Vote recorded.');
  };

  const handleAdminFeedbackUpdate = async (
    fb: FeedbackItem,
    nextStatus: FeedbackItem['status']
  ) => {
    const res = await respondToFeedback({
      feedbackId: fb.id,
      status: nextStatus,
      adminResponse: adminResponses[fb.id] ?? fb.adminResponse ?? '',
    });
    if (res.error) {
      onNotify(res.error);
      return;
    }
    onNotify(`Feedback updated (${nextStatus}).`);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Student Profile, Notifications &amp; Campus Feedback
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage your campus identity, privacy &amp; notification settings, saved items, anonymous feedback, and live student polls.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="px-2.5 py-1 rounded bg-violet-950/60 border border-violet-700/70 text-[11px] font-semibold text-violet-300">
                Admin Access
              </span>
            )}
            {isVerifiedOrganizer && !isAdmin && (
              <span className="px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-700/70 text-[11px] font-semibold text-emerald-300">
                Verified Organizer
              </span>
            )}
          </div>
        </div>

        {/* Sub-Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => setSubTab('profile')}
            className={`h-9 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
              subTab === 'profile'
                ? 'bg-blue-600 text-white'
                : 'bg-[#0B1120] border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile &amp; Saved</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('notifications')}
            className={`h-9 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
              subTab === 'notifications'
                ? 'bg-blue-600 text-white'
                : 'bg-[#0B1120] border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('feedback')}
            className={`h-9 px-3.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
              subTab === 'feedback'
                ? 'bg-blue-600 text-white'
                : 'bg-[#0B1120] border border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Campus Feedback &amp; Polls</span>
          </button>
        </div>

        {/* PROFILE & SAVED TAB */}
        {subTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleSaveProfile}
              className="lg:col-span-7 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-base text-white">
                  Public Student Profile
                </h2>
                <span className="text-[11px] text-slate-400">
                  Email &amp; phone are never stored publicly
                </span>
              </div>

              <div className="flex items-center gap-4">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Profile preview"
                    className="w-16 h-16 rounded-full object-cover border border-slate-700"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-blue-300">
                    {(displayName || 'S').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl(undefined)}
                      className="h-9 px-2.5 rounded-lg text-xs text-slate-400 hover:text-rose-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name or campus handle"
                    className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., CSE, ECE, Management"
                    className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Course / Program
                  </label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g., B.Tech, BCA, MBA"
                    className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Year
                    </label>
                    <input
                      type="text"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="e.g., 2nd Year"
                      className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Section
                    </label>
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g., A2"
                      className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Bio
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Projects, skills, or what you're looking to collaborate on..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Interests (comma-separated)
                </label>
                <input
                  type="text"
                  value={interestsText}
                  onChange={(e) => setInterestsText(e.target.value)}
                  placeholder="AI, Web Dev, Robotics, Photography"
                  className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Profile Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
                    className="w-full h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  >
                    <option value="campus">Campus Directory (Public to Students)</option>
                    <option value="connections">Hidden from Directory (Direct Links Only)</option>
                    <option value="private">Private (Only Me)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Direct Messages
                  </label>
                  <select
                    value={allowDirectMessages}
                    onChange={(e) =>
                      setAllowDirectMessages(e.target.value as DirectMessagePolicy)
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                  >
                    <option value="everyone">Allow Campus Students</option>
                    <option value="department">Same Department Only</option>
                    <option value="none">Disable Direct Messages</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="h-10 px-5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white"
              >
                {savingProfile ? 'Saving Profile...' : 'Save Profile & Privacy'}
              </button>
            </form>

            {/* Right Column: Account, Saved Places & Saved Events */}
            <div className="lg:col-span-5 space-y-5">
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Account &amp; Cloud Sync</span>
                </h2>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>
                    Status:{' '}
                    <span className="font-semibold text-white">
                      {authState.uid
                        ? authState.isAnonymous
                          ? 'Signed in (Anonymous Student Session)'
                          : `Signed in as ${authState.displayName || authState.email || 'Google Account'}`
                        : 'Not signed in'}
                    </span>
                  </div>
                  <div>
                    Database:{' '}
                    <span className="font-mono text-emerald-400">
                      {syncStatus === 'connected' ? 'CLOUD SYNC CONNECTED' : syncStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(!authState.uid || authState.isAnonymous) && (
                    <button
                      type="button"
                      onClick={onSignInGoogle}
                      className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign in with Google</span>
                    </button>
                  )}
                  {authState.uid && !authState.isAnonymous && (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenBackendModal}
                    className="h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-400" />
                    <span>Firebase Sync Diagnostics</span>
                  </button>
                </div>
              </section>

              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <h2 className="font-display font-semibold text-sm text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-blue-400" />
                  <span>Saved Places ({savedPlaces.length})</span>
                </h2>
                {savedPlaces.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Bookmark buildings, water stations, or campuses from the Campus Map.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedPlaces.slice(0, 6).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenSavedPlace(item)}
                          className="text-left min-w-0 flex-1"
                        >
                          <div className="text-xs font-medium text-white truncate flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveSavedPlace(item)}
                          aria-label="Remove saved place"
                          className="p-1 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-semibold text-sm text-white">
                    Saved Events ({savedEvents.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('events')}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Browse Events
                  </button>
                </div>
                {savedEvents.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Save events from the Events &amp; Clubs section for quick reminders.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {savedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2"
                      >
                        <div className="text-xs font-medium text-white truncate">
                          {ev.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {ev.startIso ? new Date(ev.startIso).toLocaleString() : ''} ·{' '}
                          {ev.locationName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {subTab === 'notifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section className="lg:col-span-4 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="font-display font-semibold text-base text-white">
                Notification Settings
              </h2>
              <p className="text-xs text-slate-400">
                Stored privately in your Firestore account settings.
              </p>
              <div className="space-y-2">
                {(
                  [
                    ['notifyEvents', 'Event & Club Reminders'],
                    ['notifyClasses', 'Personal Class Reminders'],
                    ['notifyMessages', 'Direct Messages'],
                    ['notifySafety', 'Campus Safety Updates'],
                  ] as const
                ).map(([key, label]) => {
                  const enabled = privateSettings ? privateSettings[key] : true;
                  return (
                    <label
                      key={key}
                      className="flex items-center justify-between bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-200 cursor-pointer"
                    >
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => handleToggleNotifyPref(key)}
                        className="rounded border-slate-600 bg-slate-900"
                      />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="lg:col-span-8 bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
              <h2 className="font-display font-semibold text-base text-white">
                Notifications Feed ({notifications.length})
              </h2>
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg">
                  No notifications yet. New direct messages and campus alerts will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((ntf) => (
                    <div
                      key={ntf.id}
                      className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 ${
                        ntf.read
                          ? 'bg-[#0F172A]/60 border-slate-800/80'
                          : 'bg-blue-950/20 border-blue-700/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-white">{ntf.title}</span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {formatRelativeTime(ntf.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">{ntf.body}</p>
                      </div>
                      {!ntf.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(ntf.id)}
                          className="text-[11px] font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* CAMPUS FEEDBACK & POLLS TAB */}
        {subTab === 'feedback' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Submit Feedback + Polls */}
            <div className="lg:col-span-5 space-y-5">
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="font-display font-semibold text-base text-white">
                  Submit Campus Feedback or Complaint
                </h2>
                <form onSubmit={handleSubmitFeedback} className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        ['anonymous_feedback', 'Feedback'],
                        ['facility_complaint', 'Complaint'],
                        ['suggestion', 'Suggestion'],
                      ] as const
                    ).map(([type, label]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFeedbackType(type)}
                        className={`h-8 rounded-lg border text-[11px] font-medium ${
                          feedbackType === type
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-[#0F172A] border-slate-800 text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Category
                      </label>
                      <select
                        value={fbCategory}
                        onChange={(e) => setFbCategory(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                      >
                        <option>Infrastructure</option>
                        <option>Water &amp; Sanitation</option>
                        <option>Wi-Fi &amp; Charging</option>
                        <option>Cafeteria &amp; Food</option>
                        <option>Academics &amp; Library</option>
                        <option>Safety &amp; Transport</option>
                        <option>General</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Building (optional)
                      </label>
                      <input
                        type="text"
                        value={fbBuilding}
                        onChange={(e) => setFbBuilding(e.target.value)}
                        placeholder="e.g., NYB, KAB"
                        className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Subject *
                    </label>
                    <input
                      type="text"
                      required
                      value={fbSubject}
                      onChange={(e) => setFbSubject(e.target.value)}
                      placeholder="Short summary of your feedback or complaint"
                      className="w-full h-9 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Details *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={fbDetails}
                      onChange={(e) => setFbDetails(e.target.value)}
                      placeholder="Explain clearly so campus administrators can act on it..."
                      className="w-full px-3 py-2 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="mt-0.5 rounded border-slate-600 bg-slate-900"
                      />
                      <span>
                        Submit anonymously{' '}
                        <span className="text-slate-400">
                          (never links your name or public profile; kept only in your private tracker)
                        </span>
                      </span>
                    </label>

                    <div className="flex items-center gap-3 text-xs text-slate-300">
                      <span className="text-slate-400">Visibility:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="fbVis"
                          checked={fbVisibility === 'private'}
                          onChange={() => setFbVisibility('private')}
                        />
                        <span>Private (Admins &amp; Me)</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="fbVis"
                          checked={fbVisibility === 'public'}
                          onChange={() => setFbVisibility('public')}
                        />
                        <span>Public Board</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFb}
                    className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white"
                  >
                    {submittingFb ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </form>
              </section>

              {/* Student Polls */}
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display font-semibold text-base text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    <span>Student Polls ({polls.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowNewPoll((v) => !v)}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Poll</span>
                  </button>
                </div>

                {showNewPoll && (
                  <form
                    onSubmit={handleCreatePoll}
                    className="p-3 rounded-lg bg-[#0F172A] border border-slate-700 space-y-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Poll question..."
                      className="w-full h-9 px-3 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-white"
                    />
                    <textarea
                      rows={3}
                      required
                      value={pollOptionsText}
                      onChange={(e) => setPollOptionsText(e.target.value)}
                      placeholder="Enter one choice per line (2 to 6 choices)"
                      className="w-full px-3 py-2 rounded-lg bg-[#070B14] border border-slate-700 text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="h-8 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white"
                    >
                      Publish Poll
                    </button>
                  </form>
                )}

                {polls.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No active student polls yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {polls.map((poll) => {
                      const totalVotes = poll.voteCounts.reduce((a, b) => a + b, 0);
                      const hasVoted = currentUid ? poll.votedUids.includes(currentUid) : false;
                      return (
                        <div
                          key={poll.id}
                          className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-2.5"
                        >
                          <div className="text-xs font-semibold text-white">
                            {poll.question}
                          </div>
                          <div className="space-y-1.5">
                            {poll.options.map((opt, idx) => {
                              const votes = poll.voteCounts[idx] ?? 0;
                              const pct =
                                totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                              return (
                                <button
                                  key={`${poll.id}_${idx}`}
                                  type="button"
                                  disabled={hasVoted}
                                  onClick={() => handleVote(poll, idx)}
                                  className="w-full text-left relative overflow-hidden rounded-md border border-slate-700/80 bg-[#070B14] px-3 py-2 text-xs hover:border-blue-500/60 disabled:cursor-default"
                                >
                                  <div
                                    className="absolute inset-y-0 left-0 bg-blue-600/20"
                                    style={{ width: `${pct}%` }}
                                  />
                                  <div className="relative flex items-center justify-between gap-2">
                                    <span className="text-slate-200">{opt}</span>
                                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                                      {pct}% ({votes})
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {totalVotes} vote{totalVotes === 1 ? '' : 's'}
                            {hasVoted ? ' · Voted' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right: Tracking & Public Feedback & Admin Queue */}
            <div className="lg:col-span-7 space-y-5">
              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <h2 className="font-display font-semibold text-base text-white">
                  My Submitted Feedback Tracker ({myFeedback.length})
                </h2>
                {myFeedback.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    Submissions you make appear here with live status updates and admin replies.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {myFeedback.map((fb) => (
                      <div
                        key={fb.id}
                        className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {fb.subject}
                          </span>
                          <span
                            className={`text-[11px] font-semibold capitalize flex items-center gap-1 ${
                              fb.status === 'resolved'
                                ? 'text-emerald-400'
                                : fb.status === 'in_review'
                                  ? 'text-blue-400'
                                  : 'text-amber-300'
                            }`}
                          >
                            {fb.status === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
                            {fb.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {fb.category}
                          {fb.building ? ` · ${fb.building}` : ''} ·{' '}
                          {fb.isAnonymous ? 'Anonymous' : 'Named'} ·{' '}
                          {formatRelativeTime(fb.createdAt)}
                        </div>
                        <p className="text-xs text-slate-300">{fb.details}</p>
                        {fb.adminResponse && (
                          <div className="mt-2 p-2.5 rounded bg-blue-950/30 border border-blue-800/50 text-xs text-blue-200">
                            <strong>Admin Response:</strong> {fb.adminResponse}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="bg-[#0B1120] border border-slate-800 rounded-xl p-5 space-y-3">
                <h2 className="font-display font-semibold text-base text-white">
                  Public Campus Feedback Board ({publicFeedback.length})
                </h2>
                {publicFeedback.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No public campus feedback posts yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {publicFeedback.map((fb) => (
                      <div
                        key={fb.id}
                        className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {fb.subject}
                          </span>
                          <span className="text-[11px] text-slate-400 capitalize">
                            {fb.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {fb.category}
                          {fb.building ? ` · ${fb.building}` : ''} ·{' '}
                          {formatRelativeTime(fb.createdAt)}
                        </div>
                        <p className="text-xs text-slate-300">{fb.details}</p>
                        {fb.adminResponse && (
                          <div className="mt-2 p-2.5 rounded bg-emerald-950/30 border border-emerald-800/50 text-xs text-emerald-200">
                            <strong>Official Response:</strong> {fb.adminResponse}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {isAdmin && (
                <section className="bg-[#0B1120] border border-violet-800/60 rounded-xl p-5 space-y-3">
                  <h2 className="font-display font-semibold text-base text-violet-200">
                    Admin Feedback Review Queue ({adminAllFeedback.length})
                  </h2>
                  <div className="space-y-3">
                    {adminAllFeedback.map((fb) => (
                      <div
                        key={fb.id}
                        className="bg-[#0F172A] border border-slate-800 rounded-lg p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">
                            {fb.subject}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {fb.visibility} · {fb.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">{fb.details}</p>
                        <textarea
                          rows={2}
                          value={adminResponses[fb.id] ?? fb.adminResponse ?? ''}
                          onChange={(e) =>
                            setAdminResponses((prev) => ({
                              ...prev,
                              [fb.id]: e.target.value,
                            }))
                          }
                          placeholder="Write official admin response..."
                          className="w-full px-2.5 py-1.5 rounded bg-[#070B14] border border-slate-700 text-xs text-white"
                        />
                        <div className="flex flex-wrap gap-2">
                          {(['submitted', 'in_review', 'resolved'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleAdminFeedbackUpdate(fb, st)}
                              className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize ${
                                fb.status === st
                                  ? 'bg-violet-600 text-white'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              Save as {st.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
