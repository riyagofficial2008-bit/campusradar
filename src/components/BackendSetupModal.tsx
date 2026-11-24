import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ACTIVE_FIREBASE_CONFIG } from '../firebase';
import type { AuthStateInfo, BackendSyncStatus } from '../types/campus';

const FIRESTORE_RULES_SNIPPET = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }

    function isValidId(id) {
      return id is string && id.size() >= 2 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\\\-]+$');
    }
    function isTrustedWriter() {
      return request.auth != null && (
        request.auth.token.firebase.sign_in_provider == 'anonymous' ||
        request.auth.token.email_verified == true
      );
    }

    match /test/connection { allow get: if true; allow list, write: if false; }
    match /facilities/{facilityId} {
      allow get: if isValidId(facilityId);
      allow list: if request.query.limit <= 300;
      allow create, update: if isTrustedWriter() && isValidId(facilityId);
    }
    match /pinOverrides/{facilityId} {
      allow get: if isValidId(facilityId);
      allow list: if request.query.limit <= 300;
      allow create, update: if isTrustedWriter() && isValidId(facilityId);
    }
    match /statusReports/{reportId} {
      allow get: if isValidId(reportId);
      allow list: if request.query.limit <= 500;
      allow create, update: if isTrustedWriter() && isValidId(reportId);
    }
  }
}`;

interface BackendSetupModalProps {
  syncStatus: BackendSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  authState: AuthStateInfo;
  counts: {
    facilities: number;
    reports: number;
    pinOverrides: number;
  };
  onTestConnection: () => void;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

export function BackendSetupModal({
  syncStatus,
  syncError,
  lastSyncedAt,
  authState,
  counts,
  onTestConnection,
  onSignInGoogle,
  onSignOut,
  onClose,
}: BackendSetupModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(FIRESTORE_RULES_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backend-setup-title"
    >
      <div className="bg-[#0F172A] w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl border border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-blue-400" />
            <h2
              id="backend-setup-title"
              className="font-display font-bold text-base text-white"
            >
              Shared Cloud Sync &amp; Firebase Status
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-sm text-slate-300">
          {/* Primary Sync Indicator */}
          {syncStatus === 'connected' ? (
            <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-700/80 text-emerald-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-bold flex items-center gap-2 text-emerald-300">
                  <Cloud className="w-4 h-4" />
                  <span>CLOUD SYNC CONNECTED</span>
                </div>
                <button
                  type="button"
                  onClick={onTestConnection}
                  className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800/70 border border-emerald-700 text-xs font-medium text-emerald-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Verify</span>
                </button>
              </div>
              <p className="text-xs text-emerald-200/90 leading-relaxed">
                Verified connection to shared Cloud Firestore. All student-added facilities, live status reports, confirmations, and pin adjustments sync in real time across every phone and laptop using this URL.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs font-mono text-emerald-300">
                <div>Project: {ACTIVE_FIREBASE_CONFIG.projectId}</div>
                <div className="truncate" title={ACTIVE_FIREBASE_CONFIG.firestoreDatabaseId}>
                  DB: {ACTIVE_FIREBASE_CONFIG.firestoreDatabaseId}
                </div>
                <div className="truncate">
                  Source: {ACTIVE_FIREBASE_CONFIG.source === 'env' ? '.env (VITE_FIREBASE_*)' : 'AI Studio Config'}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-emerald-200 font-mono">
                <span>{counts.facilities} shared student places</span>
                <span>{counts.reports} shared reports</span>
                <span>{counts.pinOverrides} pin edits</span>
                {lastSyncedAt && <span>Verified: {new Date(lastSyncedAt).toLocaleTimeString()}</span>}
              </div>
            </div>
          ) : syncStatus === 'connecting' ? (
            <div className="p-4 rounded-xl bg-blue-950/50 border border-blue-700/80 text-blue-100 space-y-2">
              <div className="font-display font-bold flex items-center gap-2 text-blue-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>CONNECTING TO CLOUD FIRESTORE...</span>
              </div>
              <p className="text-xs text-blue-200/90 leading-relaxed">
                Verifying server connection to project {ACTIVE_FIREBASE_CONFIG.projectId} ({ACTIVE_FIREBASE_CONFIG.firestoreDatabaseId}).
              </p>
            </div>
          ) : syncStatus === 'offline' ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700/80 text-rose-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-bold flex items-center gap-2 text-rose-300">
                  <CloudOff className="w-4 h-4" />
                  <span>OFFLINE — Firestore Unreachable</span>
                </div>
                <button
                  type="button"
                  onClick={onTestConnection}
                  className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800/70 border border-rose-700 text-xs font-medium text-rose-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                Firebase is configured ({ACTIVE_FIREBASE_CONFIG.projectId}), but this device cannot reach Cloud Firestore right now.
              </p>
              {syncError && (
                <p className="text-xs font-mono text-rose-300 bg-rose-950/80 border border-rose-800/70 rounded px-2.5 py-1.5 break-words">
                  {syncError}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-950/45 border border-amber-700/70 text-amber-100 space-y-1.5">
              <div className="font-display font-bold text-amber-300">
                LOCAL DEMO MODE — Backend Not Configured
              </div>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Firebase Firestore is not configured. Reports are stored only in this browser and are <strong>not shared</strong> across phones or laptops.
              </p>
            </div>
          )}

          {/* Writer Authentication Status */}
          {syncStatus !== 'not_configured' && (
            <div className="p-4 rounded-xl bg-[#0B1120] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-display font-semibold text-white text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Reporting Authentication</span>
                </div>
                {authState.uid ? (
                  <span className="text-xs font-mono text-emerald-400">
                    {authState.isAnonymous
                      ? `Anonymous (${authState.uid.slice(0, 6)})`
                      : authState.email || authState.displayName || 'Google Signed In'}
                  </span>
                ) : (
                  <span className="text-xs font-mono text-amber-400">Read-Only Session</span>
                )}
              </div>

              {authState.uid ? (
                <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                  <span>
                    Verified write session active. You can add water/charging stations, submit reports, confirm statuses, and adjust pins across devices.
                  </span>
                  {!authState.isAnonymous && (
                    <button
                      type="button"
                      onClick={onSignOut}
                      className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1 shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {authState.anonymousAuthDisabled
                      ? 'Anonymous Authentication is not enabled yet on Firebase Console for this project. You can sign in with Google right now (takes 1 click) OR enable Anonymous Sign-In in Firebase Console → Authentication → Sign-in method so any student phone can post without logging in.'
                      : 'Sign in with Google or enable Anonymous Authentication to submit shared reports.'}
                  </p>
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign in with Google to Enable Reporting</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Rules Summary */}
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2 bg-[#0B1120] border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-slate-300">
                Active Security Rules Summary (firestore.rules)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 border border-slate-700 rounded hover:bg-slate-700 flex items-center gap-1.5 text-slate-200"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 bg-[#060911] text-slate-200 text-xs font-mono overflow-x-auto max-h-48 leading-relaxed">
              {FIRESTORE_RULES_SNIPPET}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
