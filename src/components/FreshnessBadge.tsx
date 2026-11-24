import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import type { FreshnessState, MarkerColor } from '../types/campus';

export function FreshnessIndicator({
  freshness,
  markerColor,
  label,
}: {
  freshness: FreshnessState;
  markerColor: MarkerColor;
  label?: string;
}) {
  const colorText =
    markerColor === 'green'
      ? 'text-emerald-400'
      : markerColor === 'yellow'
        ? 'text-amber-400'
        : markerColor === 'red'
          ? 'text-rose-400'
          : 'text-slate-400';

  const icon = (() => {
    switch (freshness) {
      case 'live':
        return <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${colorText}`} />;
      case 'stale':
        return <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />;
      case 'issue':
        return <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />;
      case 'unknown':
      default:
        return <HelpCircle className="w-3.5 h-3.5 shrink-0 text-slate-400" />;
    }
  })();

  const defaultText =
    freshness === 'live'
      ? 'LIVE'
      : freshness === 'stale'
        ? 'STALE'
        : freshness === 'issue'
          ? 'ISSUE REPORTED'
          : 'UNKNOWN';

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide ${colorText}`}
    >
      {icon}
      <span>{label ?? defaultText}</span>
    </span>
  );
}
