import {
  AlertCircle,
  CheckCircle2,
  ImageOff,
  ImagePlus,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { hasStorageConfigured } from '../firebase';
import {
  createLostFoundItem,
  markLostFoundReturned,
} from '../services/campusLifeService';
import {
  MAX_LOST_FOUND_IMAGES,
  validateLostFoundImageFile,
} from '../services/storageService';
import type { LostFoundItem } from '../types/campus';
import { FLOOR_OPTIONS, formatRelativeTime } from '../utils/statusLogic';

interface LostFoundViewProps {
  currentUid: string | null;
  myDisplayName?: string;
  items: LostFoundItem[];
  onContactPoster: (posterUid: string, posterName: string, itemTitle: string) => void;
  onAuthRequired: () => void;
  onNotify: (msg: string) => void;
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function LostFoundCard({
  item,
  currentUid,
  onContactPoster,
  onNotify,
}: {
  item: LostFoundItem;
  currentUid: string | null;
  onContactPoster: (posterUid: string, posterName: string, itemTitle: string) => void;
  onNotify: (msg: string) => void;
}) {
  const photos = useMemo(() => {
    if (item.imageUrls && item.imageUrls.length > 0) return item.imageUrls;
    if (item.photoDataUrl) return [item.photoDataUrl];
    return [];
  }, [item.imageUrls, item.photoDataUrl]);

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});

  const safeIndex = activePhotoIndex < photos.length ? activePhotoIndex : 0;
  const activeUrl = photos[safeIndex];
  const isMine = currentUid === item.posterUid;
  const isReturned = item.status === 'returned';

  return (
    <article className="bg-[#0B1120] border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        {photos.length > 0 && (
          <div className="bg-[#0F172A] border-b border-slate-800">
            <div className="relative aspect-[4/3] overflow-hidden">
              {activeUrl && !brokenUrls[activeUrl] ? (
                <img
                  src={activeUrl}
                  alt={`${item.title} photo ${safeIndex + 1}`}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenUrls((prev) => ({ ...prev, [activeUrl]: true }))
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs">
                  <ImageOff className="w-5 h-5" />
                  <span>Image unavailable</span>
                </div>
              )}

              {photos.length > 1 && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[11px] font-medium text-slate-200 tabular-nums">
                  {safeIndex + 1} / {photos.length}
                </div>
              )}
            </div>

            {photos.length > 1 && (
              <div className="flex items-center gap-1.5 p-2 bg-[#080E1B] border-t border-slate-800/80 overflow-x-auto">
                {photos.map((url, idx) => (
                  <button
                    key={`${item.id}_thumb_${idx}`}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    aria-label={`View photo ${idx + 1} of ${item.title}`}
                    className={`w-11 h-11 rounded-md overflow-hidden border shrink-0 transition ${
                      idx === safeIndex
                        ? 'border-blue-500 ring-1 ring-blue-500'
                        : 'border-slate-700 opacity-75 hover:opacity-100'
                    }`}
                  >
                    {!brokenUrls[url] ? (
                      <img
                        src={url}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenUrls((prev) => ({ ...prev, [url]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500">
                        <ImageOff className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-4 space-y-2">
          <div
            className={`text-xs font-semibold ${
              item.itemType === 'lost' ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {item.itemType === 'lost' ? 'LOST ITEM' : 'FOUND ITEM'}
            {isReturned ? ' · RETURNED' : ''}
            {' · '}
            <span className="text-slate-400 font-normal">
              {item.eventDate || formatRelativeTime(item.createdAt)}
            </span>
          </div>
          <h3 className="font-display font-semibold text-sm text-white">
            {item.title}
          </h3>
          <div className="text-xs text-slate-400">
            {item.building || 'Campus area'}
            {item.floor ? ` · ${item.floor}` : ''}
            {item.approximateLocation ? ` · ${item.approximateLocation}` : ''}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {item.description}
          </p>
          <div className="text-[11px] text-slate-400">
            Posted by {item.posterName}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        {isMine ? (
          <button
            type="button"
            disabled={isReturned}
            onClick={async () => {
              const res = await markLostFoundReturned(item.id);
              onNotify(res.error ?? 'Marked as returned!');
            }}
            className="h-9 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-white flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isReturned ? 'Returned' : 'Mark as Returned'}</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isReturned}
            onClick={() =>
              onContactPoster(item.posterUid, item.posterName, item.title)
            }
            className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isReturned ? 'Returned' : 'Contact Poster'}</span>
          </button>
        )}
      </div>
    </article>
  );
}

export function LostFoundView({
  currentUid,
  myDisplayName,
  items,
  onContactPoster,
  onAuthRequired,
  onNotify,
}: LostFoundViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'lost' | 'found'>('all');
  const [showReturned, setShowReturned] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [itemType, setItemType] = useState<'lost' | 'found'>('lost');
  const [title, setTitle] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState<string>('Ground Floor');
  const [approximateLocation, setApproximateLocation] = useState('');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  // Multi-image upload state
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const latestPhotosRef = useRef<PendingPhoto[]>([]);
  latestPhotosRef.current = pendingPhotos;

  useEffect(() => {
    return () => {
      latestPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const clearPendingPhotos = () => {
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setUploadProgress({});
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (!showReturned && it.status === 'returned') return false;
      if (filterType !== 'all' && it.itemType !== filterType) return false;
      if (q) {
        return (
          it.title.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          it.building?.toLowerCase().includes(q) ||
          it.approximateLocation?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filterType, showReturned, search]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;

    setFormError(null);
    const remainingSlots = MAX_LOST_FOUND_IMAGES - pendingPhotos.length;
    if (remainingSlots <= 0) {
      setFormError(`Maximum of ${MAX_LOST_FOUND_IMAGES} images already added.`);
      return;
    }

    const errors: string[] = [];
    const accepted: PendingPhoto[] = [];

    for (const file of selected) {
      if (accepted.length >= remainingSlots) {
        errors.push(`You can upload up to ${MAX_LOST_FOUND_IMAGES} images per post.`);
        break;
      }
      const err = validateLostFoundImageFile(file);
      if (err) {
        errors.push(err);
        continue;
      }
      accepted.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (accepted.length > 0) {
      setPendingPhotos((prev) => [...prev, ...accepted]);
    }
    if (errors.length > 0) {
      setFormError(errors[0]);
      onNotify(errors[0]);
    }
  };

  const handleReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replacingId;
    e.target.value = '';
    setReplacingId(null);
    if (!file || !targetId) return;

    setFormError(null);
    const validationError = validateLostFoundImageFile(file);
    if (validationError) {
      setFormError(validationError);
      onNotify(validationError);
      return;
    }

    setPendingPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id !== targetId) return photo;
        URL.revokeObjectURL(photo.previewUrl);
        return {
          id: photo.id,
          file,
          previewUrl: URL.createObjectURL(file),
        };
      })
    );
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormError(null);
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setUploadProgress({});
    setSubmitting(true);

    try {
      const res = await createLostFoundItem({
        itemType,
        title,
        building,
        floor,
        approximateLocation,
        eventDate,
        description,
        imageFiles: pendingPhotos.map((p) => p.file),
        onUploadProgress: (progressMap) => setUploadProgress(progressMap),
        posterName: myDisplayName,
      });

      if (res.error) {
        setFormError(res.error);
        setUploadProgress({});
        onNotify(res.error);
        if (res.authRequired) onAuthRequired();
        return;
      }

      setTitle('');
      setBuilding('');
      setApproximateLocation('');
      setDescription('');
      clearPendingPhotos();
      setShowForm(false);
      onNotify('Lost & Found notice posted.');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to publish Lost & Found notice. Please try again.';
      setFormError(msg);
      setUploadProgress({});
      onNotify(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const overallUploadPct = useMemo(() => {
    if (pendingPhotos.length === 0) return 0;
    const sum = pendingPhotos.reduce(
      (acc, _, idx) => acc + (uploadProgress[idx] ?? 0),
      0
    );
    return Math.round(sum / pendingPhotos.length);
  }, [pendingPhotos, uploadProgress]);

  const storageReady = hasStorageConfigured();

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#070B14] pb-20 md:pb-8">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl text-white">
              Lost &amp; Found
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Report missing or found belongings by building and floor, and contact posters securely via in-app messages.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Post Lost / Found Item</span>
          </button>
        </div>

        {/* Privacy Warning */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            <strong>Protect sensitive details:</strong> Do not post full ID numbers, bank/ATM card numbers, phone numbers, or clear photos of personal documents. Ask claimants to verify hidden details in private chat before handing over.
          </span>
        </div>

        {/* Controls */}
        <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['all', 'All Notices'],
                ['lost', 'Lost Items'],
                ['found', 'Found Items'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilterType(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  filterType === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0F172A] border border-slate-800 text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 ml-2">
              <input
                type="checkbox"
                checked={showReturned}
                onChange={(e) => setShowReturned(e.target.checked)}
              />
              <span>Show returned</span>
            </label>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bottle, charger, keys, NYB..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
            />
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-[#0B1120] border border-slate-700 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display font-semibold text-sm text-white">
                Report Lost or Found Item
              </h2>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Contact via secure in-app messaging</span>
              </span>
            </div>

            {formError && (
              <div
                role="alert"
                className="bg-rose-950/60 border border-rose-700/70 rounded-lg px-3.5 py-2.5 text-xs text-rose-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Lost or Found
                </label>
                <select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as 'lost' | 'found')}
                  disabled={submitting}
                  className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                >
                  <option value="lost">Lost Item</option>
                  <option value="found">Found Item</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">
                  Object name
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="Object name (e.g. Black USB-C Laptop Charger)"
                  required
                  className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Building
                </label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  disabled={submitting}
                  placeholder="Building (e.g. NYB, KAB, VIB, Cafeteria)"
                  className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Floor
                </label>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  disabled={submitting}
                  className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                >
                  {FLOOR_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  disabled={submitting}
                  className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Approximate location
              </label>
              <input
                type="text"
                value={approximateLocation}
                onChange={(e) => setApproximateLocation(e.target.value)}
                disabled={submitting}
                placeholder="Approximate location (e.g. Outside Room 204 / NBC seating)"
                className="w-full h-10 px-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                placeholder="Color, brand, or distinguishing details (avoid sensitive personal ID numbers)..."
                required
                className="w-full p-3 rounded-lg bg-[#0F172A] border border-slate-700 text-xs text-white"
              />
            </div>

            {/* Object Image Upload Section */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white">
                    Upload a clear photo of the lost or found object so other students can easily recognize it.
                  </p>
                  <ul className="text-[11px] text-slate-400 space-y-0.5 list-disc list-inside">
                    <li>Add a photo of the object.</li>
                    <li>Make sure the object is clearly visible.</li>
                    <li>Avoid including personal or sensitive information.</li>
                    <li>You can upload up to 4 images.</li>
                  </ul>
                  <p className="text-[11px] text-slate-500">
                    Allowed formats: JPG, JPEG, PNG, WEBP · Max 5 MB per image
                  </p>
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    disabled={
                      submitting ||
                      !storageReady ||
                      pendingPhotos.length >= MAX_LOST_FOUND_IMAGES
                    }
                    onClick={() => addPhotoInputRef.current?.click()}
                    className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    <span>+ Add Object Photo</span>
                  </button>
                  <input
                    ref={addPhotoInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleAddFiles}
                    className="sr-only"
                  />
                  <input
                    ref={replacePhotoInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    onChange={handleReplaceFile}
                    className="sr-only"
                  />
                </div>
              </div>

              {!storageReady && (
                <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg px-3 py-2">
                  Firebase Storage bucket is not configured. Add VITE_FIREBASE_STORAGE_BUCKET in your Firebase config to enable object photo uploads.
                </div>
              )}

              {pendingPhotos.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Selected photos ({pendingPhotos.length}/{MAX_LOST_FOUND_IMAGES})
                    </span>
                    {submitting && (
                      <span className="text-blue-300 font-medium tabular-nums">
                        Uploading to Firebase Storage: {overallUploadPct}%
                      </span>
                    )}
                  </div>

                  {submitting && (
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-150"
                        style={{ width: `${overallUploadPct}%` }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {pendingPhotos.map((photo, index) => {
                      const pct = uploadProgress[index] ?? 0;
                      return (
                        <div
                          key={photo.id}
                          className="bg-[#0B1120] border border-slate-700/80 rounded-lg overflow-hidden flex flex-col"
                        >
                          <div className="relative aspect-[4/3] bg-slate-950">
                            <img
                              src={photo.previewUrl}
                              alt={`Object preview ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {submitting && (
                              <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 px-2 py-1">
                                <div className="flex items-center justify-between text-[10px] text-blue-300 tabular-nums mb-0.5">
                                  <span>{pct === 100 ? 'Uploaded' : 'Uploading'}</span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 transition-all duration-150"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="p-2 space-y-1.5">
                            <div
                              className="text-[11px] text-slate-200 truncate"
                              title={photo.file.name}
                            >
                              {photo.file.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {formatFileSize(photo.file.size)}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => {
                                  setReplacingId(photo.id);
                                  replacePhotoInputRef.current?.click();
                                }}
                                className="flex-1 h-7 px-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-[11px] text-slate-200 flex items-center justify-center gap-1"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Replace</span>
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleRemovePhoto(photo.id)}
                                aria-label={`Remove ${photo.file.name}`}
                                className="h-7 px-2 rounded bg-rose-950/60 hover:bg-rose-900/70 disabled:opacity-40 border border-rose-800/50 text-[11px] text-rose-300 flex items-center justify-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-slate-400">
                Claimants and finders contact you through Campus Radar&apos;s private in-app messaging—no phone number is shared publicly.
              </p>
              <div className="flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    clearPendingPhotos();
                    setFormError(null);
                    setShowForm(false);
                  }}
                  className="h-9 px-3.5 rounded-lg border border-slate-700 text-xs text-slate-300 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {submitting
                      ? pendingPhotos.length > 0
                        ? `Uploading & Posting (${overallUploadPct}%)...`
                        : 'Posting...'
                      : 'Post Notice'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Items */}
        {filtered.length === 0 ? (
          <div className="bg-[#0B1120] border border-slate-800 rounded-xl p-10 text-center text-xs text-slate-400">
            No active lost or found notices match this view.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <LostFoundCard
                key={item.id}
                item={item}
                currentUid={currentUid}
                onContactPoster={onContactPoster}
                onNotify={onNotify}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
