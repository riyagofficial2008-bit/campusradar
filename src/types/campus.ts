export type FacilityCategory =
  | 'academic'
  | 'cafeteria'
  | 'charging'
  | 'water'
  | 'library'
  | 'washroom'
  | 'medical'
  | 'parking'
  | 'lab'
  | 'hostel'
  | 'sports'
  | 'atm'
  | 'bus_stop'
  | 'shop'
  | 'other';

export type LocationScope = 'inside_campus' | 'nearby_campus' | 'uncertain';

export type FreshnessState = 'live' | 'stale' | 'unknown' | 'issue';

export type MarkerColor = 'green' | 'yellow' | 'red' | 'grey';

export type LiveMapFilter =
  | 'all'
  | 'crowded'
  | 'quiet'
  | 'available_charging'
  | 'working_water'
  | 'available_study'
  | 'problems'
  | 'unknown';

export type WorkspaceTab =
  | 'dashboard'
  | 'facilities'
  | 'charging'
  | 'water'
  | 'saved';

export type NavSection =
  | 'home'
  | 'map'
  | 'live'
  | 'community'
  | 'events'
  | 'marketplace'
  | 'lost_found'
  | 'academic'
  | 'transport'
  | 'safety'
  | 'profile';

export type DashboardWidgetId =
  | 'today_events'
  | 'upcoming_classes'
  | 'live_updates'
  | 'charging_water'
  | 'crowded_spots'
  | 'nearby_facilities'
  | 'community_discussions'
  | 'announcements_polls'
  | 'emergency_shortcuts';

export interface CampusPlace {
  id: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  subtitle: string;
  city?: string;
  state?: string;
  displayName: string;
  lat: number;
  lon: number;
  /** [south, north, west, east] */
  boundingBox?: [number, number, number, number];
  /** [lat, lon][] polygon ring when available from OSM */
  polygon?: [number, number][];
  placeType: 'university' | 'college' | 'campus' | 'city' | 'state' | 'facility';
}

export type BackendSyncStatus =
  | 'connecting'
  | 'connected'
  | 'offline'
  | 'not_configured';

export interface AuthStateInfo {
  authReady: boolean;
  uid: string | null;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  anonymousAuthDisabled: boolean;
}

export interface Facility {
  id: string;
  osmId?: string;
  code?: string;
  name: string;
  building?: string;
  floor?: string;
  description?: string;
  category: FacilityCategory;
  lat: number;
  lon: number;
  campusId?: string;
  campusName?: string;
  scope: LocationScope;
  address?: string;
  osmTags?: Record<string, string>;
  isPreloaded?: boolean;
  isStudentAdded?: boolean;
  isApproximateLocation?: boolean;
  verified?: boolean;
  preloadedNote?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface StatusReport {
  id: string;
  facilityId: string;
  facilityName: string;
  facilityCategory: FacilityCategory;
  campusId?: string;
  building?: string;
  floor?: string;
  statusValue: string;
  secondaryValue?: string;
  seatingValue?: string;
  freePointsCount?: number;
  totalPointsCount?: number;
  note?: string;
  reporterId: string;
  reporterLabel?: string;
  createdAt: string;
  confirmations: number;
  confirmedBy: string[];
  isLocalDemo?: boolean;
}

export interface ComputedFacilityStatus {
  freshness: FreshnessState;
  freshnessLabel: string;
  markerColor: MarkerColor;
  primaryLabel: string;
  secondaryLabel?: string;
  confidenceLabel: string;
  isMixed: boolean;
  agreementSummary: string;
  latestReport?: StatusReport;
  recentReports: StatusReport[];
  expiredReportsCount: number;
  recentCount: number;
  expiresAtMs?: number;
}

export interface SavedPlaceItem {
  id: string;
  kind: 'campus' | 'facility';
  name: string;
  subtitle: string;
  category?: FacilityCategory;
  lat: number;
  lon: number;
  savedAt: string;
  campusData?: CampusPlace;
  facilityData?: Facility;
}

export interface WalkingRoute {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps: { instruction: string; distanceMeters: number }[];
  source: 'osrm' | 'fallback';
  fallbackReason?: string;
}

// --- Super App Ecosystem Types ---

export type ProfileVisibility = 'campus' | 'connections' | 'private';
export type DirectMessagePolicy = 'everyone' | 'department' | 'none';

export interface PublicStudentProfile {
  uid: string;
  displayName: string;
  department?: string;
  course?: string;
  year?: string;
  section?: string;
  bio?: string;
  interests?: string[];
  photoDataUrl?: string;
  visibility: ProfileVisibility;
  allowDirectMessages: DirectMessagePolicy;
  isVerifiedOrganizer: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateUserSettings {
  uid: string;
  savedEventIds: string[];
  blockedUids: string[];
  dashboardWidgets: DashboardWidgetId[];
  notifyEvents: boolean;
  notifyClasses: boolean;
  notifyMessages: boolean;
  notifySafety: boolean;
  updatedAt: string;
}

export type EventCategory =
  | 'workshop'
  | 'competition'
  | 'cultural'
  | 'seminar'
  | 'sports'
  | 'club_meet'
  | 'other';

export interface CampusEvent {
  id: string;
  title: string;
  category: EventCategory;
  organizerName: string;
  clubId?: string;
  locationName: string;
  facilityId?: string;
  startIso: string;
  endIso?: string;
  description: string;
  isOfficial: boolean;
  registrationCount: number;
  registeredUids: string[];
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CampusClub {
  id: string;
  name: string;
  category: string;
  description: string;
  meetingLocation?: string;
  memberUids: string[];
  createdBy: string;
  createdAt: string;
}

export type CommunityPostType =
  | 'discussion'
  | 'question'
  | 'resource'
  | 'project_partner'
  | 'announcement';

export interface CommunityPost {
  id: string;
  postType: CommunityPostType;
  title: string;
  body: string;
  department?: string;
  resourceUrl?: string;
  authorUid: string;
  authorName: string;
  likedBy: string[];
  likesCount: number;
  commentsCount: number;
  reportedBy: string[];
  isHidden: boolean;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  body: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  participants: string[];
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  contextLabel?: string;
  text: string;
  createdAt: string;
}

export type StudyGroupType = 'study_group' | 'project_team' | 'doubt_circle';

export interface StudyGroup {
  id: string;
  name: string;
  subject: string;
  groupType: StudyGroupType;
  description: string;
  meetingSpot?: string;
  memberUids: string[];
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export type MarketplaceCategory =
  | 'textbooks'
  | 'notes'
  | 'calculators'
  | 'stationery'
  | 'lab_equipment'
  | 'other';

export type MarketplaceCondition = 'new' | 'like_new' | 'good' | 'used';

export interface MarketplaceListing {
  id: string;
  title: string;
  category: MarketplaceCategory;
  priceInr: number;
  condition: MarketplaceCondition;
  description: string;
  pickupSpot?: string;
  photoDataUrl?: string;
  sellerUid: string;
  sellerName: string;
  status: 'available' | 'sold' | 'removed';
  reportedBy: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LostFoundItem {
  id: string;
  itemType: 'lost' | 'found';
  title: string;
  building?: string;
  floor?: string;
  approximateLocation?: string;
  eventDate?: string;
  description: string;
  imageUrls?: string[];
  photoDataUrl?: string;
  posterUid: string;
  posterName: string;
  status: 'open' | 'returned';
  createdAt: string;
  updatedAt?: string;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export interface TimetableSlot {
  id: string;
  userId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  subject: string;
  building?: string;
  room?: string;
  reminderEnabled: boolean;
  createdAt: string;
}

export interface AssignmentItem {
  id: string;
  userId: string;
  kind: 'assignment' | 'exam';
  title: string;
  course?: string;
  dueDate: string;
  completed: boolean;
  createdAt: string;
}

export interface CampusNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'event' | 'message' | 'academic' | 'safety' | 'feedback';
  read: boolean;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  feedbackType: 'anonymous_feedback' | 'facility_complaint' | 'suggestion';
  category: string;
  subject: string;
  details: string;
  building?: string;
  isAnonymous: boolean;
  visibility: 'public' | 'private';
  submitterUid: string;
  status: 'submitted' | 'in_review' | 'resolved';
  adminResponse?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CampusPoll {
  id: string;
  question: string;
  options: string[];
  voteCounts: number[];
  votedUids: string[];
  createdBy: string;
  createdAt: string;
}

export interface SafetyReport {
  id: string;
  reportType: 'unsafe_location' | 'maintenance';
  building?: string;
  floor?: string;
  locationNote: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  reporterUid: string;
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  updatedAt?: string;
}
