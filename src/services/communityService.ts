import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
  auth,
  db,
  handleFirestoreError,
  hasValidFirebaseConfig,
  OperationType,
} from '../firebase';
import type {
  CommunityPost,
  CommunityPostType,
  DashboardWidgetId,
  DirectMessage,
  DirectMessagePolicy,
  PostComment,
  PrivateUserSettings,
  ProfileVisibility,
  PublicStudentProfile,
  StudyGroup,
  StudyGroupType,
} from '../types/campus';
import {
  createDocId,
  isOfflineError,
  isPermissionDeniedError,
  requireWriterAuth,
  sanitizeId,
  timestampToIso,
} from './firestoreHelpers';

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetId[] = [
  'today_events',
  'upcoming_classes',
  'live_updates',
  'charging_water',
  'crowded_spots',
  'nearby_facilities',
  'community_discussions',
  'announcements_polls',
  'emergency_shortcuts',
];

function docToPublicProfile(data: Record<string, unknown>, id: string): PublicStudentProfile {
  return {
    uid: String(data.uid ?? id),
    displayName: String(data.displayName ?? 'Campus Student'),
    department: typeof data.department === 'string' ? data.department : undefined,
    course: typeof data.course === 'string' ? data.course : undefined,
    year: typeof data.year === 'string' ? data.year : undefined,
    section: typeof data.section === 'string' ? data.section : undefined,
    bio: typeof data.bio === 'string' ? data.bio : undefined,
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
    photoDataUrl: typeof data.photoDataUrl === 'string' ? data.photoDataUrl : undefined,
    visibility:
      data.visibility === 'connections' || data.visibility === 'private'
        ? data.visibility
        : 'campus',
    allowDirectMessages:
      data.allowDirectMessages === 'department' || data.allowDirectMessages === 'none'
        ? data.allowDirectMessages
        : 'everyone',
    isVerifiedOrganizer: Boolean(data.isVerifiedOrganizer ?? false),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function docToPrivateSettings(data: Record<string, unknown>, uid: string): PrivateUserSettings {
  return {
    uid: String(data.uid ?? uid),
    savedEventIds: Array.isArray(data.savedEventIds) ? data.savedEventIds.map(String) : [],
    blockedUids: Array.isArray(data.blockedUids) ? data.blockedUids.map(String) : [],
    dashboardWidgets: Array.isArray(data.dashboardWidgets)
      ? (data.dashboardWidgets.map(String) as DashboardWidgetId[])
      : DEFAULT_DASHBOARD_WIDGETS,
    notifyEvents: Boolean(data.notifyEvents ?? true),
    notifyClasses: Boolean(data.notifyClasses ?? true),
    notifyMessages: Boolean(data.notifyMessages ?? true),
    notifySafety: Boolean(data.notifySafety ?? true),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function docToPost(data: Record<string, unknown>, id: string): CommunityPost {
  return {
    id: String(data.id ?? id),
    postType: (data.postType as CommunityPostType) ?? 'discussion',
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    department: typeof data.department === 'string' ? data.department : undefined,
    resourceUrl: typeof data.resourceUrl === 'string' ? data.resourceUrl : undefined,
    authorUid: String(data.authorUid ?? ''),
    authorName: String(data.authorName ?? 'Student'),
    likedBy: Array.isArray(data.likedBy) ? data.likedBy.map(String) : [],
    likesCount: typeof data.likesCount === 'number' ? data.likesCount : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    reportedBy: Array.isArray(data.reportedBy) ? data.reportedBy.map(String) : [],
    isHidden: Boolean(data.isHidden ?? false),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToComment(data: Record<string, unknown>, id: string): PostComment {
  return {
    id: String(data.id ?? id),
    postId: String(data.postId ?? ''),
    body: String(data.body ?? ''),
    authorUid: String(data.authorUid ?? ''),
    authorName: String(data.authorName ?? 'Student'),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToMessage(data: Record<string, unknown>, id: string): DirectMessage {
  return {
    id: String(data.id ?? id),
    participants: Array.isArray(data.participants) ? data.participants.map(String) : [],
    senderId: String(data.senderId ?? ''),
    senderName: String(data.senderName ?? 'Student'),
    recipientId: String(data.recipientId ?? ''),
    recipientName: String(data.recipientName ?? 'Student'),
    contextLabel: typeof data.contextLabel === 'string' ? data.contextLabel : undefined,
    text: String(data.text ?? ''),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToStudyGroup(data: Record<string, unknown>, id: string): StudyGroup {
  return {
    id: String(data.id ?? id),
    name: String(data.name ?? ''),
    subject: String(data.subject ?? ''),
    groupType: (data.groupType as StudyGroupType) ?? 'study_group',
    description: String(data.description ?? ''),
    meetingSpot: typeof data.meetingSpot === 'string' ? data.meetingSpot : undefined,
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.map(String) : [],
    createdBy: String(data.createdBy ?? ''),
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined,
    createdAt: timestampToIso(data.createdAt),
  };
}

export async function checkUserRoleStatus(
  uid: string,
  email?: string | null
): Promise<{ isAdmin: boolean; isVerifiedOrganizer: boolean }> {
  if (!hasValidFirebaseConfig() || !uid) {
    return { isAdmin: false, isVerifiedOrganizer: false };
  }
  const emailAdmin = email === 'riyagupta859859@gmail.com';
  let adminDoc = false;
  let orgDoc = false;
  try {
    const aSnap = await getDoc(doc(db, 'admins', sanitizeId(uid)));
    adminDoc = aSnap.exists();
  } catch {
    adminDoc = false;
  }
  try {
    const oSnap = await getDoc(doc(db, 'organizers', sanitizeId(uid)));
    orgDoc = oSnap.exists();
  } catch {
    orgDoc = false;
  }
  return {
    isAdmin: emailAdmin || adminDoc,
    isVerifiedOrganizer: emailAdmin || adminDoc || orgDoc,
  };
}

export function subscribePublicDirectory(
  onProfiles: (profiles: PublicStudentProfile[]) => void,
  onError?: (msg: string) => void,
  onPermissionDenied?: () => void
): () => void {
  if (!hasValidFirebaseConfig()) return () => {};
  const q = query(
    collection(db, 'users'),
    where('visibility', '==', 'campus'),
    limit(150)
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToPublicProfile(d.data(), d.id));
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
      onProfiles(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        onPermissionDenied?.();
        return;
      }
      if (isOfflineError(err)) {
        onError?.(err.message);
        return;
      }
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  );
}

export function subscribeMyProfileAndSettings(
  uid: string,
  callbacks: {
    onMyProfile: (profile: PublicStudentProfile | null) => void;
    onMySettings: (settings: PrivateUserSettings | null) => void;
    onPermissionDenied?: () => void;
  }
): () => void {
  if (!hasValidFirebaseConfig() || !uid) return () => {};
  const safeUid = sanitizeId(uid);

  const unsubProfile = onSnapshot(
    doc(db, 'users', safeUid),
    (snap) => {
      callbacks.onMyProfile(snap.exists() ? docToPublicProfile(snap.data(), snap.id) : null);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.GET, `users/${safeUid}`);
      }
    }
  );

  const unsubPrivate = onSnapshot(
    doc(db, 'user_private', safeUid),
    (snap) => {
      callbacks.onMySettings(snap.exists() ? docToPrivateSettings(snap.data(), safeUid) : null);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.GET, `user_private/${safeUid}`);
      }
    }
  );

  return () => {
    unsubProfile();
    unsubPrivate();
  };
}

export async function savePublicProfile(params: {
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
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  const cleanName = params.displayName.trim().slice(0, 60);
  if (cleanName.length < 2) {
    return { error: 'Display name must be at least 2 characters.' };
  }

  const safeUid = sanitizeId(authCheck.uid);
  const ref = doc(db, 'users', safeUid);

  try {
    const existingSnap = await getDoc(ref);
    const payload: Record<string, unknown> = {
      uid: safeUid,
      displayName: cleanName,
      visibility: params.visibility,
      allowDirectMessages: params.allowDirectMessages,
      updatedAt: serverTimestamp(),
    };
    if (params.department?.trim()) payload.department = params.department.trim().slice(0, 80);
    if (params.course?.trim()) payload.course = params.course.trim().slice(0, 80);
    if (params.year?.trim()) payload.year = params.year.trim().slice(0, 24);
    if (params.section?.trim()) payload.section = params.section.trim().slice(0, 24);
    if (params.bio?.trim()) payload.bio = params.bio.trim().slice(0, 240);
    if (params.interests && params.interests.length > 0) {
      payload.interests = params.interests.map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
    }
    if (params.photoDataUrl && params.photoDataUrl.length <= 180000) {
      payload.photoDataUrl = params.photoDataUrl;
    }

    if (existingSnap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        ...payload,
        isVerifiedOrganizer: false,
        createdAt: serverTimestamp(),
      });
    }
    return {};
  } catch (err) {
    if (isOfflineError(err)) {
      return { error: 'Network offline — profile changes could not save right now.' };
    }
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.WRITE, `users/${safeUid}`);
  }
}

export async function savePrivateUserSettings(
  next: Omit<PrivateUserSettings, 'uid' | 'updatedAt'>
): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }
  const safeUid = sanitizeId(authCheck.uid);
  const ref = doc(db, 'user_private', safeUid);
  const payload = {
    uid: safeUid,
    savedEventIds: next.savedEventIds.slice(0, 100),
    blockedUids: next.blockedUids.slice(0, 100),
    dashboardWidgets: next.dashboardWidgets.slice(0, 20),
    notifyEvents: Boolean(next.notifyEvents),
    notifyClasses: Boolean(next.notifyClasses),
    notifyMessages: Boolean(next.notifyMessages),
    notifySafety: Boolean(next.notifySafety),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, payload);
    }
    return {};
  } catch (err) {
    if (isOfflineError(err)) {
      return { error: 'Offline — preferences could not sync to Firestore.' };
    }
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.WRITE, `user_private/${safeUid}`);
  }
}

export function subscribeCommunityFeed(callbacks: {
  onPosts: (posts: CommunityPost[]) => void;
  onComments: (comments: PostComment[]) => void;
  onGroups: (groups: StudyGroup[]) => void;
  onPermissionDenied?: () => void;
}): () => void {
  if (!hasValidFirebaseConfig()) return () => {};

  const unsubPosts = onSnapshot(
    query(collection(db, 'posts'), where('isHidden', '==', false), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToPost(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onPosts(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'posts');
    }
  );

  const unsubComments = onSnapshot(
    query(collection(db, 'comments'), orderBy('createdAt', 'asc'), limit(300)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onComments(snap.docs.map((d) => docToComment(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'comments');
    }
  );

  const unsubGroups = onSnapshot(
    query(collection(db, 'groups'), orderBy('createdAt', 'desc'), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onGroups(snap.docs.map((d) => docToStudyGroup(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'groups');
    }
  );

  return () => {
    unsubPosts();
    unsubComments();
    unsubGroups();
  };
}

export async function createCommunityPost(params: {
  postType: CommunityPostType;
  title: string;
  body: string;
  department?: string;
  resourceUrl?: string;
  authorName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }

  const title = params.title.trim().slice(0, 140);
  const body = params.body.trim().slice(0, 1200);
  if (title.length < 3 || body.length < 3) {
    return { error: 'Title and message must each be at least 3 characters.' };
  }

  const id = createDocId('post');
  const data: Record<string, unknown> = {
    id,
    postType: params.postType,
    title,
    body,
    authorUid: authCheck.uid,
    authorName: (params.authorName?.trim() || authCheck.displayName || 'Student').slice(0, 60),
    likedBy: [],
    likesCount: 0,
    commentsCount: 0,
    reportedBy: [],
    isHidden: false,
    createdAt: serverTimestamp(),
  };
  if (params.department?.trim()) data.department = params.department.trim().slice(0, 80);
  if (params.resourceUrl?.trim()) data.resourceUrl = params.resourceUrl.trim().slice(0, 300);

  try {
    await setDoc(doc(db, 'posts', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — could not publish post.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `posts/${id}`);
  }
}

export async function toggleLikePost(post: CommunityPost): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };

  const uid = authCheck.uid;
  const alreadyLiked = post.likedBy.includes(uid);
  const nextLikedBy = alreadyLiked
    ? post.likedBy.filter((x) => x !== uid)
    : [...post.likedBy, uid];

  try {
    await updateDoc(doc(db, 'posts', post.id), {
      likedBy: nextLikedBy,
      likesCount: nextLikedBy.length,
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — cannot update like right now.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
  }
}

export async function reportCommunityPost(post: CommunityPost): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };
  if (post.reportedBy.includes(authCheck.uid)) {
    return { error: 'You already flagged this post for moderation.' };
  }
  const nextReported = [...post.reportedBy, authCheck.uid];
  try {
    await updateDoc(doc(db, 'posts', post.id), {
      reportedBy: nextReported,
      isHidden: nextReported.length >= 5 ? true : post.isHidden,
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — unable to report post right now.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
  }
}

export async function deleteCommunityPost(postId: string): Promise<{ error?: string }> {
  try {
    await deleteDoc(doc(db, 'posts', postId));
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — cannot delete post.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
  }
}

export async function addPostComment(params: {
  postId: string;
  body: string;
  authorName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }
  const body = params.body.trim().slice(0, 500);
  if (!body) return { error: 'Reply cannot be empty.' };

  const id = createDocId('cmt');
  try {
    await setDoc(doc(db, 'comments', id), {
      id,
      postId: sanitizeId(params.postId),
      body,
      authorUid: authCheck.uid,
      authorName: (params.authorName?.trim() || authCheck.displayName || 'Student').slice(0, 60),
      createdAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — reply not sent.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `comments/${id}`);
  }
}

export async function createStudyGroup(params: {
  name: string;
  subject: string;
  groupType: StudyGroupType;
  description: string;
  meetingSpot?: string;
  creatorName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }
  const name = params.name.trim().slice(0, 100);
  const subject = params.subject.trim().slice(0, 80);
  const description = params.description.trim().slice(0, 400);
  if (name.length < 2 || subject.length < 2 || description.length < 3) {
    return { error: 'Please fill group name, subject, and description.' };
  }

  const id = createDocId('grp');
  const data: Record<string, unknown> = {
    id,
    name,
    subject,
    groupType: params.groupType,
    description,
    memberUids: [authCheck.uid],
    createdBy: authCheck.uid,
    createdByName: (params.creatorName?.trim() || authCheck.displayName || 'Student').slice(0, 60),
    createdAt: serverTimestamp(),
  };
  if (params.meetingSpot?.trim()) data.meetingSpot = params.meetingSpot.trim().slice(0, 120);

  try {
    await setDoc(doc(db, 'groups', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — group could not be created.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `groups/${id}`);
  }
}

export async function toggleJoinStudyGroup(group: StudyGroup): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };
  const uid = authCheck.uid;
  const isMember = group.memberUids.includes(uid);
  const nextMembers = isMember
    ? group.memberUids.filter((m) => m !== uid)
    : [...group.memberUids, uid];

  try {
    await updateDoc(doc(db, 'groups', group.id), { memberUids: nextMembers });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — unable to update group membership.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
  }
}

export function subscribeDirectMessages(
  uid: string,
  onMessages: (msgs: DirectMessage[]) => void,
  onPermissionDenied?: () => void
): () => void {
  if (!hasValidFirebaseConfig() || !uid) return () => {};
  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', uid),
    limit(200)
  );
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToMessage(d.data(), d.id));
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      onMessages(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'messages');
    }
  );
}

export async function sendDirectMessage(params: {
  recipientId: string;
  recipientName: string;
  text: string;
  contextLabel?: string;
  senderName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) {
    return { error: authCheck.error, authRequired: authCheck.authRequired };
  }
  const cleanRecipient = sanitizeId(params.recipientId);
  if (cleanRecipient === authCheck.uid) {
    return { error: 'You cannot send a direct message to yourself.' };
  }
  const cleanText = params.text.trim().slice(0, 800);
  if (!cleanText) return { error: 'Message cannot be empty.' };

  const id = createDocId('msg');
  const senderLabel = (params.senderName?.trim() || authCheck.displayName || 'Student').slice(0, 60);

  const payload: Record<string, unknown> = {
    id,
    participants: [authCheck.uid, cleanRecipient],
    senderId: authCheck.uid,
    senderName: senderLabel,
    recipientId: cleanRecipient,
    recipientName: params.recipientName.trim().slice(0, 60) || 'Student',
    text: cleanText,
    createdAt: serverTimestamp(),
  };
  if (params.contextLabel?.trim()) {
    payload.contextLabel = params.contextLabel.trim().slice(0, 140);
  }

  try {
    await setDoc(doc(db, 'messages', id), payload);
    // Dispatch notification to recipient (best-effort)
    const notifId = createDocId('ntf');
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      userId: cleanRecipient,
      title: `New message from ${senderLabel}`,
      body: cleanText.slice(0, 180),
      category: 'message',
      read: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — message could not be delivered.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `messages/${id}`);
  }
}

export function getActiveUid(): string | null {
  return auth.currentUser?.uid ?? null;
}
