import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  hasValidFirebaseConfig,
  handleFirestoreError,
  OperationType,
  tryAnonymousSignIn,
} from '../firebase';
import type { Facility, FacilityCategory, StatusReport } from '../types/campus';

const LOCAL_REPORTS_KEY = 'campus_radar_jecrc_reports_v1';
const LOCAL_FACILITIES_KEY = 'campus_radar_jecrc_facilities_v1';
const PIN_OVERRIDES_KEY = 'campus_radar_jecrc_pin_overrides_v1';
const REPORTER_ID_KEY = 'campus_radar_anon_reporter_id_v1';
const RATE_LIMIT_KEY = 'campus_radar_rate_limit_v1';

const PER_FACILITY_COOLDOWN_MS = 15 * 1000; // 15s anti-spam cooldown per facility
const MAX_REPORTS_PER_HOUR = 30;

export interface PinOverride {
  facilityId: string;
  lat: number;
  lon: number;
  verified: boolean;
  isApproximateLocation: boolean;
  updatedAt: string;
  updatedBy: string;
}

export function sanitizeFirestoreId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length >= 2 ? cleaned : `id_${Date.now()}`;
}

function createDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

function timestampToIso(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

export function getAnonymousReporterId(): string {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  try {
    let id = localStorage.getItem(REPORTER_ID_KEY);
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      id = `Student-${rand}`;
      localStorage.setItem(REPORTER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'Student-Anon';
  }
}

export function getReporterDisplayLabel(): string {
  const user = auth.currentUser;
  if (user) {
    if (user.displayName && user.displayName.trim()) {
      return user.displayName.trim().split(' ')[0].slice(0, 24);
    }
    return `Student-${user.uid.slice(0, 4).toUpperCase()}`;
  }
  return getAnonymousReporterId().slice(0, 24);
}

function checkRateLimit(facilityId: string): { allowed: boolean; reason?: string } {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const history: { facilityId: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const lastHour = history.filter((h) => now - h.ts < 60 * 60 * 1000);

    if (lastHour.length >= MAX_REPORTS_PER_HOUR) {
      return {
        allowed: false,
        reason: 'Rate limit reached (max 30 reports per hour) to prevent spam.',
      };
    }

    const lastForFacility = lastHour.find((h) => h.facilityId === facilityId);
    if (lastForFacility && now - lastForFacility.ts < PER_FACILITY_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (PER_FACILITY_COOLDOWN_MS - (now - lastForFacility.ts)) / 1000
      );
      return {
        allowed: false,
        reason: `Please wait ${waitSec}s before submitting another report for this location.`,
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

function recordRateLimit(facilityId: string): void {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const history: { facilityId: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const cleaned = history.filter((h) => now - h.ts < 60 * 60 * 1000);
    cleaned.unshift({ facilityId, ts: now });
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore
  }
}

// --- Local Demo Fallbacks (ONLY used when Firebase is NOT configured) ---
export function loadLocalReports(): StatusReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_REPORTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StatusReport[];
  } catch {
    return [];
  }
}

function saveLocalReports(reports: StatusReport[]): void {
  try {
    localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports.slice(0, 500)));
  } catch {
    // ignore
  }
}

export function loadLocalStudentFacilities(campusId?: string): Facility[] {
  try {
    const raw = localStorage.getItem(LOCAL_FACILITIES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Facility[];
    return campusId ? list.filter((f) => f.campusId === campusId) : list;
  } catch {
    return [];
  }
}

function saveLocalStudentFacilities(facilities: Facility[]): void {
  try {
    localStorage.setItem(LOCAL_FACILITIES_KEY, JSON.stringify(facilities));
  } catch {
    // ignore
  }
}

export function loadPinOverrides(): Record<string, PinOverride> {
  try {
    const raw = localStorage.getItem(PIN_OVERRIDES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PinOverride>;
  } catch {
    return {};
  }
}

// --- Firestore Snapshot Parsers ---
function docToFacility(data: Record<string, unknown>, docId: string): Facility {
  return {
    id: String(data.id ?? docId),
    name: String(data.name ?? 'Unnamed Facility'),
    category: (data.category as FacilityCategory) ?? 'other',
    building: typeof data.building === 'string' ? data.building : undefined,
    floor: typeof data.floor === 'string' ? data.floor : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    lat: Number(data.lat ?? 0),
    lon: Number(data.lon ?? 0),
    campusId: typeof data.campusId === 'string' ? data.campusId : undefined,
    campusName: typeof data.campusName === 'string' ? data.campusName : undefined,
    scope:
      data.scope === 'inside_campus' || data.scope === 'nearby_campus'
        ? data.scope
        : 'uncertain',
    isStudentAdded: Boolean(data.isStudentAdded ?? true),
    isApproximateLocation: Boolean(data.isApproximateLocation ?? true),
    verified: Boolean(data.verified ?? false),
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToPinOverride(data: Record<string, unknown>, docId: string): PinOverride {
  return {
    facilityId: String(data.facilityId ?? docId),
    lat: Number(data.lat ?? 0),
    lon: Number(data.lon ?? 0),
    verified: Boolean(data.verified ?? false),
    isApproximateLocation: Boolean(data.isApproximateLocation ?? !data.verified),
    updatedAt: timestampToIso(data.updatedAt),
    updatedBy: String(data.updatedBy ?? ''),
  };
}

function docToStatusReport(data: Record<string, unknown>, docId: string): StatusReport {
  return {
    id: String(data.id ?? docId),
    facilityId: String(data.facilityId ?? ''),
    facilityName: String(data.facilityName ?? 'Campus Location'),
    facilityCategory: (data.facilityCategory as FacilityCategory) ?? 'other',
    campusId: typeof data.campusId === 'string' ? data.campusId : undefined,
    building: typeof data.building === 'string' ? data.building : undefined,
    floor: typeof data.floor === 'string' ? data.floor : undefined,
    statusValue: String(data.statusValue ?? 'Unknown'),
    secondaryValue: typeof data.secondaryValue === 'string' ? data.secondaryValue : undefined,
    seatingValue: typeof data.seatingValue === 'string' ? data.seatingValue : undefined,
    freePointsCount:
      typeof data.freePointsCount === 'number' ? data.freePointsCount : undefined,
    totalPointsCount:
      typeof data.totalPointsCount === 'number' ? data.totalPointsCount : undefined,
    note: typeof data.note === 'string' ? data.note : undefined,
    reporterId: String(data.reporterId ?? ''),
    reporterLabel: typeof data.reporterLabel === 'string' ? data.reporterLabel : undefined,
    createdAt: timestampToIso(data.createdAt),
    confirmations: typeof data.confirmations === 'number' ? data.confirmations : 0,
    confirmedBy: Array.isArray(data.confirmedBy)
      ? data.confirmedBy.map((x) => String(x))
      : [],
    isLocalDemo: false,
  };
}

// --- Shared Cloud Fetch + Real-Time Subscriptions ---
export async function fetchSharedCampusData(): Promise<{
  facilities: Facility[];
  pinOverrides: Record<string, PinOverride>;
  reports: StatusReport[];
}> {
  if (!hasValidFirebaseConfig()) {
    return {
      facilities: loadLocalStudentFacilities(),
      pinOverrides: loadPinOverrides(),
      reports: loadLocalReports(),
    };
  }

  let facilities: Facility[] = [];
  let pinOverrides: Record<string, PinOverride> = {};
  let reports: StatusReport[] = [];

  try {
    const facSnap = await getDocsFromServer(
      query(collection(db, 'facilities'), orderBy('createdAt', 'desc'), limit(250))
    );
    facilities = facSnap.docs.map((d) => docToFacility(d.data(), d.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!msg.includes('offline') && !msg.includes('unavailable')) {
      handleFirestoreError(err, OperationType.LIST, 'facilities');
    }
    throw err;
  }

  try {
    const pinSnap = await getDocsFromServer(query(collection(db, 'pinOverrides'), limit(300)));
    const nextMap: Record<string, PinOverride> = {};
    for (const d of pinSnap.docs) {
      const ov = docToPinOverride(d.data(), d.id);
      nextMap[ov.facilityId] = ov;
    }
    pinOverrides = nextMap;
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!msg.includes('offline') && !msg.includes('unavailable')) {
      handleFirestoreError(err, OperationType.LIST, 'pinOverrides');
    }
    throw err;
  }

  try {
    const repSnap = await getDocsFromServer(
      query(collection(db, 'statusReports'), orderBy('createdAt', 'desc'), limit(400))
    );
    reports = repSnap.docs.map((d) => docToStatusReport(d.data(), d.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (!msg.includes('offline') && !msg.includes('unavailable')) {
      handleFirestoreError(err, OperationType.LIST, 'statusReports');
    }
    throw err;
  }

  return { facilities, pinOverrides, reports };
}

export interface SharedSyncCallbacks {
  onFacilities: (facilities: Facility[]) => void;
  onPinOverrides: (overrides: Record<string, PinOverride>) => void;
  onReports: (reports: StatusReport[]) => void;
  onSyncOnline: () => void;
  onSyncOffline: (reason: string) => void;
}

export function subscribeToSharedCampusData(callbacks: SharedSyncCallbacks): () => void {
  if (!hasValidFirebaseConfig()) {
    return () => {};
  }

  const handleListenerError = (err: unknown, path: string) => {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (
      lower.includes('offline') ||
      lower.includes('unavailable') ||
      lower.includes('network')
    ) {
      callbacks.onSyncOffline(msg);
      return;
    }
    handleFirestoreError(err, OperationType.LIST, path);
  };

  const unsubFacilities = onSnapshot(
    query(collection(db, 'facilities'), orderBy('createdAt', 'desc'), limit(250)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        callbacks.onSyncOnline();
      }
      const list = snapshot.docs.map((d) => docToFacility(d.data(), d.id));
      callbacks.onFacilities(list);
    },
    (err) => handleListenerError(err, 'facilities')
  );

  const unsubPins = onSnapshot(
    query(collection(db, 'pinOverrides'), limit(300)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        callbacks.onSyncOnline();
      }
      const map: Record<string, PinOverride> = {};
      for (const d of snapshot.docs) {
        const ov = docToPinOverride(d.data(), d.id);
        map[ov.facilityId] = ov;
      }
      callbacks.onPinOverrides(map);
    },
    (err) => handleListenerError(err, 'pinOverrides')
  );

  const unsubReports = onSnapshot(
    query(collection(db, 'statusReports'), orderBy('createdAt', 'desc'), limit(400)),
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        callbacks.onSyncOnline();
      }
      const list = snapshot.docs.map((d) => docToStatusReport(d.data(), d.id));
      callbacks.onReports(list);
    },
    (err) => handleListenerError(err, 'statusReports')
  );

  return () => {
    unsubFacilities();
    unsubPins();
    unsubReports();
  };
}

async function ensureWriterUid(): Promise<{
  uid?: string;
  error?: string;
  authRequired?: boolean;
}> {
  if (auth.currentUser?.uid) {
    return { uid: auth.currentUser.uid };
  }
  const anonRes = await tryAnonymousSignIn();
  if (anonRes.ok && auth.currentUser?.uid) {
    return { uid: auth.currentUser.uid };
  }
  return {
    authRequired: true,
    error: anonRes.anonymousDisabled
      ? 'Sign in with Google to submit shared reports (or enable Anonymous Auth in Firebase Console).'
      : anonRes.error || 'Authentication required before writing to shared database.',
  };
}

export async function savePinPositionAdjustment(params: {
  facilityId: string;
  lat: number;
  lon: number;
  markVerified: boolean;
}): Promise<{ override?: PinOverride; error?: string; authRequired?: boolean }> {
  const safeId = sanitizeFirestoreId(params.facilityId);

  if (!hasValidFirebaseConfig()) {
    const overrides = loadPinOverrides();
    const next: PinOverride = {
      facilityId: safeId,
      lat: params.lat,
      lon: params.lon,
      verified: params.markVerified,
      isApproximateLocation: !params.markVerified,
      updatedAt: new Date().toISOString(),
      updatedBy: getAnonymousReporterId(),
    };
    overrides[safeId] = next;
    try {
      localStorage.setItem(PIN_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch {
      // ignore
    }
    return { override: next };
  }

  const authCheck = await ensureWriterUid();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  const ref = doc(db, 'pinOverrides', safeId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        lat: params.lat,
        lon: params.lon,
        verified: params.markVerified,
        isApproximateLocation: !params.markVerified,
        updatedBy: authCheck.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        facilityId: safeId,
        lat: params.lat,
        lon: params.lon,
        verified: params.markVerified,
        isApproximateLocation: !params.markVerified,
        updatedBy: authCheck.uid,
        updatedAt: serverTimestamp(),
      });
    }
    return {
      override: {
        facilityId: safeId,
        lat: params.lat,
        lon: params.lon,
        verified: params.markVerified,
        isApproximateLocation: !params.markVerified,
        updatedAt: new Date().toISOString(),
        updatedBy: authCheck.uid,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return { error: 'You are currently offline. Pin adjustment could not sync to Firestore.' };
    }
    handleFirestoreError(err, OperationType.WRITE, `pinOverrides/${safeId}`);
  }
}

export interface SubmitReportPayload {
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
}

export async function submitStatusReport(
  payload: SubmitReportPayload
): Promise<{ report?: StatusReport; error?: string; authRequired?: boolean }> {
  if (!payload.statusValue.trim()) {
    return { error: 'Please select a status condition.' };
  }
  const cleanNote = payload.note?.trim().slice(0, 280);
  const cleanBuilding = payload.building?.trim().slice(0, 80);
  const cleanFloor = payload.floor?.trim().slice(0, 40);
  const safeFacilityId = sanitizeFirestoreId(payload.facilityId);
  const safeCampusId = payload.campusId ? sanitizeFirestoreId(payload.campusId) : undefined;

  const rate = checkRateLimit(safeFacilityId);
  if (!rate.allowed) {
    return { error: rate.reason };
  }

  if (!hasValidFirebaseConfig()) {
    const newReport: StatusReport = {
      id: `local-${createDocId('rep')}`,
      facilityId: safeFacilityId,
      facilityName: payload.facilityName.trim().slice(0, 120),
      facilityCategory: payload.facilityCategory,
      campusId: safeCampusId,
      building: cleanBuilding || undefined,
      floor: cleanFloor || undefined,
      statusValue: payload.statusValue.trim().slice(0, 80),
      secondaryValue: payload.secondaryValue?.trim().slice(0, 60) || undefined,
      seatingValue: payload.seatingValue?.trim().slice(0, 60) || undefined,
      freePointsCount: payload.freePointsCount,
      totalPointsCount: payload.totalPointsCount,
      note: cleanNote || undefined,
      reporterId: getAnonymousReporterId(),
      reporterLabel: getReporterDisplayLabel(),
      createdAt: new Date().toISOString(),
      confirmations: 0,
      confirmedBy: [],
      isLocalDemo: true,
    };

    const existing = loadLocalReports();
    saveLocalReports([newReport, ...existing]);
    recordRateLimit(safeFacilityId);
    return { report: newReport };
  }

  const authCheck = await ensureWriterUid();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  const reportId = createDocId('rep');
  const reporterLabel = getReporterDisplayLabel().slice(0, 40);

  const docData: Record<string, unknown> = {
    id: reportId,
    facilityId: safeFacilityId,
    facilityName: payload.facilityName.trim().slice(0, 120),
    facilityCategory: payload.facilityCategory,
    statusValue: payload.statusValue.trim().slice(0, 80),
    reporterId: authCheck.uid,
    reporterLabel,
    createdAt: serverTimestamp(),
    confirmations: 0,
    confirmedBy: [],
  };

  if (safeCampusId) docData.campusId = safeCampusId;
  if (cleanBuilding) docData.building = cleanBuilding;
  if (cleanFloor) docData.floor = cleanFloor;
  if (payload.secondaryValue?.trim()) {
    docData.secondaryValue = payload.secondaryValue.trim().slice(0, 60);
  }
  if (payload.seatingValue?.trim()) {
    docData.seatingValue = payload.seatingValue.trim().slice(0, 60);
  }
  if (typeof payload.freePointsCount === 'number' && Number.isInteger(payload.freePointsCount)) {
    docData.freePointsCount = Math.max(0, Math.min(200, payload.freePointsCount));
  }
  if (typeof payload.totalPointsCount === 'number' && Number.isInteger(payload.totalPointsCount)) {
    docData.totalPointsCount = Math.max(1, Math.min(200, payload.totalPointsCount));
  }
  if (cleanNote) {
    docData.note = cleanNote;
  }

  try {
    await setDoc(doc(db, 'statusReports', reportId), docData);
    recordRateLimit(safeFacilityId);
    const localMirror: StatusReport = {
      id: reportId,
      facilityId: safeFacilityId,
      facilityName: String(docData.facilityName),
      facilityCategory: payload.facilityCategory,
      campusId: safeCampusId,
      building: cleanBuilding || undefined,
      floor: cleanFloor || undefined,
      statusValue: String(docData.statusValue),
      secondaryValue: docData.secondaryValue as string | undefined,
      seatingValue: docData.seatingValue as string | undefined,
      freePointsCount: docData.freePointsCount as number | undefined,
      totalPointsCount: docData.totalPointsCount as number | undefined,
      note: cleanNote || undefined,
      reporterId: authCheck.uid,
      reporterLabel,
      createdAt: new Date().toISOString(),
      confirmations: 0,
      confirmedBy: [],
      isLocalDemo: false,
    };
    return { report: localMirror };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return {
        error: 'Network offline — report was NOT saved to shared Firestore. Reconnect and try again.',
      };
    }
    handleFirestoreError(err, OperationType.CREATE, `statusReports/${reportId}`);
  }
}

/**
 * Confirms an existing report WITHOUT modifying its createdAt timestamp
 * (so confirmations never artificially extend expiration).
 */
export async function confirmStatusReport(
  report: StatusReport
): Promise<{ updated?: StatusReport; error?: string; authRequired?: boolean }> {
  if (!hasValidFirebaseConfig()) {
    const reporterId = getAnonymousReporterId();
    if (report.confirmedBy.includes(reporterId)) {
      return { error: 'You already confirmed this observation.' };
    }

    const existing = loadLocalReports();
    const updatedReport: StatusReport = {
      ...report,
      confirmations: report.confirmations + 1,
      confirmedBy: [...report.confirmedBy, reporterId],
    };
    saveLocalReports(existing.map((r) => (r.id === report.id ? updatedReport : r)));
    return { updated: updatedReport };
  }

  const authCheck = await ensureWriterUid();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  if (report.confirmedBy.includes(authCheck.uid)) {
    return { error: 'You already confirmed this observation.' };
  }

  if (report.confirmedBy.length >= 100) {
    return { error: 'Confirmation limit reached for this report.' };
  }

  const nextConfirmedBy = [...report.confirmedBy, authCheck.uid];
  const nextConfirmations = report.confirmations + 1;

  try {
    await updateDoc(doc(db, 'statusReports', report.id), {
      confirmations: nextConfirmations,
      confirmedBy: nextConfirmedBy,
    });
    return {
      updated: {
        ...report,
        confirmations: nextConfirmations,
        confirmedBy: nextConfirmedBy,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return { error: 'Network offline — unable to sync confirmation right now.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `statusReports/${report.id}`);
  }
}

export async function addStudentFacility(params: {
  name: string;
  category: FacilityCategory;
  lat: number;
  lon: number;
  campusId?: string;
  campusName?: string;
  building?: string;
  floor?: string;
  note?: string;
}): Promise<{ facility?: Facility; error?: string; authRequired?: boolean }> {
  const cleanName = params.name.trim().slice(0, 120);
  if (cleanName.length < 2) {
    return { error: 'Facility name must be at least 2 characters.' };
  }

  const cleanBuilding = params.building?.trim().slice(0, 80);
  const cleanFloor = params.floor?.trim().slice(0, 40);
  const cleanDesc = params.note?.trim().slice(0, 200);
  const safeCampusId = params.campusId ? sanitizeFirestoreId(params.campusId) : undefined;
  const scope = safeCampusId ? 'inside_campus' : 'uncertain';

  if (!hasValidFirebaseConfig()) {
    const fac: Facility = {
      id: `student-${createDocId('fac')}`,
      name: cleanName,
      building: cleanBuilding || undefined,
      floor: cleanFloor || undefined,
      description: cleanDesc || undefined,
      category: params.category,
      lat: params.lat,
      lon: params.lon,
      campusId: safeCampusId,
      campusName: params.campusName?.trim().slice(0, 140),
      scope,
      isStudentAdded: true,
      isApproximateLocation: true,
      verified: false,
      createdAt: new Date().toISOString(),
    };

    const existing = loadLocalStudentFacilities();
    saveLocalStudentFacilities([fac, ...existing]);
    return { facility: fac };
  }

  const authCheck = await ensureWriterUid();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  const facId = createDocId('fac');
  const docData: Record<string, unknown> = {
    id: facId,
    name: cleanName,
    category: params.category,
    lat: params.lat,
    lon: params.lon,
    scope,
    isStudentAdded: true,
    isApproximateLocation: true,
    verified: false,
    createdBy: authCheck.uid,
    createdAt: serverTimestamp(),
  };

  if (cleanBuilding) docData.building = cleanBuilding;
  if (cleanFloor) docData.floor = cleanFloor;
  if (cleanDesc) docData.description = cleanDesc;
  if (safeCampusId) docData.campusId = safeCampusId;
  if (params.campusName?.trim()) {
    docData.campusName = params.campusName.trim().slice(0, 140);
  }

  try {
    await setDoc(doc(db, 'facilities', facId), docData);
    const fac: Facility = {
      id: facId,
      name: cleanName,
      building: cleanBuilding || undefined,
      floor: cleanFloor || undefined,
      description: cleanDesc || undefined,
      category: params.category,
      lat: params.lat,
      lon: params.lon,
      campusId: safeCampusId,
      campusName: params.campusName?.trim().slice(0, 140),
      scope,
      isStudentAdded: true,
      isApproximateLocation: true,
      verified: false,
      createdBy: authCheck.uid,
      createdAt: new Date().toISOString(),
    };
    return { facility: fac };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('offline') || msg.includes('unavailable')) {
      return {
        error: 'Network offline — place was NOT saved to shared Firestore. Reconnect and try again.',
      };
    }
    handleFirestoreError(err, OperationType.CREATE, `facilities/${facId}`);
  }
}
