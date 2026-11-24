import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
  type StorageError,
} from 'firebase/storage';
import { storage } from '../firebase';

export const MAX_LOST_FOUND_IMAGES = 4;
export const MAX_LOST_FOUND_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function getFileExtension(filename: string): string {
  const clean = filename.trim().toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot) : '';
}

function resolveMimeType(file: File): string {
  const lower = file.type.trim().toLowerCase();
  if (ALLOWED_MIME_TYPES.has(lower)) {
    return lower === 'image/jpg' ? 'image/jpeg' : lower;
  }
  const ext = getFileExtension(file.name);
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

function sanitizeFileName(name: string, index: number): string {
  const ext = getFileExtension(name);
  const validExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
  const baseRaw = name.slice(0, ext ? name.length - ext.length : name.length);
  const safeBase = baseRaw
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${index}_${safeBase || 'object'}${validExt}`;
}

export function validateLostFoundImageFile(file: File): string | null {
  if (!file) return 'No file selected.';
  if (file.size <= 0) {
    return `"${file.name}" is empty and cannot be uploaded.`;
  }
  if (file.size > MAX_LOST_FOUND_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return `"${file.name}" is ${sizeMb} MB. Maximum allowed file size is 5 MB per image.`;
  }
  const lowerType = file.type.trim().toLowerCase();
  const ext = getFileExtension(file.name);
  const hasValidMime = lowerType === '' || ALLOWED_MIME_TYPES.has(lowerType);
  const hasValidExt = ALLOWED_EXTENSIONS.has(ext);
  if (!hasValidMime || !hasValidExt) {
    return `"${file.name}" is not a supported format. Please upload JPG, JPEG, PNG, or WEBP images only.`;
  }
  return null;
}

export function formatStorageError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as StorageError).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'storage/unauthorized') {
    return 'Firebase Storage rejected the upload (storage/unauthorized). Publish storage.rules in Firebase Console and verify your account is signed in.';
  }
  if (code === 'storage/unauthenticated') {
    return 'Please sign in before uploading object photos.';
  }
  if (code === 'storage/canceled') {
    return 'Image upload was canceled before finishing.';
  }
  if (code === 'storage/quota-exceeded') {
    return 'Firebase Storage quota has been exceeded.';
  }
  if (
    code === 'storage/retry-limit-exceeded' ||
    code === 'storage/cannot-slice-blob' ||
    message.toLowerCase().includes('network')
  ) {
    return 'Upload failed due to a network or Storage bucket connection issue. Check your connection and try again.';
  }
  if (code === 'storage/unknown') {
    return 'Firebase Storage upload failed (check Storage bucket setup, storage.rules, and CORS configuration).';
  }
  return `Image upload failed: ${message}`;
}

export async function cleanupUploadedStoragePaths(paths: string[]): Promise<void> {
  if (!storage || paths.length === 0) return;
  const activeStorage = storage;
  await Promise.allSettled(
    paths.map((path) => deleteObject(ref(activeStorage, path)))
  );
}

export async function uploadLostFoundImages(params: {
  uid: string;
  itemId: string;
  files: File[];
  onProgress?: (progressByIndex: Record<number, number>) => void;
}): Promise<{ imageUrls: string[]; storagePaths: string[]; error?: string }> {
  const { uid, itemId, files, onProgress } = params;

  if (files.length === 0) {
    return { imageUrls: [], storagePaths: [] };
  }

  if (files.length > MAX_LOST_FOUND_IMAGES) {
    return {
      imageUrls: [],
      storagePaths: [],
      error: `You can upload up to ${MAX_LOST_FOUND_IMAGES} images per post.`,
    };
  }

  if (!storage) {
    return {
      imageUrls: [],
      storagePaths: [],
      error:
        'Firebase Storage is not configured. Add VITE_FIREBASE_STORAGE_BUCKET in your Firebase configuration.',
    };
  }

  for (const file of files) {
    const validationError = validateLostFoundImageFile(file);
    if (validationError) {
      return { imageUrls: [], storagePaths: [], error: validationError };
    }
  }

  const activeStorage = storage;
  const progressMap: Record<number, number> = {};
  files.forEach((_, idx) => {
    progressMap[idx] = 0;
  });
  onProgress?.({ ...progressMap });

  const uploadedPaths: string[] = [];

  try {
    const results = await Promise.all(
      files.map(
        (file, idx) =>
          new Promise<{ url: string; path: string }>((resolve, reject) => {
            const safeName = sanitizeFileName(file.name, idx);
            const storagePath = `lost_found/${uid}/${itemId}/${safeName}`;
            const storageRef = ref(activeStorage, storagePath);
            const task = uploadBytesResumable(storageRef, file, {
              contentType: resolveMimeType(file),
            });

            task.on(
              'state_changed',
              (snapshot) => {
                const pct =
                  snapshot.totalBytes > 0
                    ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
                    : 0;
                progressMap[idx] = pct;
                onProgress?.({ ...progressMap });
              },
              (err) => {
                reject(err);
              },
              async () => {
                try {
                  uploadedPaths.push(storagePath);
                  const downloadUrl = await getDownloadURL(task.snapshot.ref);
                  progressMap[idx] = 100;
                  onProgress?.({ ...progressMap });
                  resolve({ url: downloadUrl, path: storagePath });
                } catch (urlErr) {
                  reject(urlErr);
                }
              }
            );
          })
      )
    );

    return {
      imageUrls: results.map((r) => r.url),
      storagePaths: results.map((r) => r.path),
    };
  } catch (err) {
    await cleanupUploadedStoragePaths(uploadedPaths);
    return {
      imageUrls: [],
      storagePaths: [],
      error: formatStorageError(err),
    };
  }
}
