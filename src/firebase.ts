import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  type Firestore,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import firebaseAppletConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function isRealValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    !trimmed.startsWith('YOUR_FIREBASE_') &&
    !trimmed.startsWith('MY_') &&
    trimmed !== 'remixed-project-id'
  );
}

interface ResolvedFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  firestoreDatabaseId: string;
  source: 'env' | 'applet-config';
}

function resolveFirebaseConfig(): ResolvedFirebaseConfig {
  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
  const envDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

  if (
    isRealValue(envApiKey) &&
    isRealValue(envAuthDomain) &&
    isRealValue(envProjectId) &&
    isRealValue(envAppId)
  ) {
    return {
      apiKey: envApiKey.trim(),
      authDomain: envAuthDomain.trim(),
      projectId: envProjectId.trim(),
      storageBucket: isRealValue(envStorageBucket)
        ? envStorageBucket.trim()
        : undefined,
      messagingSenderId: isRealValue(envMessagingSenderId)
        ? envMessagingSenderId.trim()
        : undefined,
      appId: envAppId.trim(),
      firestoreDatabaseId: isRealValue(envDatabaseId)
        ? envDatabaseId.trim()
        : '(default)',
      source: 'env',
    };
  }

  return {
    apiKey: firebaseAppletConfig.apiKey ?? '',
    authDomain: firebaseAppletConfig.authDomain ?? '',
    projectId: firebaseAppletConfig.projectId ?? '',
    storageBucket: firebaseAppletConfig.storageBucket,
    messagingSenderId: firebaseAppletConfig.messagingSenderId,
    appId: firebaseAppletConfig.appId ?? '',
    firestoreDatabaseId: firebaseAppletConfig.firestoreDatabaseId || '(default)',
    source: 'applet-config',
  };
}

const resolvedConfig = resolveFirebaseConfig();

// Public non-secret metadata only (never expose API keys or App IDs in UI)
export const ACTIVE_FIREBASE_CONFIG = {
  projectId: resolvedConfig.projectId,
  authDomain: resolvedConfig.authDomain,
  storageBucket: resolvedConfig.storageBucket,
  firestoreDatabaseId: resolvedConfig.firestoreDatabaseId,
  source: resolvedConfig.source,
};

export function hasValidFirebaseConfig(): boolean {
  return Boolean(
    isRealValue(resolvedConfig.projectId) &&
      isRealValue(resolvedConfig.apiKey) &&
      isRealValue(resolvedConfig.authDomain) &&
      isRealValue(resolvedConfig.appId)
  );
}

const isNewApp = getApps().length === 0;
const app = isNewApp
  ? initializeApp({
      apiKey: resolvedConfig.apiKey,
      authDomain: resolvedConfig.authDomain,
      projectId: resolvedConfig.projectId,
      storageBucket: resolvedConfig.storageBucket,
      messagingSenderId: resolvedConfig.messagingSenderId,
      appId: resolvedConfig.appId,
    })
  : getApp();

function createFirestoreInstance(): Firestore {
  const useNamedDb =
    resolvedConfig.firestoreDatabaseId &&
    resolvedConfig.firestoreDatabaseId !== '(default)';
  try {
    return useNamedDb
      ? initializeFirestore(
          app,
          { experimentalAutoDetectLongPolling: true },
          resolvedConfig.firestoreDatabaseId
        )
      : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    return useNamedDb
      ? getFirestore(app, resolvedConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
}

export const db = createFirestoreInstance();
export const auth = getAuth(app);
export const storage: FirebaseStorage | null = isRealValue(resolvedConfig.storageBucket)
  ? getStorage(app)
  : null;

export function hasStorageConfigured(): boolean {
  return storage !== null;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{
  connected: boolean;
  offline: boolean;
  error?: string;
}> {
  if (!hasValidFirebaseConfig()) {
    return { connected: false, offline: false, error: 'Backend not configured' };
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, offline: false };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    const isOffline =
      lower.includes('the client is offline') ||
      lower.includes('unavailable') ||
      lower.includes('network') ||
      lower.includes('failed to get document because the client is offline') ||
      (typeof navigator !== 'undefined' && !navigator.onLine);
    if (isOffline) {
      console.error('Firestore connection check failed (offline):', msg);
    } else {
      console.error('Firestore connection check failed:', msg);
    }
    return {
      connected: false,
      offline: isOffline,
      error: msg,
    };
  }
}

export async function tryAnonymousSignIn(): Promise<{
  ok: boolean;
  anonymousDisabled?: boolean;
  error?: string;
}> {
  if (auth.currentUser) {
    return { ok: true };
  }
  try {
    await signInAnonymously(auth);
    return { ok: true };
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    const disabled =
      code === 'auth/admin-restricted-operation' ||
      code === 'auth/operation-not-allowed';
    return {
      ok: false,
      anonymousDisabled: disabled,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function signInWithGoogle(): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Google Sign-In cancelled or failed.',
    };
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
