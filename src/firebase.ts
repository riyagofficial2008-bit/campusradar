import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  type Auth,
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

const DISALLOWED_LEGACY_PROJECT =
  typeof atob === 'function' ? atob('Zmx1aWQtYm91bGV2YXJkLXE3Y2Rq') : '';

function isRealValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return (
    !trimmed.startsWith('YOUR_FIREBASE_') &&
    !trimmed.startsWith('MY_') &&
    trimmed !== 'remixed-project-id' &&
    (!DISALLOWED_LEGACY_PROJECT || !trimmed.includes(DISALLOWED_LEGACY_PROJECT))
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
  source: 'env' | 'applet-config' | 'unconfigured';
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

  if (
    isRealValue(firebaseAppletConfig.apiKey) &&
    isRealValue(firebaseAppletConfig.authDomain) &&
    isRealValue(firebaseAppletConfig.projectId) &&
    isRealValue(firebaseAppletConfig.appId)
  ) {
    return {
      apiKey: firebaseAppletConfig.apiKey.trim(),
      authDomain: firebaseAppletConfig.authDomain.trim(),
      projectId: firebaseAppletConfig.projectId.trim(),
      storageBucket: isRealValue(firebaseAppletConfig.storageBucket)
        ? firebaseAppletConfig.storageBucket.trim()
        : undefined,
      messagingSenderId: isRealValue(firebaseAppletConfig.messagingSenderId)
        ? firebaseAppletConfig.messagingSenderId.trim()
        : undefined,
      appId: firebaseAppletConfig.appId.trim(),
      firestoreDatabaseId: isRealValue(firebaseAppletConfig.firestoreDatabaseId)
        ? firebaseAppletConfig.firestoreDatabaseId.trim()
        : '(default)',
      source: 'applet-config',
    };
  }

  return {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: undefined,
    messagingSenderId: undefined,
    appId: '',
    firestoreDatabaseId: '(default)',
    source: 'unconfigured',
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
    resolvedConfig.source !== 'unconfigured' &&
      isRealValue(resolvedConfig.projectId) &&
      isRealValue(resolvedConfig.apiKey) &&
      isRealValue(resolvedConfig.authDomain) &&
      isRealValue(resolvedConfig.appId)
  );
}

const firebaseConfigured = hasValidFirebaseConfig();
const app: FirebaseApp | null = firebaseConfigured
  ? getApps().length === 0
    ? initializeApp({
        apiKey: resolvedConfig.apiKey,
        authDomain: resolvedConfig.authDomain,
        projectId: resolvedConfig.projectId,
        storageBucket: resolvedConfig.storageBucket,
        messagingSenderId: resolvedConfig.messagingSenderId,
        appId: resolvedConfig.appId,
      })
    : getApp()
  : null;

function createFirestoreInstance(): Firestore {
  if (!app) {
    return null as unknown as Firestore;
  }
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

export const db: Firestore = createFirestoreInstance();
export const auth: Auth = app
  ? getAuth(app)
  : ({ currentUser: null } as unknown as Auth);
export const storage: FirebaseStorage | null =
  app && isRealValue(resolvedConfig.storageBucket) ? getStorage(app) : null;

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
  if (!hasValidFirebaseConfig()) {
    return { ok: false, error: 'Firebase is not configured.' };
  }
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
  if (!hasValidFirebaseConfig()) {
    return { ok: false, error: 'Firebase is not configured.' };
  }
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
  if (!hasValidFirebaseConfig()) return;
  await signOut(auth);
}
