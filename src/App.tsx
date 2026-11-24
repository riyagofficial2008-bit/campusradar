import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronUp,
  Droplets,
  Info,
  Layers,
  Loader2,
  LogIn,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AcademicHubView } from './components/AcademicHubView';
import { AddFacilityModal } from './components/AddFacilityModal';
import { AppNavigation } from './components/AppNavigation';
import { BackendSetupModal } from './components/BackendSetupModal';
import { CampusMap } from './components/CampusMap';
import { CommunityView } from './components/CommunityView';
import { EventsClubsView } from './components/EventsClubsView';
import { FacilityDetailsPanel } from './components/FacilityDetailsPanel';
import { HomeDashboard } from './components/HomeDashboard';
import { LiveUpdatesView } from './components/LiveUpdatesView';
import { LostFoundView } from './components/LostFoundView';
import { MarketplaceView } from './components/MarketplaceView';
import {
  ProfileFeedbackView,
  type ProfileSubTab,
} from './components/ProfileFeedbackView';
import { ReportStatusModal } from './components/ReportStatusModal';
import { SafetyHelpView } from './components/SafetyHelpView';
import { Sidebar } from './components/Sidebar';
import { TopSearchBar } from './components/TopSearchBar';
import { TransportParkingView } from './components/TransportParkingView';
import {
  ACTIVE_FIREBASE_CONFIG,
  auth,
  hasValidFirebaseConfig,
  signInWithGoogle,
  signOutUser,
  testConnection,
  tryAnonymousSignIn,
} from './firebase';
import {
  JECRC_PRELOADED_FACILITIES,
  JECRC_UNIVERSITY_CAMPUS,
} from './data/jecrcSeedData';
import {
  subscribeAdminModerationQueues,
  subscribePersonalAcademicsAndNotifications,
  subscribePublicFeedbackAndPolls,
} from './services/academicService';
import { subscribeCampusLife } from './services/campusLifeService';
import {
  checkUserRoleStatus,
  DEFAULT_DASHBOARD_WIDGETS,
  savePrivateUserSettings,
  subscribeCommunityFeed,
  subscribeDirectMessages,
  subscribeMyProfileAndSettings,
  subscribePublicDirectory,
} from './services/communityService';
import {
  enrichCampusPolygon,
  fetchCampusesNearLocation,
  fetchFacilitiesAroundCampus,
} from './services/osmService';
import {
  type PinOverride,
  fetchSharedCampusData,
  loadLocalReports,
  loadLocalStudentFacilities,
  loadPinOverrides,
  savePinPositionAdjustment,
  subscribeToSharedCampusData,
} from './services/reportService';
import { fetchWalkingRoute } from './services/routingService';
import {
  loadSavedPlaces,
  savePlacesList,
  toggleSavedCampus,
  toggleSavedFacility,
} from './services/savedPlacesService';
import type {
  AssignmentItem,
  AuthStateInfo,
  BackendSyncStatus,
  CampusClub,
  CampusEvent,
  CampusNotification,
  CampusPlace,
  CampusPoll,
  CommunityPost,
  ComputedFacilityStatus,
  DashboardWidgetId,
  DirectMessage,
  Facility,
  FacilityCategory,
  FeedbackItem,
  LiveMapFilter,
  LostFoundItem,
  MarketplaceListing,
  NavSection,
  PostComment,
  PrivateUserSettings,
  PublicStudentProfile,
  SafetyReport,
  SavedPlaceItem,
  StatusReport,
  StudyGroup,
  TimetableSlot,
  WalkingRoute,
  WorkspaceTab,
} from './types/campus';
import { determineLocationScope, haversineDistanceMeters } from './utils/geo';
import { computeFacilityStatus, matchesLiveMapFilter } from './utils/statusLogic';

export default function App() {
  const firebaseConfigured = hasValidFirebaseConfig();

  // Default Campus: JECRC University, Jaipur
  const [selectedCampus, setSelectedCampus] = useState<CampusPlace>(
    JECRC_UNIVERSITY_CAMPUS
  );
  const [nearbyCampuses, setNearbyCampuses] = useState<CampusPlace[]>([]);

  // Map viewport centered on JECRC University
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    JECRC_UNIVERSITY_CAMPUS.lat,
    JECRC_UNIVERSITY_CAMPUS.lon,
  ]);
  const [mapZoom, setMapZoom] = useState(17);

  // Backend sync & authentication state (never claim connected until server check passes)
  const [syncStatus, setSyncStatus] = useState<BackendSyncStatus>(() => {
    if (!firebaseConfigured) return 'not_configured';
    if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
    return 'connecting';
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [authState, setAuthState] = useState<AuthStateInfo>({
    authReady: !firebaseConfigured,
    uid: null,
    isAnonymous: false,
    email: null,
    displayName: null,
    anonymousAuthDisabled: false,
  });

  // Facilities state (Preloaded JECRC + OSM + Shared Student-added + Shared Pin overrides)
  const [osmFacilities, setOsmFacilities] = useState<Facility[]>([]);
  const [sharedStudentFacilities, setSharedStudentFacilities] = useState<Facility[]>(() =>
    firebaseConfigured ? [] : loadLocalStudentFacilities()
  );
  const [pinOverrides, setPinOverrides] = useState<Record<string, PinOverride>>(() =>
    firebaseConfigured ? {} : loadPinOverrides()
  );
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);

  // Reports (synced from Cloud Firestore in real time when configured)
  const [reports, setReports] = useState<StatusReport[]>(() =>
    firebaseConfigured ? [] : loadLocalReports()
  );
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Navigation & filter state
  const [superAppRulesNeeded, setSuperAppRulesNeeded] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('home');
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>('profile');
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [campusSearchQuery, setCampusSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FacilityCategory | 'all'>('all');
  const [liveFilter, setLiveFilter] = useState<LiveMapFilter>('all');
  const [onlyAvailableCharging, setOnlyAvailableCharging] = useState(false);
  const [onlyWorkingWater, setOnlyWorkingWater] = useState(false);

  // Super App ecosystem real-time state
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerifiedOrganizer, setIsVerifiedOrganizer] = useState(false);
  const [myProfile, setMyProfile] = useState<PublicStudentProfile | null>(null);
  const [privateSettings, setPrivateSettings] = useState<PrivateUserSettings | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<PublicStudentProfile[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [activeDmPartner, setActiveDmPartner] = useState<{
    uid: string;
    name: string;
    context?: string;
  } | null>(null);
  const [campusEvents, setCampusEvents] = useState<CampusEvent[]>([]);
  const [campusClubs, setCampusClubs] = useState<CampusClub[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundItem[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [publicFeedback, setPublicFeedback] = useState<FeedbackItem[]>([]);
  const [adminAllFeedback, setAdminAllFeedback] = useState<FeedbackItem[]>([]);
  const [campusPolls, setCampusPolls] = useState<CampusPoll[]>([]);
  const [mySafetyReports, setMySafetyReports] = useState<SafetyReport[]>([]);
  const [adminSafetyReports, setAdminSafetyReports] = useState<SafetyReport[]>([]);

  // User GPS location (only requested on Locate Me click)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(
    null
  );
  const [locationLoading, setLocationLoading] = useState(false);

  // Walking directions
  const [activeRoute, setActiveRoute] = useState<WalkingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Saved places
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceItem[]>(() =>
    loadSavedPlaces()
  );

  // Modals & pin modes
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalInitialFacility, setReportModalInitialFacility] =
    useState<Facility | null>(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [addPinDefaultCategory, setAddPinDefaultCategory] =
    useState<FacilityCategory>('water');
  const [pendingPinCoords, setPendingPinCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [adjustingFacilityId, setAdjustingFacilityId] = useState<string | null>(null);
  const [backendModalOpen, setBackendModalOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Notice toast
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  // Re-evaluate report expiration every 30s so expired reports automatically become STALE
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const verifyCloudConnection = useCallback(async () => {
    if (!firebaseConfigured) {
      setSyncStatus('not_configured');
      setSyncError('Firebase configuration is missing.');
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      setSyncError('Browser reports no internet connection.');
      return;
    }
    setSyncStatus((prev) => (prev === 'connected' ? 'connected' : 'connecting'));
    const res = await testConnection();
    if (res.connected) {
      setSyncStatus('connected');
      setSyncError(null);
      setLastSyncedAt(new Date().toISOString());
    } else {
      setSyncStatus('offline');
      setSyncError(res.error ?? 'Unable to reach Cloud Firestore server.');
    }
  }, [firebaseConfigured]);

  // Firebase Auth, Startup Connection Test, Initial Fetch, & Real-Time Firestore Listeners
  useEffect(() => {
    if (!firebaseConfigured) {
      setSyncStatus('not_configured');
      return;
    }

    let mounted = true;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      if (user) {
        setAuthState({
          authReady: true,
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          email: user.email,
          displayName: user.displayName,
          anonymousAuthDisabled: false,
        });
      } else {
        setAuthState((prev) => ({
          ...prev,
          authReady: true,
          uid: null,
          isAnonymous: false,
          email: null,
          displayName: null,
        }));
      }
    });

    // Attempt silent Anonymous sign-in (if enabled in Firebase Console)
    tryAnonymousSignIn().then((res) => {
      if (!mounted) return;
      if (!res.ok && res.anonymousDisabled) {
        setAuthState((prev) => ({
          ...prev,
          authReady: true,
          anonymousAuthDisabled: true,
        }));
      }
    });

    // Mandatory startup server connection test + initial fetch
    verifyCloudConnection();
    fetchSharedCampusData()
      .then((initial) => {
        if (!mounted) return;
        setSharedStudentFacilities(initial.facilities);
        setPinOverrides(initial.pinOverrides);
        setReports(initial.reports);
        if (initial.permissionDenied) {
          setSuperAppRulesNeeded(true);
        } else {
          setSyncStatus('connected');
          setSyncError(null);
          setLastSyncedAt(new Date().toISOString());
        }
      })
      .catch((err) => {
        if (!mounted) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to fetch shared campus data from Firestore.';
        setSyncStatus('offline');
        setSyncError(msg);
      });

    // Real-time Firestore listeners (immediately reflects reports from phones/laptops)
    const unsubFirestore = subscribeToSharedCampusData({
      onFacilities: (list) => {
        if (mounted) setSharedStudentFacilities(list);
      },
      onPinOverrides: (map) => {
        if (mounted) setPinOverrides(map);
      },
      onReports: (list) => {
        if (mounted) setReports(list);
      },
      onSyncOnline: () => {
        if (mounted && (typeof navigator === 'undefined' || navigator.onLine)) {
          setSyncStatus('connected');
          setSyncError(null);
          setLastSyncedAt(new Date().toISOString());
        }
      },
      onSyncOffline: (reason) => {
        if (mounted) {
          setSyncStatus('offline');
          setSyncError(reason || 'Firestore realtime listener disconnected.');
        }
      },
      onPermissionDenied: () => {
        if (mounted) {
          setSuperAppRulesNeeded(true);
        }
      },
    });

    const handleOnline = () => {
      verifyCloudConnection();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
      setSyncError('Device went offline.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      unsubAuth();
      unsubFirestore();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firebaseConfigured, verifyCloudConnection]);

  // Super App Public Firestore Subscriptions (community, events, clubs, marketplace, lost & found, public feedback & polls)
  useEffect(() => {
    if (!firebaseConfigured) return;

    const markRulesNeeded = () => setSuperAppRulesNeeded(true);
    const unsubDirectory = subscribePublicDirectory(
      setPublicProfiles,
      undefined,
      markRulesNeeded
    );
    const unsubCommunity = subscribeCommunityFeed({
      onPosts: setCommunityPosts,
      onComments: setPostComments,
      onGroups: setStudyGroups,
      onPermissionDenied: markRulesNeeded,
    });
    const unsubCampusLife = subscribeCampusLife({
      onEvents: setCampusEvents,
      onClubs: setCampusClubs,
      onListings: setMarketplaceListings,
      onLostFound: setLostFoundItems,
      onPermissionDenied: markRulesNeeded,
    });
    const unsubFeedbackPolls = subscribePublicFeedbackAndPolls({
      onPublicFeedback: setPublicFeedback,
      onPolls: setCampusPolls,
      onPermissionDenied: markRulesNeeded,
    });

    return () => {
      unsubDirectory();
      unsubCommunity();
      unsubCampusLife();
      unsubFeedbackPolls();
    };
  }, [firebaseConfigured]);

  // Super App User-Scoped Subscriptions (profile, settings, DMs, timetable, assignments, notifications, personal feedback/safety, roles)
  useEffect(() => {
    if (!firebaseConfigured || !authState.uid) {
      setIsAdmin(false);
      setIsVerifiedOrganizer(false);
      setMyProfile(null);
      setPrivateSettings(null);
      setDirectMessages([]);
      setTimetable([]);
      setAssignments([]);
      setNotifications([]);
      setMyFeedback([]);
      setMySafetyReports([]);
      return;
    }

    let active = true;
    const markRulesNeeded = () => setSuperAppRulesNeeded(true);

    checkUserRoleStatus(authState.uid, authState.email).then((roles) => {
      if (!active) return;
      setIsAdmin(roles.isAdmin);
      setIsVerifiedOrganizer(roles.isVerifiedOrganizer);
    });

    const unsubMyData = subscribeMyProfileAndSettings(authState.uid, {
      onMyProfile: setMyProfile,
      onMySettings: setPrivateSettings,
      onPermissionDenied: markRulesNeeded,
    });
    const unsubDms = subscribeDirectMessages(
      authState.uid,
      setDirectMessages,
      markRulesNeeded
    );
    const unsubAcademics = subscribePersonalAcademicsAndNotifications(authState.uid, {
      onTimetable: setTimetable,
      onAssignments: setAssignments,
      onNotifications: setNotifications,
      onMyFeedback: setMyFeedback,
      onMySafetyReports: setMySafetyReports,
      onPermissionDenied: markRulesNeeded,
    });

    return () => {
      active = false;
      unsubMyData();
      unsubDms();
      unsubAcademics();
    };
  }, [firebaseConfigured, authState.uid, authState.email]);

  // Admin-only Moderation Subscriptions
  useEffect(() => {
    if (!firebaseConfigured || !isAdmin) {
      setAdminAllFeedback([]);
      setAdminSafetyReports([]);
      return;
    }
    return subscribeAdminModerationQueues(isAdmin, {
      onAllFeedback: setAdminAllFeedback,
      onAllSafetyReports: setAdminSafetyReports,
      onPermissionDenied: () => setSuperAppRulesNeeded(true),
    });
  }, [firebaseConfigured, isAdmin]);

  const handleSignInGoogle = useCallback(async () => {
    const res = await signInWithGoogle();
    if (res.ok) {
      showNotice('Signed in with Google. Shared reporting is active.');
    } else if (res.error) {
      showNotice(res.error);
    }
  }, [showNotice]);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
    showNotice('Signed out.');
  }, [showNotice]);

  const campusAbortRef = useRef<AbortController | null>(null);

  const loadCampusData = useCallback(async (campus: CampusPlace) => {
    campusAbortRef.current?.abort();
    const controller = new AbortController();
    campusAbortRef.current = controller;

    const isJecrc = campus.id === JECRC_UNIVERSITY_CAMPUS.id;
    if (!isJecrc) {
      setFacilitiesLoading(true);
    }
    setFacilitiesError(null);
    setSelectedFacilityId(null);
    setActiveRoute(null);
    setAdjustingFacilityId(null);

    try {
      const enriched = await enrichCampusPolygon(campus, controller.signal);
      if (controller.signal.aborted) return;
      if (enriched.polygon && !campus.polygon) {
        setSelectedCampus(enriched);
      }

      const [discoveredCampuses, discoveredOsmFacilities] = await Promise.all([
        fetchCampusesNearLocation(enriched.lat, enriched.lon, 10000, controller.signal).catch(
          () => [] as CampusPlace[]
        ),
        fetchFacilitiesAroundCampus(enriched, 900, controller.signal).catch((err) => {
          if (!isJecrc) throw err;
          return [] as Facility[];
        }),
      ]);

      if (controller.signal.aborted) return;

      setNearbyCampuses(discoveredCampuses);
      setOsmFacilities(discoveredOsmFacilities);
      setFacilitiesLoading(false);
    } catch (err) {
      if (controller.signal.aborted) return;
      setFacilitiesLoading(false);
      if (!isJecrc) {
        setFacilitiesError(
          err instanceof Error
            ? err.message
            : 'Unable to load mapped OpenStreetMap facilities right now.'
        );
      }
    }
  }, []);

  useEffect(() => {
    loadCampusData(JECRC_UNIVERSITY_CAMPUS);
  }, [loadCampusData]);

  const handleSelectCampus = useCallback(
    (place: CampusPlace) => {
      setSelectedCampus(place);
      setMapCenter([place.lat, place.lon]);
      setMapZoom(
        place.placeType === 'state'
          ? 8
          : place.placeType === 'city'
            ? 13
            : 17
      );
      setSelectedCategory('all');
      setLiveFilter('all');
      setCampusSearchQuery('');
      setActiveSection('map');
      loadCampusData(place);
    },
    [loadCampusData]
  );

  // Filter student-added facilities for active campus cleanly (also include facilities within 2.5km radius)
  const studentFacilitiesForCampus = useMemo(() => {
    return sharedStudentFacilities.filter(
      (f) =>
        !f.campusId ||
        f.campusId === selectedCampus.id ||
        haversineDistanceMeters(
          f.lat,
          f.lon,
          selectedCampus.lat,
          selectedCampus.lon
        ) <= 2500
    );
  }, [
    sharedStudentFacilities,
    selectedCampus.id,
    selectedCampus.lat,
    selectedCampus.lon,
  ]);

  // Combine Preloaded JECRC locations (when on JECRC) + Shared Student-added + OSM facilities, applying shared pin overrides
  const allFacilities = useMemo(() => {
    const base: Facility[] = [];
    if (selectedCampus.id === JECRC_UNIVERSITY_CAMPUS.id) {
      base.push(...JECRC_PRELOADED_FACILITIES);
    }
    base.push(...studentFacilitiesForCampus, ...osmFacilities);

    return base.map((fac) => {
      const ov = pinOverrides[fac.id];
      if (!ov) return fac;
      return {
        ...fac,
        lat: ov.lat,
        lon: ov.lon,
        verified: ov.verified,
        isApproximateLocation: ov.isApproximateLocation,
      };
    });
  }, [selectedCampus.id, studentFacilitiesForCampus, osmFacilities, pinOverrides]);

  // Compute status & freshness for every facility
  const { reportsByFacilityId, statusesByFacilityId } = useMemo(() => {
    const byFac = new Map<string, StatusReport[]>();
    for (const rep of reports) {
      const arr = byFac.get(rep.facilityId);
      if (arr) arr.push(rep);
      else byFac.set(rep.facilityId, [rep]);
    }

    const statusMap = new Map<string, ComputedFacilityStatus>();
    for (const fac of allFacilities) {
      statusMap.set(
        fac.id,
        computeFacilityStatus(fac.category, byFac.get(fac.id) ?? [], nowTick)
      );
    }
    return { reportsByFacilityId: byFac, statusesByFacilityId: statusMap };
  }, [allFacilities, reports, nowTick]);

  // Filtered facilities for map & lists
  const filteredFacilities = useMemo(() => {
    const q = campusSearchQuery.trim().toLowerCase();

    return allFacilities.filter((fac) => {
      if (activeTab === 'charging') {
        if (fac.category !== 'charging') return false;
        if (onlyAvailableCharging) {
          const st = statusesByFacilityId.get(fac.id);
          return st ? matchesLiveMapFilter('charging', st, 'available_charging') : false;
        }
        return true;
      }

      if (activeTab === 'water') {
        if (fac.category !== 'water') return false;
        if (onlyWorkingWater) {
          const st = statusesByFacilityId.get(fac.id);
          return st ? matchesLiveMapFilter('water', st, 'working_water') : false;
        }
        return true;
      }

      if (activeTab === 'facilities') {
        if (selectedCategory !== 'all' && fac.category !== selectedCategory) return false;

        if (q) {
          const matchName = fac.name.toLowerCase().includes(q);
          const matchCode = fac.code?.toLowerCase().includes(q);
          const matchBuilding = fac.building?.toLowerCase().includes(q);
          const matchDesc = fac.description?.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchBuilding && !matchDesc) return false;
        }

        const st = statusesByFacilityId.get(fac.id);
        if (st && !matchesLiveMapFilter(fac.category, st, liveFilter)) return false;
      }

      return true;
    });
  }, [
    allFacilities,
    activeTab,
    onlyAvailableCharging,
    onlyWorkingWater,
    selectedCategory,
    campusSearchQuery,
    liveFilter,
    statusesByFacilityId,
  ]);

  const selectedFacility = useMemo(
    () => allFacilities.find((f) => f.id === selectedFacilityId) ?? null,
    [allFacilities, selectedFacilityId]
  );

  const adjustingFacility = useMemo(
    () => allFacilities.find((f) => f.id === adjustingFacilityId) ?? null,
    [allFacilities, adjustingFacilityId]
  );

  // Locate Me (only requested after user clicks button)
  const handleRequestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showNotice('Geolocation is not supported by your browser.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setUserLocation(coords);
        setMapCenter([coords.lat, coords.lon]);
        setMapZoom(17);
        setLocationLoading(false);
        showNotice('Location updated. Distances now measure from your GPS position.');
      },
      (err) => {
        setLocationLoading(false);
        showNotice(
          err.code === 1
            ? 'Location access denied. Enable GPS permission to measure walking distance from you.'
            : 'Unable to get your current GPS coordinates.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [showNotice]);

  // Walking directions
  const handleDirectionsToFacility = useCallback(
    async (facility: Facility, fromFacilityId?: string) => {
      setSelectedFacilityId(facility.id);
      setMobileDrawerOpen(false);

      const originFac = fromFacilityId
        ? allFacilities.find((f) => f.id === fromFacilityId)
        : undefined;

      const startLat = originFac?.lat ?? userLocation?.lat ?? selectedCampus.lat;
      const startLon = originFac?.lon ?? userLocation?.lon ?? selectedCampus.lon;

      if (!originFac && !userLocation) {
        showNotice(
          `Showing route from ${selectedCampus.name} center. Click "Locate Me" or pick a starting building.`
        );
      }

      setRouteLoading(true);
      const route = await fetchWalkingRoute(
        startLat,
        startLon,
        facility.lat,
        facility.lon
      );
      setRouteLoading(false);
      setActiveRoute(route);
    },
    [allFacilities, userLocation, selectedCampus, showNotice]
  );

  const handleSelectFacility = useCallback((fac: Facility) => {
    setSelectedFacilityId(fac.id);
    setMapCenter([fac.lat, fac.lon]);
    setMapZoom(18);
    setMobileDrawerOpen(false);
    setActiveSection('map');
  }, []);

  const handleReportSubmitted = useCallback((newReport: StatusReport) => {
    setReports((prev) => {
      if (prev.some((r) => r.id === newReport.id)) return prev;
      return [newReport, ...prev];
    });
  }, []);

  const handleReportUpdated = useCallback((updated: StatusReport) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  const handleFacilityCreated = useCallback(
    (newFac: Facility) => {
      const scoped: Facility = {
        ...newFac,
        scope: determineLocationScope(newFac.lat, newFac.lon, selectedCampus),
      };
      setSharedStudentFacilities((prev) => {
        if (prev.some((f) => f.id === scoped.id)) return prev;
        return [scoped, ...prev];
      });
      setSelectedFacilityId(scoped.id);
      setMapCenter([scoped.lat, scoped.lon]);
      setMapZoom(18);
      showNotice(
        syncStatus === 'connected'
          ? `Added "${scoped.name}" to shared Firestore database.`
          : `Added "${scoped.name}" (Local Demo Mode only).`
      );
    },
    [selectedCampus, showNotice, syncStatus]
  );

  const handleMoveFacilityPin = useCallback(
    async (facilityId: string, lat: number, lon: number) => {
      const res = await savePinPositionAdjustment({
        facilityId,
        lat,
        lon,
        markVerified: true,
      });
      if (res.error || !res.override) {
        showNotice(res.error ?? 'Could not save pin adjustment.');
        if (res.authRequired) setBackendModalOpen(true);
        return;
      }
      setPinOverrides((prev) => ({ ...prev, [facilityId]: res.override! }));
      setAdjustingFacilityId(null);
      showNotice('Pin repositioned and marked as Verified pin location.');
    },
    [showNotice]
  );

  const handleVerifyPinInPlace = useCallback(
    async (facility: Facility) => {
      const res = await savePinPositionAdjustment({
        facilityId: facility.id,
        lat: facility.lat,
        lon: facility.lon,
        markVerified: true,
      });
      if (res.error || !res.override) {
        showNotice(res.error ?? 'Could not verify pin.');
        if (res.authRequired) setBackendModalOpen(true);
        return;
      }
      setPinOverrides((prev) => ({ ...prev, [facility.id]: res.override! }));
      showNotice(`Verified pin location for ${facility.name}.`);
    },
    [showNotice]
  );

  const handleStartAddPin = useCallback(
    (defaultCat: FacilityCategory = 'water') => {
      setAdjustingFacilityId(null);
      setAddPinDefaultCategory(defaultCat);
      setIsAddingPin(true);
      setMobileDrawerOpen(false);
      showNotice('Click anywhere on the campus map to add the missing place.');
    },
    [showNotice]
  );

  const handleOpenSavedItem = useCallback(
    (item: SavedPlaceItem) => {
      if (item.kind === 'campus' && item.campusData) {
        handleSelectCampus(item.campusData);
        setActiveTab('dashboard');
        setMobileDrawerOpen(false);
        setActiveSection('map');
      } else if (item.kind === 'facility' && item.facilityData) {
        const fac = item.facilityData;
        setMapCenter([fac.lat, fac.lon]);
        setMapZoom(18);
        setSelectedFacilityId(fac.id);
        setActiveTab('facilities');
        setMobileDrawerOpen(false);
        setActiveSection('map');
      }
    },
    [handleSelectCampus]
  );

  // Super App User Settings Handlers
  const updatePrivateSettingsHelper = useCallback(
    async (
      mutator: (
        prev: Omit<PrivateUserSettings, 'uid' | 'updatedAt'>
      ) => Omit<PrivateUserSettings, 'uid' | 'updatedAt'>,
      successMessage?: string
    ) => {
      const base: Omit<PrivateUserSettings, 'uid' | 'updatedAt'> = {
        savedEventIds: privateSettings?.savedEventIds ?? [],
        blockedUids: privateSettings?.blockedUids ?? [],
        dashboardWidgets:
          privateSettings?.dashboardWidgets ?? DEFAULT_DASHBOARD_WIDGETS,
        notifyEvents: privateSettings?.notifyEvents ?? true,
        notifyClasses: privateSettings?.notifyClasses ?? true,
        notifyMessages: privateSettings?.notifyMessages ?? true,
        notifySafety: privateSettings?.notifySafety ?? true,
      };
      const next = mutator(base);
      const res = await savePrivateUserSettings(next);
      if (res.error) {
        showNotice(res.error);
        if (res.authRequired) setBackendModalOpen(true);
        return;
      }
      if (successMessage) showNotice(successMessage);
    },
    [privateSettings, showNotice]
  );

  const handleSaveDashboardWidgets = useCallback(
    (widgets: DashboardWidgetId[]) => {
      updatePrivateSettingsHelper(
        (prev) => ({ ...prev, dashboardWidgets: widgets }),
        'Dashboard layout saved.'
      );
    },
    [updatePrivateSettingsHelper]
  );

  const handleToggleSaveEvent = useCallback(
    (eventId: string) => {
      updatePrivateSettingsHelper((prev) => {
        const exists = prev.savedEventIds.includes(eventId);
        return {
          ...prev,
          savedEventIds: exists
            ? prev.savedEventIds.filter((id) => id !== eventId)
            : [...prev.savedEventIds, eventId],
        };
      });
    },
    [updatePrivateSettingsHelper]
  );

  const handleBlockUser = useCallback(
    (targetUid: string) => {
      updatePrivateSettingsHelper(
        (prev) => ({
          ...prev,
          blockedUids: prev.blockedUids.includes(targetUid)
            ? prev.blockedUids
            : [...prev.blockedUids, targetUid],
        }),
        'User blocked. Their posts and direct messages are now hidden.'
      );
    },
    [updatePrivateSettingsHelper]
  );

  const handleUnblockUser = useCallback(
    (targetUid: string) => {
      updatePrivateSettingsHelper(
        (prev) => ({
          ...prev,
          blockedUids: prev.blockedUids.filter((u) => u !== targetUid),
        }),
        'User unblocked.'
      );
    },
    [updatePrivateSettingsHelper]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const savedEventsList = useMemo(() => {
    const ids = new Set(privateSettings?.savedEventIds ?? []);
    return campusEvents.filter((ev) => ids.has(ev.id));
  }, [campusEvents, privateSettings]);

  const isCampusSaved = savedPlaces.some((s) => s.id === selectedCampus.id);
  const isFacilitySaved = selectedFacility
    ? savedPlaces.some((s) => s.id === selectedFacility.id)
    : false;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#070B14] text-slate-100 overflow-hidden">
      {/* Top Search & Global Actions */}
      <TopSearchBar
        selectedCampus={selectedCampus}
        campusFacilities={allFacilities}
        onSelectCampus={handleSelectCampus}
        onSelectFacility={handleSelectFacility}
        onRequestLocation={handleRequestLocation}
        locationLoading={locationLoading}
        hasUserLocation={Boolean(userLocation)}
        onOpenQuickReport={() => {
          setReportModalInitialFacility(selectedFacility ?? allFacilities[0] ?? null);
          setReportModalOpen(true);
        }}
        syncStatus={syncStatus}
        authState={authState}
        onSignInGoogle={handleSignInGoogle}
        onOpenBackendModal={() => setBackendModalOpen(true)}
        unreadNotifications={unreadNotificationsCount}
        onOpenNotifications={() => {
          setProfileSubTab('notifications');
          setActiveSection('profile');
        }}
      />

      {/* Contextual Backend Status Banner (only shown if connecting, offline, unconfigured, or sign-in needed to write) */}
      {syncStatus === 'not_configured' ? (
        <div className="bg-amber-950/50 border-b border-amber-800/60 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>LOCAL DEMO MODE:</strong> Backend not configured — reports &amp; added places save in this browser only and are not shared.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBackendModalOpen(true)}
            className="text-xs font-semibold text-amber-300 underline underline-offset-2 hover:text-white whitespace-nowrap shrink-0"
          >
            Setup Guide
          </button>
        </div>
      ) : syncStatus === 'connecting' ? (
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin shrink-0" />
            <span className="truncate">
              <strong>CONNECTING TO CLOUD:</strong> Verifying shared Firestore database and loading live campus reports...
            </span>
          </div>
        </div>
      ) : syncStatus === 'offline' ? (
        <div className="bg-rose-950/60 border-b border-rose-800/70 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-rose-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              <strong>OFFLINE:</strong> Unable to reach shared Firestore database. Live updates and new submissions are paused until online.
            </span>
          </div>
          <button
            type="button"
            onClick={verifyCloudConnection}
            className="text-xs font-semibold text-rose-200 underline underline-offset-2 hover:text-white whitespace-nowrap shrink-0"
          >
            Retry Connection
          </button>
        </div>
      ) : syncStatus === 'connected' &&
        authState.authReady &&
        !authState.uid &&
        authState.anonymousAuthDisabled ? (
        <div className="bg-blue-950/50 border-b border-blue-800/60 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-blue-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">
              <strong>CLOUD SYNC CONNECTED (Read-Only):</strong> Sign in with Google to submit shared reports, or enable Anonymous Auth in Firebase Console.
            </span>
          </div>
          <button
            type="button"
            onClick={handleSignInGoogle}
            className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3 h-3" />
            <span>Sign In</span>
          </button>
        </div>
      ) : null}

      {firebaseConfigured && superAppRulesNeeded && (
        <div className="bg-amber-950/60 border-b border-amber-800/70 px-4 py-1.5 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Firestore Rules Update Required ({ACTIVE_FIREBASE_CONFIG.projectId}):</strong> Publish the updated <code className="font-mono">firestore.rules</code> in Firebase Console → Firestore Database → Rules so all Campus Radar collections sync across devices.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSuperAppRulesNeeded(false)}
            aria-label="Dismiss rules notice"
            className="text-amber-300 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace with Persistent 11-Section Super App Navigation */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        <AppNavigation
          activeSection={activeSection}
          onSelectSection={(sec) => {
            if (sec === 'profile') setProfileSubTab('profile');
            setActiveSection(sec);
          }}
          unreadNotifications={unreadNotificationsCount}
          liveReportsCount={reports.length}
          profile={myProfile}
          onOpenFeedback={() => {
            setProfileSubTab('feedback');
            setActiveSection('profile');
          }}
        />

        {/* Global Non-blocking Toast Notice (Visible across all 11 sections) */}
        {notice && (
          <div className="fixed top-16 right-4 z-[520] max-w-sm bg-[#0F172A] border border-blue-500/50 text-slate-100 text-xs px-3.5 py-2.5 rounded-lg shadow-2xl flex items-center gap-2.5">
            <span className="leading-snug">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="relative flex-1 flex min-w-0 min-h-0 overflow-hidden">
          {activeSection === 'home' && (
            <div className="w-full h-full">
              <HomeDashboard
                selectedCampus={selectedCampus}
                profile={myProfile}
                enabledWidgets={
                  privateSettings?.dashboardWidgets ?? DEFAULT_DASHBOARD_WIDGETS
                }
                onSaveWidgets={handleSaveDashboardWidgets}
                facilities={allFacilities}
                statusesByFacilityId={statusesByFacilityId}
                reports={reports}
                events={campusEvents}
                timetable={timetable}
                posts={communityPosts}
                polls={campusPolls}
                onNavigate={setActiveSection}
                onSelectFacilityOnMap={handleSelectFacility}
                onOpenReportModal={(fac) => {
                  setReportModalInitialFacility(fac ?? allFacilities[0] ?? null);
                  setReportModalOpen(true);
                }}
                onOpenFeedback={() => {
                  setProfileSubTab('feedback');
                  setActiveSection('profile');
                }}
              />
            </div>
          )}

          {activeSection === 'live' && (
            <div className="w-full h-full">
              <LiveUpdatesView
                facilities={allFacilities}
                statusesByFacilityId={statusesByFacilityId}
                reports={reports}
                onOpenReportModal={(fac) => {
                  setReportModalInitialFacility(fac ?? allFacilities[0] ?? null);
                  setReportModalOpen(true);
                }}
                onSelectFacilityOnMap={handleSelectFacility}
                onReportUpdated={handleReportUpdated}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'community' && (
            <div className="w-full h-full">
              <CommunityView
                currentUid={authState.uid}
                myProfile={myProfile}
                isAdmin={isAdmin}
                blockedUids={privateSettings?.blockedUids ?? []}
                profiles={publicProfiles}
                posts={communityPosts}
                comments={postComments}
                groups={studyGroups}
                messages={directMessages}
                activeDmPartner={activeDmPartner}
                onSetActiveDmPartner={setActiveDmPartner}
                onBlockUser={handleBlockUser}
                onUnblockUser={handleUnblockUser}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'events' && (
            <div className="w-full h-full">
              <EventsClubsView
                currentUid={authState.uid}
                isVerifiedOrganizer={isVerifiedOrganizer}
                events={campusEvents}
                clubs={campusClubs}
                savedEventIds={privateSettings?.savedEventIds ?? []}
                facilities={allFacilities}
                onToggleSaveEvent={handleToggleSaveEvent}
                onSelectFacilityOnMap={handleSelectFacility}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'marketplace' && (
            <div className="w-full h-full">
              <MarketplaceView
                currentUid={authState.uid}
                myDisplayName={myProfile?.displayName ?? authState.displayName ?? undefined}
                listings={marketplaceListings}
                onContactSeller={(sellerUid, sellerName, listingTitle) => {
                  setActiveDmPartner({
                    uid: sellerUid,
                    name: sellerName,
                    context: `Marketplace: ${listingTitle}`,
                  });
                  setActiveSection('community');
                }}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'lost_found' && (
            <div className="w-full h-full">
              <LostFoundView
                currentUid={authState.uid}
                myDisplayName={myProfile?.displayName ?? authState.displayName ?? undefined}
                items={lostFoundItems}
                onContactPoster={(posterUid, posterName, itemTitle) => {
                  setActiveDmPartner({
                    uid: posterUid,
                    name: posterName,
                    context: `Lost & Found: ${itemTitle}`,
                  });
                  setActiveSection('community');
                }}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'academic' && (
            <div className="w-full h-full">
              <AcademicHubView
                currentUid={authState.uid}
                timetable={timetable}
                assignments={assignments}
                posts={communityPosts}
                groups={studyGroups}
                onNavigate={setActiveSection}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'transport' && (
            <div className="w-full h-full">
              <TransportParkingView
                facilities={allFacilities}
                statusesByFacilityId={statusesByFacilityId}
                posts={communityPosts}
                onDirectionsToFacility={(fac) => {
                  setActiveSection('map');
                  handleDirectionsToFacility(fac);
                }}
                onOpenReportModal={(fac) => {
                  setReportModalInitialFacility(fac ?? allFacilities[0] ?? null);
                  setReportModalOpen(true);
                }}
                onOpenAddTransportPin={(cat) => {
                  setActiveSection('map');
                  handleStartAddPin(cat);
                }}
              />
            </div>
          )}

          {activeSection === 'safety' && (
            <div className="w-full h-full">
              <SafetyHelpView
                isAdmin={isAdmin}
                facilities={allFacilities}
                mySafetyReports={mySafetyReports}
                adminSafetyReports={adminSafetyReports}
                onSelectFacilityOnMap={handleSelectFacility}
                onDirectionsToFacility={(fac) => {
                  setActiveSection('map');
                  handleDirectionsToFacility(fac);
                }}
                onOpenAddMedicalPin={() => {
                  setActiveSection('map');
                  handleStartAddPin('medical');
                }}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'profile' && (
            <div className="w-full h-full">
              <ProfileFeedbackView
                initialSubTab={profileSubTab}
                currentUid={authState.uid}
                authState={authState}
                syncStatus={syncStatus}
                isAdmin={isAdmin}
                isVerifiedOrganizer={isVerifiedOrganizer}
                myProfile={myProfile}
                privateSettings={privateSettings}
                savedPlaces={savedPlaces}
                savedEvents={savedEventsList}
                notifications={notifications}
                myFeedback={myFeedback}
                publicFeedback={publicFeedback}
                adminAllFeedback={adminAllFeedback}
                polls={campusPolls}
                onSignInGoogle={handleSignInGoogle}
                onSignOut={handleSignOut}
                onOpenBackendModal={() => setBackendModalOpen(true)}
                onOpenSavedPlace={handleOpenSavedItem}
                onRemoveSavedPlace={(item) =>
                  setSavedPlaces((prev) => {
                    const next = prev.filter((p) => p.id !== item.id);
                    savePlacesList(next);
                    return next;
                  })
                }
                onNavigate={setActiveSection}
                onAuthRequired={() => setBackendModalOpen(true)}
                onNotify={showNotice}
              />
            </div>
          )}

          {activeSection === 'map' && (
            <>
        {/* Left Sidebar (Desktop) */}
        <div className="hidden md:block w-[340px] lg:w-[375px] shrink-0 h-full">
          <Sidebar
            selectedCampus={selectedCampus}
            allCampusFacilities={allFacilities}
            filteredFacilities={filteredFacilities}
            facilitiesLoading={facilitiesLoading}
            facilitiesError={facilitiesError}
            statusesByFacilityId={statusesByFacilityId}
            reports={reports}
            selectedFacilityId={selectedFacilityId}
            userLocation={userLocation}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            campusSearchQuery={campusSearchQuery}
            onCampusSearchChange={setCampusSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            liveFilter={liveFilter}
            onLiveFilterChange={setLiveFilter}
            onlyAvailableCharging={onlyAvailableCharging}
            onToggleOnlyAvailableCharging={() =>
              setOnlyAvailableCharging((v) => !v)
            }
            onlyWorkingWater={onlyWorkingWater}
            onToggleOnlyWorkingWater={() => setOnlyWorkingWater((v) => !v)}
            savedPlaces={savedPlaces}
            isCampusSaved={isCampusSaved}
            onToggleSaveCampus={() =>
              setSavedPlaces((prev) => toggleSavedCampus(prev, selectedCampus))
            }
            onSelectFacility={handleSelectFacility}
            onRetryLoadFacilities={() => loadCampusData(selectedCampus)}
            onStartAddPin={handleStartAddPin}
            onOpenQuickReport={() => {
              setReportModalInitialFacility(
                selectedFacility ?? allFacilities[0] ?? null
              );
              setReportModalOpen(true);
            }}
            onDirectionsToFacility={(fac) => handleDirectionsToFacility(fac)}
            onRemoveSavedItem={(item) =>
              setSavedPlaces((prev) => {
                const next = prev.filter((p) => p.id !== item.id);
                savePlacesList(next);
                return next;
              })
            }
            onOpenSavedItem={handleOpenSavedItem}
            onQuickReportSubmitted={handleReportSubmitted}
            onQuickReportError={(errMsg, authReq) => {
              showNotice(errMsg);
              if (authReq) setBackendModalOpen(true);
            }}
          />
        </div>

        {/* Center Interactive Leaflet Map */}
        <main className="relative flex-1 min-w-0 h-full">
          <CampusMap
            center={mapCenter}
            zoom={mapZoom}
            selectedCampus={selectedCampus}
            nearbyCampuses={nearbyCampuses}
            facilities={filteredFacilities}
            statusesByFacilityId={statusesByFacilityId}
            selectedFacilityId={selectedFacilityId}
            userLocation={userLocation}
            activeRoute={activeRoute}
            isAddingPin={isAddingPin}
            adjustingFacility={adjustingFacility}
            onSelectCampus={handleSelectCampus}
            onSelectFacility={handleSelectFacility}
            onMapPinDrop={(lat, lon) => {
              setIsAddingPin(false);
              setPendingPinCoords({ lat, lon });
            }}
            onMoveFacilityPin={handleMoveFacilityPin}
            onCancelAdjustPin={() => setAdjustingFacilityId(null)}
          />

          {/* Mobile Quick Bar (raised above bottom navigation bar) */}
          {!selectedFacility && !mobileDrawerOpen && (
            <div className="md:hidden absolute bottom-16 left-3 right-3 z-[420] flex items-center justify-between gap-2 pointer-events-none">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setMobileDrawerOpen(true);
                }}
                className="pointer-events-auto flex-1 h-11 px-3.5 bg-[#0F172A] border border-slate-700 rounded-xl shadow-xl text-xs font-semibold text-white flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 truncate">
                  <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="truncate">
                    {selectedCampus.name} ({filteredFacilities.length})
                  </span>
                </span>
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('charging');
                  setMobileDrawerOpen(true);
                }}
                aria-label="Find Charging"
                className="pointer-events-auto h-11 px-3 bg-[#0F172A] border border-slate-700 rounded-xl shadow-xl text-xs font-semibold text-slate-100 flex items-center gap-1"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Power</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('water');
                  setMobileDrawerOpen(true);
                }}
                aria-label="Water Finder"
                className="pointer-events-auto h-11 px-3 bg-[#0F172A] border border-slate-700 rounded-xl shadow-xl text-xs font-semibold text-slate-100 flex items-center gap-1"
              >
                <Droplets className="w-4 h-4 text-blue-400" />
                <span>Water</span>
              </button>
            </div>
          )}
        </main>

        {/* Right Details Panel (Desktop) */}
        {selectedFacility && (
          <div className="hidden md:block w-[360px] lg:w-[390px] shrink-0 h-full">
            <FacilityDetailsPanel
              facility={selectedFacility}
              allCampusFacilities={allFacilities}
              computedStatus={
                statusesByFacilityId.get(selectedFacility.id) ??
                computeFacilityStatus(selectedFacility.category, [], nowTick)
              }
              allReportsForFacility={
                reportsByFacilityId.get(selectedFacility.id) ?? []
              }
              userLocation={userLocation}
              isSaved={isFacilitySaved}
              activeRoute={activeRoute}
              routeLoading={routeLoading}
              isAdjustingThisPin={adjustingFacilityId === selectedFacility.id}
              onClose={() => {
                setSelectedFacilityId(null);
                setActiveRoute(null);
                setAdjustingFacilityId(null);
              }}
              onOpenReportModal={() => {
                setReportModalInitialFacility(selectedFacility);
                setReportModalOpen(true);
              }}
              onToggleSave={() =>
                setSavedPlaces((prev) =>
                  toggleSavedFacility(prev, selectedFacility)
                )
              }
              onRequestDirections={(originId) =>
                handleDirectionsToFacility(selectedFacility, originId)
              }
              onClearRoute={() => setActiveRoute(null)}
              onReportUpdated={handleReportUpdated}
              onStartAdjustPin={() => {
                setAdjustingFacilityId((prev) =>
                  prev === selectedFacility.id ? null : selectedFacility.id
                );
                showNotice(
                  'Drag the pin or click the exact location on the map to adjust it.'
                );
              }}
              onVerifyPinInPlace={() => handleVerifyPinInPlace(selectedFacility)}
              onAuthRequired={() => setBackendModalOpen(true)}
            />
          </div>
        )}

        {/* Mobile Bottom Sheet for Selected Facility */}
        {selectedFacility && (
          <div className="md:hidden fixed inset-x-0 bottom-14 z-[480] h-[62vh] bg-[#0B1120] rounded-t-2xl shadow-2xl border-t border-slate-700 overflow-hidden">
            <FacilityDetailsPanel
              facility={selectedFacility}
              allCampusFacilities={allFacilities}
              computedStatus={
                statusesByFacilityId.get(selectedFacility.id) ??
                computeFacilityStatus(selectedFacility.category, [], nowTick)
              }
              allReportsForFacility={
                reportsByFacilityId.get(selectedFacility.id) ?? []
              }
              userLocation={userLocation}
              isSaved={isFacilitySaved}
              activeRoute={activeRoute}
              routeLoading={routeLoading}
              isAdjustingThisPin={adjustingFacilityId === selectedFacility.id}
              onClose={() => {
                setSelectedFacilityId(null);
                setActiveRoute(null);
                setAdjustingFacilityId(null);
              }}
              onOpenReportModal={() => {
                setReportModalInitialFacility(selectedFacility);
                setReportModalOpen(true);
              }}
              onToggleSave={() =>
                setSavedPlaces((prev) =>
                  toggleSavedFacility(prev, selectedFacility)
                )
              }
              onRequestDirections={(originId) =>
                handleDirectionsToFacility(selectedFacility, originId)
              }
              onClearRoute={() => setActiveRoute(null)}
              onReportUpdated={handleReportUpdated}
              onStartAdjustPin={() => {
                setAdjustingFacilityId(selectedFacility.id);
                setSelectedFacilityId(null);
                showNotice('Tap the exact location on the map to move the pin.');
              }}
              onVerifyPinInPlace={() => handleVerifyPinInPlace(selectedFacility)}
              onAuthRequired={() => setBackendModalOpen(true)}
            />
          </div>
        )}

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-[490] bg-black/60 flex flex-col justify-end">
            <div className="h-[84vh] bg-[#0B1120] rounded-t-2xl overflow-hidden flex flex-col shadow-2xl border-t border-slate-700">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between bg-[#0F172A] shrink-0">
                <span className="font-display font-bold text-sm text-white">
                  Campus Dashboard &amp; Filters
                </span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close drawer"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <Sidebar
                  selectedCampus={selectedCampus}
                  allCampusFacilities={allFacilities}
                  filteredFacilities={filteredFacilities}
                  facilitiesLoading={facilitiesLoading}
                  facilitiesError={facilitiesError}
                  statusesByFacilityId={statusesByFacilityId}
                  reports={reports}
                  selectedFacilityId={selectedFacilityId}
                  userLocation={userLocation}
                  activeTab={activeTab}
                  onChangeTab={setActiveTab}
                  campusSearchQuery={campusSearchQuery}
                  onCampusSearchChange={setCampusSearchQuery}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  liveFilter={liveFilter}
                  onLiveFilterChange={setLiveFilter}
                  onlyAvailableCharging={onlyAvailableCharging}
                  onToggleOnlyAvailableCharging={() =>
                    setOnlyAvailableCharging((v) => !v)
                  }
                  onlyWorkingWater={onlyWorkingWater}
                  onToggleOnlyWorkingWater={() =>
                    setOnlyWorkingWater((v) => !v)
                  }
                  savedPlaces={savedPlaces}
                  isCampusSaved={isCampusSaved}
                  onToggleSaveCampus={() =>
                    setSavedPlaces((prev) =>
                      toggleSavedCampus(prev, selectedCampus)
                    )
                  }
                  onSelectFacility={handleSelectFacility}
                  onRetryLoadFacilities={() => loadCampusData(selectedCampus)}
                  onStartAddPin={handleStartAddPin}
                  onOpenQuickReport={() => {
                    setMobileDrawerOpen(false);
                    setReportModalInitialFacility(
                      selectedFacility ?? allFacilities[0] ?? null
                    );
                    setReportModalOpen(true);
                  }}
                  onDirectionsToFacility={(fac) =>
                    handleDirectionsToFacility(fac)
                  }
                  onRemoveSavedItem={(item) =>
                    setSavedPlaces((prev) => {
                      const next = prev.filter((p) => p.id !== item.id);
                      savePlacesList(next);
                      return next;
                    })
                  }
                  onOpenSavedItem={handleOpenSavedItem}
                  onQuickReportSubmitted={handleReportSubmitted}
                  onQuickReportError={(errMsg, authReq) => {
                    showNotice(errMsg);
                    if (authReq) setBackendModalOpen(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {reportModalOpen && (
        <ReportStatusModal
          initialFacility={reportModalInitialFacility}
          facilities={allFacilities}
          onClose={() => setReportModalOpen(false)}
          onSubmitted={handleReportSubmitted}
          syncStatus={syncStatus}
          authState={authState}
          onSignInGoogle={handleSignInGoogle}
        />
      )}

      {pendingPinCoords && (
        <AddFacilityModal
          coords={pendingPinCoords}
          defaultCategory={addPinDefaultCategory}
          selectedCampus={selectedCampus}
          onClose={() => setPendingPinCoords(null)}
          onCreated={handleFacilityCreated}
          syncStatus={syncStatus}
          authState={authState}
          onSignInGoogle={handleSignInGoogle}
        />
      )}

      {backendModalOpen && (
        <BackendSetupModal
          syncStatus={syncStatus}
          syncError={syncError}
          lastSyncedAt={lastSyncedAt}
          authState={authState}
          counts={{
            facilities: sharedStudentFacilities.length,
            reports: reports.length,
            pinOverrides: Object.keys(pinOverrides).length,
          }}
          onTestConnection={verifyCloudConnection}
          onSignInGoogle={handleSignInGoogle}
          onSignOut={handleSignOut}
          onClose={() => setBackendModalOpen(false)}
        />
      )}
    </div>
  );
}
