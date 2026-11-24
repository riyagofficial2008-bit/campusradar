import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  hasValidFirebaseConfig,
  OperationType,
} from '../firebase';
import type {
  CampusClub,
  CampusEvent,
  EventCategory,
  LostFoundItem,
  MarketplaceCategory,
  MarketplaceCondition,
  MarketplaceListing,
} from '../types/campus';
import {
  createDocId,
  isOfflineError,
  isPermissionDeniedError,
  requireWriterAuth,
  sanitizeId,
  timestampToIso,
} from './firestoreHelpers';
import {
  cleanupUploadedStoragePaths,
  MAX_LOST_FOUND_IMAGES,
  uploadLostFoundImages,
  validateLostFoundImageFile,
} from './storageService';

function docToEvent(data: Record<string, unknown>, id: string): CampusEvent {
  return {
    id: String(data.id ?? id),
    title: String(data.title ?? ''),
    category: (data.category as EventCategory) ?? 'other',
    organizerName: String(data.organizerName ?? ''),
    clubId: typeof data.clubId === 'string' ? data.clubId : undefined,
    locationName: String(data.locationName ?? ''),
    facilityId: typeof data.facilityId === 'string' ? data.facilityId : undefined,
    startIso: String(data.startIso ?? ''),
    endIso: typeof data.endIso === 'string' ? data.endIso : undefined,
    description: String(data.description ?? ''),
    isOfficial: Boolean(data.isOfficial ?? false),
    registrationCount: typeof data.registrationCount === 'number' ? data.registrationCount : 0,
    registeredUids: Array.isArray(data.registeredUids) ? data.registeredUids.map(String) : [],
    createdBy: String(data.createdBy ?? ''),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

function docToClub(data: Record<string, unknown>, id: string): CampusClub {
  return {
    id: String(data.id ?? id),
    name: String(data.name ?? ''),
    category: String(data.category ?? 'General'),
    description: String(data.description ?? ''),
    meetingLocation: typeof data.meetingLocation === 'string' ? data.meetingLocation : undefined,
    memberUids: Array.isArray(data.memberUids) ? data.memberUids.map(String) : [],
    createdBy: String(data.createdBy ?? ''),
    createdAt: timestampToIso(data.createdAt),
  };
}

function docToListing(data: Record<string, unknown>, id: string): MarketplaceListing {
  return {
    id: String(data.id ?? id),
    title: String(data.title ?? ''),
    category: (data.category as MarketplaceCategory) ?? 'other',
    priceInr: Number(data.priceInr ?? 0),
    condition: (data.condition as MarketplaceCondition) ?? 'good',
    description: String(data.description ?? ''),
    pickupSpot: typeof data.pickupSpot === 'string' ? data.pickupSpot : undefined,
    photoDataUrl: typeof data.photoDataUrl === 'string' ? data.photoDataUrl : undefined,
    sellerUid: String(data.sellerUid ?? ''),
    sellerName: String(data.sellerName ?? 'Student'),
    status:
      data.status === 'sold' || data.status === 'removed' ? data.status : 'available',
    reportedBy: Array.isArray(data.reportedBy) ? data.reportedBy.map(String) : [],
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

function docToLostFound(data: Record<string, unknown>, id: string): LostFoundItem {
  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter(
        (u): u is string => typeof u === 'string' && u.startsWith('https://')
      )
    : undefined;

  return {
    id: String(data.id ?? id),
    itemType: data.itemType === 'found' ? 'found' : 'lost',
    title: String(data.title ?? ''),
    building: typeof data.building === 'string' ? data.building : undefined,
    floor: typeof data.floor === 'string' ? data.floor : undefined,
    approximateLocation:
      typeof data.approximateLocation === 'string' ? data.approximateLocation : undefined,
    eventDate: typeof data.eventDate === 'string' ? data.eventDate : undefined,
    description: String(data.description ?? ''),
    imageUrls: imageUrls && imageUrls.length > 0 ? imageUrls : undefined,
    photoDataUrl: typeof data.photoDataUrl === 'string' ? data.photoDataUrl : undefined,
    posterUid: String(data.posterUid ?? ''),
    posterName: String(data.posterName ?? 'Student'),
    status: data.status === 'returned' ? 'returned' : 'open',
    createdAt: timestampToIso(data.createdAt),
    updatedAt: data.updatedAt ? timestampToIso(data.updatedAt) : undefined,
  };
}

export function subscribeCampusLife(callbacks: {
  onEvents: (events: CampusEvent[]) => void;
  onClubs: (clubs: CampusClub[]) => void;
  onListings: (listings: MarketplaceListing[]) => void;
  onLostFound: (items: LostFoundItem[]) => void;
  onPermissionDenied?: () => void;
}): () => void {
  if (!hasValidFirebaseConfig()) return () => {};

  const unsubEvents = onSnapshot(
    query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(200)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onEvents(snap.docs.map((d) => docToEvent(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'events');
    }
  );

  const unsubClubs = onSnapshot(
    query(collection(db, 'clubs'), orderBy('createdAt', 'desc'), limit(150)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onClubs(snap.docs.map((d) => docToClub(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'clubs');
    }
  );

  const unsubListings = onSnapshot(
    query(
      collection(db, 'marketplace_listings'),
      where('status', 'in', ['available', 'sold']),
      limit(200)
    ),
    { includeMetadataChanges: true },
    (snap) => {
      const list = snap.docs.map((d) => docToListing(d.data(), d.id));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callbacks.onListings(list);
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'marketplace_listings');
      }
    }
  );

  const unsubLostFound = onSnapshot(
    query(collection(db, 'lost_found'), orderBy('createdAt', 'desc'), limit(200)),
    { includeMetadataChanges: true },
    (snap) => {
      callbacks.onLostFound(snap.docs.map((d) => docToLostFound(d.data(), d.id)));
    },
    (err) => {
      if (isPermissionDeniedError(err)) {
        callbacks.onPermissionDenied?.();
        return;
      }
      if (!isOfflineError(err)) handleFirestoreError(err, OperationType.LIST, 'lost_found');
    }
  );

  return () => {
    unsubEvents();
    unsubClubs();
    unsubListings();
    unsubLostFound();
  };
}

export async function createCampusEvent(params: {
  title: string;
  category: EventCategory;
  organizerName: string;
  locationName: string;
  facilityId?: string;
  startIso: string;
  endIso?: string;
  description: string;
  isOfficial: boolean;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const title = params.title.trim().slice(0, 120);
  const organizerName = params.organizerName.trim().slice(0, 80);
  const locationName = params.locationName.trim().slice(0, 120);
  const description = params.description.trim().slice(0, 600);

  if (title.length < 3 || organizerName.length < 2 || locationName.length < 2 || description.length < 5) {
    return { error: 'Please complete title, organizer, location, and description.' };
  }

  const id = createDocId('evt');
  const data: Record<string, unknown> = {
    id,
    title,
    category: params.category,
    organizerName,
    locationName,
    startIso: params.startIso.slice(0, 40),
    description,
    isOfficial: Boolean(params.isOfficial),
    registrationCount: 0,
    registeredUids: [],
    createdBy: authCheck.uid,
    createdAt: serverTimestamp(),
  };
  if (params.facilityId?.trim()) data.facilityId = sanitizeId(params.facilityId);
  if (params.endIso?.trim()) data.endIso = params.endIso.trim().slice(0, 40);

  try {
    await setDoc(doc(db, 'events', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — event could not be saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `events/${id}`);
  }
}

export async function toggleEventRegistration(
  event: CampusEvent
): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const uid = authCheck.uid;
  const registered = event.registeredUids.includes(uid);
  const nextUids = registered
    ? event.registeredUids.filter((u) => u !== uid)
    : [...event.registeredUids, uid];

  try {
    await updateDoc(doc(db, 'events', event.id), {
      registeredUids: nextUids,
      registrationCount: nextUids.length,
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — registration not saved.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `events/${event.id}`);
  }
}

export async function createCampusClub(params: {
  name: string;
  category: string;
  description: string;
  meetingLocation?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const name = params.name.trim().slice(0, 100);
  const category = params.category.trim().slice(0, 40);
  const description = params.description.trim().slice(0, 400);
  if (name.length < 2 || category.length < 2 || description.length < 5) {
    return { error: 'Please enter club name, category, and description.' };
  }

  const id = createDocId('club');
  const data: Record<string, unknown> = {
    id,
    name,
    category,
    description,
    memberUids: [authCheck.uid],
    createdBy: authCheck.uid,
    createdAt: serverTimestamp(),
  };
  if (params.meetingLocation?.trim()) {
    data.meetingLocation = params.meetingLocation.trim().slice(0, 120);
  }

  try {
    await setDoc(doc(db, 'clubs', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — club could not be added.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `clubs/${id}`);
  }
}

export async function toggleJoinClub(club: CampusClub): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };

  const uid = authCheck.uid;
  const joined = club.memberUids.includes(uid);
  const nextMembers = joined
    ? club.memberUids.filter((m) => m !== uid)
    : [...club.memberUids, uid];

  try {
    await updateDoc(doc(db, 'clubs', club.id), { memberUids: nextMembers });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — unable to update membership.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `clubs/${club.id}`);
  }
}

export async function createMarketplaceListing(params: {
  title: string;
  category: MarketplaceCategory;
  priceInr: number;
  condition: MarketplaceCondition;
  description: string;
  pickupSpot?: string;
  photoDataUrl?: string;
  sellerName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const title = params.title.trim().slice(0, 120);
  const description = params.description.trim().slice(0, 500);
  const price = Math.max(0, Math.min(100000, Math.round(Number(params.priceInr) || 0)));

  if (title.length < 3 || description.length < 3) {
    return { error: 'Listing title and description must be at least 3 characters.' };
  }

  const id = createDocId('mkt');
  const data: Record<string, unknown> = {
    id,
    title,
    category: params.category,
    priceInr: price,
    condition: params.condition,
    description,
    sellerUid: authCheck.uid,
    sellerName: (params.sellerName?.trim() || authCheck.displayName || 'Student').slice(0, 60),
    status: 'available',
    reportedBy: [],
    createdAt: serverTimestamp(),
  };
  if (params.pickupSpot?.trim()) data.pickupSpot = params.pickupSpot.trim().slice(0, 120);
  if (params.photoDataUrl && params.photoDataUrl.length <= 180000) {
    data.photoDataUrl = params.photoDataUrl;
  }

  try {
    await setDoc(doc(db, 'marketplace_listings', id), data);
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — listing could not be published.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.CREATE, `marketplace_listings/${id}`);
  }
}

export async function markListingStatus(
  listingId: string,
  status: 'sold' | 'removed'
): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };

  try {
    await updateDoc(doc(db, 'marketplace_listings', listingId), {
      status,
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — could not update listing status.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `marketplace_listings/${listingId}`);
  }
}

export async function reportMarketplaceListing(
  listing: MarketplaceListing
): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };
  if (listing.reportedBy.includes(authCheck.uid)) {
    return { error: 'You already reported this listing.' };
  }
  const nextReported = [...listing.reportedBy, authCheck.uid];
  try {
    await updateDoc(doc(db, 'marketplace_listings', listing.id), {
      reportedBy: nextReported,
      status: nextReported.length >= 5 ? 'removed' : listing.status,
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — report could not be submitted.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `marketplace_listings/${listing.id}`);
  }
}

export async function createLostFoundItem(params: {
  itemType: 'lost' | 'found';
  title: string;
  building?: string;
  floor?: string;
  approximateLocation?: string;
  eventDate?: string;
  description: string;
  imageFiles?: File[];
  onUploadProgress?: (progressByIndex: Record<number, number>) => void;
  posterName?: string;
}): Promise<{ error?: string; authRequired?: boolean }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error, authRequired: authCheck.authRequired };

  const title = params.title.trim().slice(0, 120);
  const description = params.description.trim().slice(0, 450);
  if (title.length < 3 || description.length < 3) {
    return { error: 'Object name and description must be at least 3 characters.' };
  }

  const imageFiles = params.imageFiles ?? [];
  if (imageFiles.length > MAX_LOST_FOUND_IMAGES) {
    return { error: `You can upload up to ${MAX_LOST_FOUND_IMAGES} images per notice.` };
  }
  for (const file of imageFiles) {
    const fileError = validateLostFoundImageFile(file);
    if (fileError) return { error: fileError };
  }

  const id = createDocId('lnf');
  let uploadedPaths: string[] = [];
  let imageUrls: string[] = [];

  if (imageFiles.length > 0) {
    const uploadRes = await uploadLostFoundImages({
      uid: authCheck.uid,
      itemId: id,
      files: imageFiles,
      onProgress: params.onUploadProgress,
    });
    if (uploadRes.error) {
      return { error: uploadRes.error };
    }
    uploadedPaths = uploadRes.storagePaths;
    imageUrls = uploadRes.imageUrls;
  }

  const data: Record<string, unknown> = {
    id,
    itemType: params.itemType,
    title,
    description,
    posterUid: authCheck.uid,
    posterName: (params.posterName?.trim() || authCheck.displayName || 'Student').slice(0, 60),
    status: 'open',
    createdAt: serverTimestamp(),
  };
  if (params.building?.trim()) data.building = params.building.trim().slice(0, 80);
  if (params.floor?.trim() && params.floor !== 'Not specified') {
    data.floor = params.floor.trim().slice(0, 40);
  }
  if (params.approximateLocation?.trim()) {
    data.approximateLocation = params.approximateLocation.trim().slice(0, 140);
  }
  if (params.eventDate?.trim()) data.eventDate = params.eventDate.trim().slice(0, 32);
  if (imageUrls.length > 0) data.imageUrls = imageUrls;

  try {
    await setDoc(doc(db, 'lost_found', id), data);
    return {};
  } catch (err) {
    await cleanupUploadedStoragePaths(uploadedPaths);
    if (isOfflineError(err)) return { error: 'Offline — item post could not be saved.' };
    if (isPermissionDeniedError(err)) {
      return {
        error:
          'Firestore permission denied — publish the updated firestore.rules in Firebase Console.',
      };
    }
    handleFirestoreError(err, OperationType.CREATE, `lost_found/${id}`);
  }
}

export async function markLostFoundReturned(itemId: string): Promise<{ error?: string }> {
  const authCheck = await requireWriterAuth();
  if (!authCheck.uid) return { error: authCheck.error };

  try {
    await updateDoc(doc(db, 'lost_found', itemId), {
      status: 'returned',
      updatedAt: serverTimestamp(),
    });
    return {};
  } catch (err) {
    if (isOfflineError(err)) return { error: 'Offline — could not mark returned.' };
    if (isPermissionDeniedError(err)) {
      return { error: 'Firestore permission denied — publish the updated firestore.rules in Firebase Console.' };
    }
    handleFirestoreError(err, OperationType.UPDATE, `lost_found/${itemId}`);
  }
}
