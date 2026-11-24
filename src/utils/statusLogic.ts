import type {
  ComputedFacilityStatus,
  FacilityCategory,
  LiveMapFilter,
  MarkerColor,
  StatusReport,
} from '../types/campus';

export const FLOOR_OPTIONS = [
  'Not specified',
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  'Basement',
  'Outdoor / Open Area',
] as const;

export interface CategoryMeta {
  id: FacilityCategory;
  label: string;
  shortLabel: string;
  expiryMinutes: number;
  expiryLabel: string;
  primaryQuestion: string;
  primaryOptions: {
    value: string;
    color: MarkerColor;
    isIssue?: boolean;
    isCrowded?: boolean;
    isQuiet?: boolean;
    isAvailable?: boolean;
  }[];
  secondaryLabel?: string;
  secondaryOptions?: string[];
  seatingLabel?: string;
  seatingOptions?: string[];
  supportsSocketCounts?: boolean;
}

export const CATEGORY_META: Record<FacilityCategory, CategoryMeta> = {
  academic: {
    id: 'academic',
    label: 'Campus Buildings',
    shortLabel: 'Buildings',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Building accessibility & status',
    primaryOptions: [
      { value: 'Open / Accessible', color: 'green', isQuiet: true, isAvailable: true },
      { value: 'Busy between classes', color: 'yellow', isCrowded: true },
      { value: 'Closed', color: 'red', isIssue: true },
    ],
  },
  cafeteria: {
    id: 'cafeteria',
    label: 'Food & Cafeterias',
    shortLabel: 'Food',
    expiryMinutes: 30,
    expiryLabel: '30 min',
    primaryQuestion: 'How crowded is it right now?',
    primaryOptions: [
      { value: 'Quiet', color: 'green', isQuiet: true, isAvailable: true },
      { value: 'Moderate crowd', color: 'yellow' },
      { value: 'Crowded', color: 'red', isCrowded: true },
      { value: 'Extremely crowded', color: 'red', isCrowded: true },
    ],
    secondaryLabel: 'Queue length',
    secondaryOptions: ['No queue', 'Short queue', 'Long queue'],
    seatingLabel: 'Seating availability',
    seatingOptions: ['Seats available', 'Limited seats', 'No seats'],
  },
  charging: {
    id: 'charging',
    label: 'Charging Points',
    shortLabel: 'Charging',
    expiryMinutes: 20,
    expiryLabel: '20 min',
    primaryQuestion: 'Charging point availability',
    primaryOptions: [
      { value: 'Charging points available', color: 'green', isAvailable: true },
      { value: 'Few points available', color: 'yellow', isAvailable: true },
      { value: 'All occupied', color: 'red', isCrowded: true },
      { value: 'Charging point not working', color: 'red', isIssue: true },
      { value: 'Unable to verify', color: 'grey' },
    ],
    supportsSocketCounts: true,
  },
  water: {
    id: 'water',
    label: 'Water Stations',
    shortLabel: 'Water',
    expiryMinutes: 120,
    expiryLabel: '2 hours',
    primaryQuestion: 'Drinking water station condition',
    primaryOptions: [
      { value: 'Working', color: 'green', isAvailable: true },
      { value: 'Needs cleaning', color: 'yellow', isIssue: true },
      { value: 'Water unavailable', color: 'red', isIssue: true },
      { value: 'Not working', color: 'red', isIssue: true },
      { value: 'Unknown', color: 'grey' },
    ],
  },
  library: {
    id: 'library',
    label: 'Library & Study Areas',
    shortLabel: 'Library',
    expiryMinutes: 30,
    expiryLabel: '30 min',
    primaryQuestion: 'Seat availability',
    primaryOptions: [
      { value: 'Plenty of seats', color: 'green', isQuiet: true, isAvailable: true },
      { value: 'Limited seats', color: 'yellow', isAvailable: true },
      { value: 'Almost full', color: 'yellow', isCrowded: true },
      { value: 'Full', color: 'red', isCrowded: true },
    ],
    secondaryLabel: 'Noise level',
    secondaryOptions: ['Quiet', 'Moderate', 'Noisy'],
  },
  washroom: {
    id: 'washroom',
    label: 'Washrooms',
    shortLabel: 'Washrooms',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Washroom condition',
    primaryOptions: [
      { value: 'Available', color: 'green', isAvailable: true },
      { value: 'Needs cleaning', color: 'yellow', isIssue: true },
      { value: 'Unavailable', color: 'red', isIssue: true },
    ],
  },
  medical: {
    id: 'medical',
    label: 'Medical Center',
    shortLabel: 'Medical',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Medical facility status',
    primaryOptions: [
      { value: 'Available', color: 'green', isAvailable: true },
      { value: 'Busy / Waiting', color: 'yellow', isCrowded: true },
      { value: 'Unavailable', color: 'red', isIssue: true },
    ],
  },
  parking: {
    id: 'parking',
    label: 'Parking',
    shortLabel: 'Parking',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Parking availability',
    primaryOptions: [
      { value: 'Spaces available', color: 'green', isAvailable: true },
      { value: 'Filling up', color: 'yellow' },
      { value: 'Full', color: 'red', isCrowded: true },
      { value: 'Closed', color: 'red', isIssue: true },
    ],
  },
  lab: {
    id: 'lab',
    label: 'Laboratories',
    shortLabel: 'Labs',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Lab availability',
    primaryOptions: [
      { value: 'Available', color: 'green', isAvailable: true },
      { value: 'In use', color: 'yellow' },
      { value: 'Closed', color: 'red', isIssue: true },
    ],
  },
  hostel: {
    id: 'hostel',
    label: 'Hostels',
    shortLabel: 'Hostels',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Current status',
    primaryOptions: [
      { value: 'Open / Normal', color: 'green', isAvailable: true },
      { value: 'Busy', color: 'yellow' },
      { value: 'Restricted / Issue', color: 'red', isIssue: true },
    ],
  },
  sports: {
    id: 'sports',
    label: 'Sports Grounds',
    shortLabel: 'Sports',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Ground availability',
    primaryOptions: [
      { value: 'Open & Free', color: 'green', isAvailable: true },
      { value: 'Partially occupied', color: 'yellow' },
      { value: 'Crowded / Booked', color: 'red', isCrowded: true },
      { value: 'Closed', color: 'red', isIssue: true },
    ],
  },
  atm: {
    id: 'atm',
    label: 'ATM & Banking',
    shortLabel: 'ATM',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'ATM status',
    primaryOptions: [
      { value: 'Working & Cash available', color: 'green', isAvailable: true },
      { value: 'Long queue', color: 'yellow', isCrowded: true },
      { value: 'Out of cash / Not working', color: 'red', isIssue: true },
    ],
  },
  bus_stop: {
    id: 'bus_stop',
    label: 'Bus & Transit Stops',
    shortLabel: 'Bus Stop',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Stop crowd / service',
    primaryOptions: [
      { value: 'Quiet / Normal service', color: 'green', isQuiet: true, isAvailable: true },
      { value: 'Moderate wait', color: 'yellow' },
      { value: 'Crowded / Delayed', color: 'red', isCrowded: true },
    ],
  },
  shop: {
    id: 'shop',
    label: 'Campus Shops',
    shortLabel: 'Shops',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Shop status',
    primaryOptions: [
      { value: 'Open & Quiet', color: 'green', isQuiet: true, isAvailable: true },
      { value: 'Open & Busy', color: 'yellow', isCrowded: true },
      { value: 'Closed', color: 'red', isIssue: true },
    ],
  },
  other: {
    id: 'other',
    label: 'Other Facilities',
    shortLabel: 'Other',
    expiryMinutes: 60,
    expiryLabel: '1 hour',
    primaryQuestion: 'Facility availability & condition',
    primaryOptions: [
      { value: 'Available', color: 'green', isAvailable: true },
      { value: 'Busy / Limited', color: 'yellow' },
      { value: 'Unavailable / Broken', color: 'red', isIssue: true },
    ],
  },
};

export const ALL_CATEGORIES: FacilityCategory[] = [
  'academic',
  'cafeteria',
  'charging',
  'water',
  'library',
  'washroom',
  'medical',
  'parking',
  'lab',
  'hostel',
  'sports',
  'atm',
  'bus_stop',
  'shop',
  'other',
];

export function getExpiryMsForCategory(category: FacilityCategory): number {
  const mins = CATEGORY_META[category]?.expiryMinutes ?? 60;
  return mins * 60 * 1000;
}

export function getOptionMeta(category: FacilityCategory, statusValue: string) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.other;
  return meta.primaryOptions.find((o) => o.value === statusValue);
}

/**
 * Computes honest freshness, confidence, and mixed-report detection.
 * Confirmations never artificially extend a report's expiration timestamp.
 */
export function computeFacilityStatus(
  category: FacilityCategory,
  reportsForFacility: StatusReport[],
  nowMs: number = Date.now()
): ComputedFacilityStatus {
  const sorted = [...reportsForFacility].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return {
      freshness: 'unknown',
      freshnessLabel: 'UNKNOWN',
      markerColor: 'grey',
      primaryLabel: 'Unknown — No student reports yet',
      confidenceLabel: 'No reports',
      isMixed: false,
      agreementSummary: 'No student observations submitted',
      recentReports: [],
      expiredReportsCount: 0,
      recentCount: 0,
    };
  }

  const expiryMs = getExpiryMsForCategory(category);
  const activeReports = sorted.filter(
    (r) => nowMs - new Date(r.createdAt).getTime() <= expiryMs
  );
  const expiredReports = sorted.filter(
    (r) => nowMs - new Date(r.createdAt).getTime() > expiryMs
  );

  if (activeReports.length === 0) {
    const lastExpired = expiredReports[0];
    return {
      freshness: 'stale',
      freshnessLabel: 'STALE',
      markerColor: 'grey',
      primaryLabel: `Stale (${lastExpired.statusValue})`,
      secondaryLabel: buildSecondaryLabel(lastExpired),
      confidenceLabel: 'Low · Report expired',
      isMixed: false,
      agreementSummary: `Last report expired (older than ${CATEGORY_META[category].expiryLabel})`,
      latestReport: lastExpired,
      recentReports: [],
      expiredReportsCount: expiredReports.length,
      recentCount: 0,
    };
  }

  const latest = activeReports[0];
  const latestOpt = getOptionMeta(category, latest.statusValue);

  const distinctStatuses = new Map<string, number>();
  for (const r of activeReports) {
    distinctStatuses.set(r.statusValue, (distinctStatuses.get(r.statusValue) ?? 0) + 1);
  }

  const isMixed = distinctStatuses.size > 1;
  const anyIssueReported = activeReports.some(
    (r) => getOptionMeta(category, r.statusValue)?.isIssue
  );
  const totalConfirmations = activeReports.reduce(
    (acc, r) => acc + (r.confirmations || 0),
    0
  );

  let agreementSummary = '';
  let confidenceLabel = '';

  if (!isMixed) {
    agreementSummary =
      activeReports.length === 1
        ? '1 recent student report'
        : `${activeReports.length} recent reports agree`;

    if (activeReports.length >= 3 || totalConfirmations >= 2) {
      confidenceLabel = 'High confidence';
    } else if (activeReports.length === 2 || totalConfirmations === 1) {
      confidenceLabel = 'Moderate confidence';
    } else {
      confidenceLabel = 'Single observation';
    }
  } else {
    const breakdown = Array.from(distinctStatuses.entries())
      .map(([val, cnt]) => `${cnt}× ${val}`)
      .join(', ');
    agreementSummary = `Mixed reports (${breakdown})`;
    confidenceLabel = 'Conflicting reports';
  }

  if (
    (latest.statusValue === 'Unknown' || latest.statusValue === 'Unable to verify') &&
    !isMixed
  ) {
    return {
      freshness: 'unknown',
      freshnessLabel: 'UNKNOWN',
      markerColor: 'grey',
      primaryLabel: latest.statusValue,
      confidenceLabel: 'Unverified',
      isMixed: false,
      agreementSummary,
      latestReport: latest,
      recentReports: activeReports,
      expiredReportsCount: expiredReports.length,
      recentCount: activeReports.length,
      expiresAtMs: new Date(latest.createdAt).getTime() + expiryMs,
    };
  }

  if (latestOpt?.isIssue) {
    return {
      freshness: 'issue',
      freshnessLabel: 'ISSUE REPORTED',
      markerColor: 'red',
      primaryLabel: isMixed ? 'Mixed reports (Issue flagged)' : latest.statusValue,
      secondaryLabel: buildSecondaryLabel(latest),
      confidenceLabel,
      isMixed,
      agreementSummary,
      latestReport: latest,
      recentReports: activeReports,
      expiredReportsCount: expiredReports.length,
      recentCount: activeReports.length,
      expiresAtMs: new Date(latest.createdAt).getTime() + expiryMs,
    };
  }

  if (isMixed) {
    return {
      freshness: anyIssueReported ? 'issue' : 'live',
      freshnessLabel: anyIssueReported ? 'ISSUE REPORTED' : 'LIVE',
      markerColor: anyIssueReported ? 'red' : 'yellow',
      primaryLabel: 'Mixed reports',
      secondaryLabel: `Latest: ${latest.statusValue}`,
      confidenceLabel,
      isMixed: true,
      agreementSummary,
      latestReport: latest,
      recentReports: activeReports,
      expiredReportsCount: expiredReports.length,
      recentCount: activeReports.length,
      expiresAtMs: new Date(latest.createdAt).getTime() + expiryMs,
    };
  }

  return {
    freshness: 'live',
    freshnessLabel: 'LIVE',
    markerColor: latestOpt?.color ?? 'green',
    primaryLabel: latest.statusValue,
    secondaryLabel: buildSecondaryLabel(latest),
    confidenceLabel,
    isMixed: false,
    agreementSummary,
    latestReport: latest,
    recentReports: activeReports,
    expiredReportsCount: expiredReports.length,
    recentCount: activeReports.length,
    expiresAtMs: new Date(latest.createdAt).getTime() + expiryMs,
  };
}

function buildSecondaryLabel(report: StatusReport): string | undefined {
  const parts: string[] = [];
  if (typeof report.freePointsCount === 'number' && !Number.isNaN(report.freePointsCount)) {
    if (typeof report.totalPointsCount === 'number' && report.totalPointsCount > 0) {
      parts.push(`${report.freePointsCount}/${report.totalPointsCount} sockets free`);
    } else {
      parts.push(
        `${report.freePointsCount} socket${report.freePointsCount === 1 ? '' : 's'} free`
      );
    }
  }
  if (report.secondaryValue) parts.push(report.secondaryValue);
  if (report.seatingValue) parts.push(report.seatingValue);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function matchesLiveMapFilter(
  category: FacilityCategory,
  computed: ComputedFacilityStatus,
  filter: LiveMapFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'unknown') {
    return computed.freshness === 'unknown' || computed.freshness === 'stale';
  }
  if (filter === 'problems') {
    return (
      computed.freshness === 'issue' ||
      computed.recentReports.some((r) => getOptionMeta(category, r.statusValue)?.isIssue)
    );
  }

  if (
    computed.freshness === 'unknown' ||
    computed.freshness === 'stale' ||
    !computed.latestReport
  ) {
    return false;
  }

  const latestVal = computed.latestReport.statusValue;
  const opt = getOptionMeta(category, latestVal);

  switch (filter) {
    case 'crowded':
      return (
        Boolean(opt?.isCrowded) ||
        latestVal === 'Crowded' ||
        latestVal === 'Extremely crowded' ||
        latestVal === 'Full'
      );
    case 'quiet':
      return (
        Boolean(opt?.isQuiet) ||
        latestVal === 'Quiet' ||
        latestVal === 'Plenty of seats' ||
        latestVal === 'Open / Accessible'
      );
    case 'available_charging':
      return (
        category === 'charging' &&
        !computed.isMixed &&
        (latestVal === 'Charging points available' ||
          latestVal === 'Few points available')
      );
    case 'working_water':
      return category === 'water' && !computed.isMixed && latestVal === 'Working';
    case 'available_study':
      return (
        (category === 'library' || category === 'academic') &&
        (latestVal === 'Plenty of seats' ||
          latestVal === 'Limited seats' ||
          latestVal === 'Open / Accessible')
      );
    default:
      return true;
  }
}

export function formatRelativeTime(isoDate: string, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ${diffMin % 60}m ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
