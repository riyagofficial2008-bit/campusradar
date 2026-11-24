import { type Timestamp } from 'firebase/firestore';
import {
  auth,
  hasValidFirebaseConfig,
  tryAnonymousSignIn,
} from '../firebase';

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned.length >= 2 ? cleaned : `id_${Date.now()}`;
}

export function createDocId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function timestampToIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as Timestamp).toDate === 'function'
  ) {
    return (value as Timestamp).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

export async function requireWriterAuth(): Promise<{
  uid?: string;
  displayName?: string;
  error?: string;
  authRequired?: boolean;
}> {
  if (!hasValidFirebaseConfig()) {
    return {
      error: 'Firebase is not configured. Connect Firebase to use shared university features.',
    };
  }
  if (auth.currentUser?.uid) {
    return {
      uid: auth.currentUser.uid,
      displayName:
        auth.currentUser.displayName?.trim() ||
        `Student-${auth.currentUser.uid.slice(0, 4).toUpperCase()}`,
    };
  }
  const anonRes = await tryAnonymousSignIn();
  if (anonRes.ok && auth.currentUser?.uid) {
    return {
      uid: auth.currentUser.uid,
      displayName: `Student-${auth.currentUser.uid.slice(0, 4).toUpperCase()}`,
    };
  }
  return {
    authRequired: true,
    error: anonRes.anonymousDisabled
      ? 'Sign in with Google (top right) to post or message on Campus Radar.'
      : anonRes.error || 'Authentication required to write to Firestore.',
  };
}

export function isOfflineError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('unavailable') ||
    msg.includes('network')
  );
}

export function isPermissionDeniedError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: string }).code).toLowerCase()
      : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return code.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}

