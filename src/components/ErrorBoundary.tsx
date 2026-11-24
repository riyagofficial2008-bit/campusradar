import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Campus Radar ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          displayMessage = `${parsed.error} (${parsed.operationType ?? 'operation'} on ${parsed.path ?? 'firestore'})`;
        }
      } catch {
        // non-JSON message
      }

      return (
        <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0F172A] border border-rose-800/70 rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-display font-bold text-lg text-white">
                Sync Error Encountered
              </h1>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed break-words">
              {displayMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Campus Radar</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
