import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  hasValidFirebaseConfig,
  OperationType,
} from '../firebase';
import type {
  AssignmentItem,
  CampusNotification,
  CampusPoll,
  DayOfWeek,
  FeedbackItem,
  SafetyReport,
  TimetableSlot,
} from '../types/campus';
import {
  createDocId,
  isOfflineError,
  isPermissionDeniedError,
  requireWriterAuth,
  sanitizeId,
  timestampToIso,
} from './firestoreHelpers';

function docToTimetable(data: Record<string, unknown>, id: string): TimetableSlot {
  return {
    id: String(data.id ?? id),
    userId: String(data.userId ?? ''),
    dayOfWeek: (data.dayOfWeek as DayOfWeek) ?? 'Mon',
    startTime: String(data.startTime ?? '09:00'),
    endTime: String(data.endTime ?? '10:00'),
    subject: String(data.subject ?? ''),
    building: typeof data.building === 'string' ? data.building : undefined,
    room: typeof data.room === 'string' ? data.room : undefined,
    reminderEnabled: Boolean(data.reminderEnabled ?? true),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToAssignment(data: Record<string, unknown>, id: string): AssignmentItem {
  return {
    id: String(data.id ?? id),
    userId: String(data.userId ?? ''),
    kind: data.kind === 'exam' ? 'exam' : 'assignment',
    title: String(data.title ?? ''),
    course: typeof data.course === 'string' ? data.course : undefined,
    dueDate: String(data.dueDate ?? ''),
    completed: Boolean(data.completed ?? false),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToNotification(data: Record<string, unknown>, id: string): CampusNotification {
  return {
    id: String(data.id ?? id),
    userId: String(data.userId ?? ''),
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    category: (data.category as CampusNotification['category']) ?? 'academic',
    read: Boolean(data.read ?? false),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToFeedback(data: Record<string, unknown>, id: string): FeedbackItem {
  return {
    id: String(data.id ?? id),
    feedbackType: (data.feedbackType as FeedbackItem['feedbackType']) ?? 'anonymous_feedback',
    category: String(data.category ?? 'General'),
    subject: String(data.subject ?? ''),
    details: String(data.details ?? ''),
    building: typeof data.building === 'string' ? data.building : undefined,
    isAnonymous: Boolean(data.isAnonymous ?? true),
    visibility: data.visibility === 'public' ? 'public' : 'private',
    submitterUid: String(data.submitterUid ?? ''),
    status:
      data.status === 'in_review' || data.status === 'resolved'
        ? data.status
        : 'submitted',
    adminResponse: typeof data.adminResponse === 'string' ? data.adminResponse : undefined,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

function docToPoll(data: Record<string, unknown>, id: string): CampusPoll {
  const options = Array.isArray(data.options) ? data.options.map(String) : [];
  const voteCounts = Array.isArray(data.voteCounts)
    ? data.voteCounts.map((n) => Number(n) || 0)
    : options.map(() => 0);
  return {
    id: String(data.id ?? id),
    question: String(data.question ?? ''),
    options,
    voteCounts,
    votedUids: Array.isArray(data.votedUids) ? data.votedUids.map(String) : [],
    createdBy: String(data.createdBy ?? ''),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToSafetyReport(data: Record<string, unknown>, id: string): SafetyReport {
  return {
    id: String(data.id ?? id),
    reportType: data.reportType === 'maintenance' ? 'maintenance' : 'unsafe_location',
    building: typeof data.building === 'string' ? data.building : undefined,
    floor: typeof data.floor === 'string' ? data.floor : undefined,
    locationNote: String(data.locationNote ?? ''),
    description: String(data.description ?? ''),
    severity:
      data.severity === 'high' || data.severity === 'low' ? data.severity : 'medium',
    reporterUid: String(data.reporterUid ?? ''),
    status:
      data.status === 'acknowledged' || data.status === 'resolved' ? data.status : 'open',
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

export function subscribePersonalAcademicsAndNotifications(
  uid: string,
  callbacks: {
    onTimetable: (slots: TimetableSlot[]) => void;
    onAssignments: (items: AssignmentItem[]) => void;
    onNotifications: (list: CampusNotification[]) => void;
    onMyFeedback: (items: FeedbackItem[]) => void;
    onMySafetyReports: (items: SafetyReport[]) => void;
    onPermissionDenied?: () => void;
  }
): () => void {
  if (!hasValidFirebaseConfig() || !uid) return () => {};

  const unsubTimetable = onSnapshot(
    query(collection(db, 'timetables'), where('userId', '==', uid), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToTimetable(d.data(), d.id));
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      callbacks.onTimetable(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'timetables');
    }
  );

  const unsubAssignments = onSnapshot(
    query(collection(db, 'assignments'), where('userId', '==', uid), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToAssignment(d.data(), d.id));
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      callbacks.onAssignments(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'assignments');
    }
  );

  const unsubNotifs = onSnapshot(
    query(collection(db, 'notifications'), where('userId', '==', uid), limit(100)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToNotification(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onNotifications(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'notifications');
    }
  );

  const unsubMyFeedback = onSnapshot(
    query(collection(db, 'feedback'), where('submitterUid', '==', uid), limit(100)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToFeedback(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onMyFeedback(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'feedback');
    }
  );

  const unsubMySafety = onSnapshot(
    query(collection(db, 'safety_reports'), where('reporterUid', '==', uid), limit(100)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToSafetyReport(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onMySafetyReports(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'safety_reports');
    }
  );

  return () => {
    unsubTimetable();
    unsubAssignments();
    unsubNotifs();
    unsubMyFeedback();
    unsubMySafety();
  };
}

export function subscribePublicFeedbackAndPolls(callbacks: {
  onPublicFeedback: (items: FeedbackItem[]) => void;
  onPolls: (polls: CampusPoll[]) => void;
  onPermissionDenied?: () => void;
}): () => void {
  if (!hasValidFirebaseConfig()) return () => {};

  const unsubPublicFeedback = onSnapshot(
    query(collection(db, 'feedback'), where('visibility', '==', 'public'), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToFeedback(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onPublicFeedback(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'feedback');
    }
  );

  const unsubPolls = onSnapshot(
    query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(50)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onPolls(snap.docs.map((d) => docToPoll(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'polls');
    }
  );

  return () => {
    unsubPublicFeedback();
    unsubPolls();
  };
}

export function subscribeAdminModerationQueues(
  isAdmin: boolean,
  callbacks: {
    onAllFeedback: (items: FeedbackItem[]) => void;
    onAllSafetyReports: (items: SafetyReport[]) => void;
    onPermissionDenied?: () => void;
  }
): () => void {
  if (!hasValidFirebaseConfig() || !isAdmin) return () => {};

  const unsubFeedback = onSnapshot(
    query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(200)),
    { includeMetadataChanges: true },
    (snap) => callbacks.onAllFeedback(snap.docs.map((d) => docToFeedback(d.data(), d.id))),
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'feedback');
    }
  );

  const unsubSafety = onSnapshot(
    query(collection(db, 'safety_reports'), orderBy('createdAt', 'desc'), limit(150)),
    { includeMetadataChanges: true },
    (snap) => callbacks.onAllSafetyReports(snap.docs.map((d) => docToSafetyReport(d.data(), d.id))),
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'safety_reports');
    }
  );

  return () => {
    unsubFeedback();
    unsubSafety();
  };
}

export async function addTimetableSlot(params: {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  subject: string;
  building?: string;
  room?: string;
  reminderEnabled: boolean;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const subject = params.subject.trim().slice(0, 100);
  if (!subject) return { error: 'Please enter a subject name.' };

  const id = createDocId('tt');
  const data: Record<string, unknown> = {
    id,
    userId: authCheck.uid,
    dayOfWeek: params.dayOfWeek,
    startTime: params.startTime.slice(0, 16),
    endTime: params.endTime.slice(0, 16),
    subject,
    reminderEnabled: Boolean(params.reminderEnabled),
    createdAt: serverTimestamp(),
  };
  if (params.building?.trim()) data.building = params.building.trim().slice(0, 80);
  if (params.room?.trim()) data.room = params.room.trim().slice(0, 40);

  try {
    await setDoc(doc(db, 'timetables', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — class slot not saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `timetables/${id}`);
  }
}

export async function deleteTimetableSlot(slotId: string): Promise<{ error?: string }> {
  try {
    await deleteDoc(doc(db, 'timetables', slotId));
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — cannot delete class slot.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.DELETE, `timetables/${slotId}`);
  }
}

export async function addAssignmentItem(params: {
  kind: 'assignment' | 'exam';
  title: string;
  course?: string;
  dueDate: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const title = params.title.trim().slice(0, 120);
  if (!title || !params.dueDate.trim()) {
    return { error: 'Please enter a title and due/exam date.' };
  }

  const id = createDocId('asg');
  const data: Record<string, unknown> = {
    id,
    userId: authCheck.uid,
    kind: params.kind,
    title,
    dueDate: params.dueDate.trim().slice(0, 32),
    completed: false,
    createdAt: serverTimestamp(),
  };
  if (params.course?.trim()) data.course = params.course.trim().slice(0, 80);

  try {
    await setDoc(doc(db, 'assignments', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — item not saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `assignments/${id}`);
  }
}

export async function toggleAssignmentCompleted(
  item: AssignmentItem
): Promise<{ error?: string }> {
  try {
    await updateDoc(doc(db, 'assignments', item.id), {
      completed: !item.completed,
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — unable to update.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `assignments/${item.id}`);
  }
}

export async function deleteAssignmentItem(id: string): Promise<{ error?: string }> {
  try {
    await deleteDoc(doc(db, 'assignments', id));
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — cannot delete.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.DELETE, `assignments/${id}`);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', sanitizeId(id)), { read: true });
  } catch {
    // ignore benign error
  }
}

export async function submitFeedback(params: {
  feedbackType: FeedbackItem['feedbackType'];
  category: string;
  subject: string;
  details: string;
  building?: string;
  isAnonymous: boolean;
  visibility: 'public' | 'private';
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const subject = params.subject.trim().slice(0, 120);
  const details = params.details.trim().slice(0, 800);
  if (subject.length < 3 || details.length < 5) {
    return { error: 'Please provide a subject and details (min 5 characters).' };
  }

  const id = createDocId('fb');
  const data: Record<string, unknown> = {
    id,
    feedbackType: params.feedbackType,
    category: params.category.trim().slice(0, 40) || 'General',
    subject,
    details,
    isAnonymous: Boolean(params.isAnonymous),
    visibility: params.visibility,
    submitterUid: authCheck.uid,
    status: 'submitted',
    createdAt: serverTimestamp(),
  };
  if (params.building?.trim()) data.building = params.building.trim().slice(0, 80);

  try {
    await setDoc(doc(db, 'feedback', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — feedback not saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `feedback/${id}`);
  }
}

export async function respondToFeedback(params: {
  feedbackId: string;
  status: FeedbackItem['status'];
  adminResponse: string;
}): Promise<{ error?: string }> {
  try {
    await updateDoc(doc(db, 'feedback', params.feedbackId), {
      status: params.status,
      adminResponse: params.adminResponse.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — response not saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `feedback/${params.feedbackId}`);
  }
}

export async function createCampusPoll(params: {
  question: string;
  options: string[];
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const question = params.question.trim().slice(0, 160);
  const cleanOptions = params.options
    .map((o) => o.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 6);

  if (question.length < 5 || cleanOptions.length < 2) {
    return { error: 'Enter a poll question and at least 2 choices.' };
  }

  const id = createDocId('poll');
  try {
    await setDoc(doc(db, 'polls', id), {
      id,
      question,
      options: cleanOptions,
      voteCounts: cleanOptions.map(() => 0),
      votedUids: [],
      createdBy: authCheck.uid,
      createdAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — poll could not be published.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `polls/${id}`);
  }
}

export async function voteCampusPoll(
  poll: CampusPoll,
  optionIndex: number
): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  if (poll.votedUids.includes(authCheck.uid)) {
    return { error: 'You have already voted in this poll.' };
  }
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return { error: 'Invalid poll option.' };
  }

  const nextCounts = poll.voteCounts.map((c, idx) => (idx === optionIndex ? c + 1 : c));
  const nextVoters = [...poll.votedUids, authCheck.uid];

  try {
    await updateDoc(doc(db, 'polls', poll.id), {
      voteCounts: nextCounts,
      votedUids: nextVoters,
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — vote could not sync.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `polls/${poll.id}`);
  }
}

export async function submitSafetyReport(params: {
  reportType: 'unsafe_location' | 'maintenance';
  building?: string;
  floor?: string;
  locationNote: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const locationNote = params.locationNote.trim().slice(0, 160);
  const description = params.description.trim().slice(0, 600);
  if (locationNote.length < 3 || description.length < 5) {
    return { error: 'Please describe the location and issue clearly.' };
  }

  const id = createDocId('saf');
  const data: Record<string, unknown> = {
    id,
    reportType: params.reportType,
    locationNote,
    description,
    severity: params.severity,
    reporterUid: authCheck.uid,
    status: 'open',
    createdAt: serverTimestamp(),
  };
  if (params.building?.trim()) data.building = params.building.trim().slice(0, 80);
  if (params.floor?.trim() && params.floor !== 'Not specified') {
    data.floor = params.floor.trim().slice(0, 40);
  }

  try {
    await setDoc(doc(db, 'safety_reports', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — report could not be saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `safety_reports/${id}`);
  }
}

export async function updateSafetyReportStatus(
  reportId: string,
  status: SafetyReport['status']
): Promise<{ error?: string }> {
  try {
    await updateDoc(doc(db, 'safety_reports', reportId), {
      status,
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — status update failed.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `safety_reports/${reportId}`);
  }
}
