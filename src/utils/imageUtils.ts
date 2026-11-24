/**
 * Compresses user-selected images on the client so photos in Marketplace,
 * Lost & Found, and Student Profiles sync reliably through Firestore documents
 * without exceeding Firestore size limits or requiring Storage CORS setup.
 */
export async function compressImageToDataUrl(
  file: File,
  maxDimension = 540,
  maxChars = 150000
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, or WebP).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Unable to decode image.'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Image processing is unavailable in this browser.');
  }
  ctx.drawImage(img, 0, 0, width, height);

  for (const quality of [0.76, 0.6, 0.45, 0.32]) {
    const out = canvas.toDataURL('image/jpeg', quality);
    if (out.length <= maxChars) {
      return out;
    }
  }

  // Fallback smaller scale if image is very detailed
  const smallCanvas = document.createElement('canvas');
  smallCanvas.width = Math.max(1, Math.round(width * 0.65));
  smallCanvas.height = Math.max(1, Math.round(height * 0.65));
  const sCtx = smallCanvas.getContext('2d');
  if (sCtx) {
    sCtx.drawImage(img, 0, 0, smallCanvas.width, smallCanvas.height);
    const out = smallCanvas.toDataURL('image/jpeg', 0.45);
    if (out.length <= maxChars) return out;
  }

  throw new Error('Image is too large even after compression. Please select a smaller photo.');
}
