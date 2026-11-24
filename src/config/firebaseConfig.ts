import { ACTIVE_FIREBASE_CONFIG, hasValidFirebaseConfig } from '../firebase';

export const FIREBASE_CONFIG = ACTIVE_FIREBASE_CONFIG;

export function isFirebaseConfigured(): boolean {
  return hasValidFirebaseConfig();
}
