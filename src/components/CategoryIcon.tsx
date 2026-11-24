import {
  Activity,
  Banknote,
  BookOpen,
  Building2,
  Bus,
  Car,
  Coffee,
  Droplets,
  FlaskConical,
  Home,
  MapPin,
  ShoppingBag,
  Toilet,
  Trophy,
  Zap,
} from 'lucide-react';
import type { FacilityCategory, MarkerColor } from '../types/campus';

export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: FacilityCategory;
  className?: string;
}) {
  switch (category) {
    case 'cafeteria':
      return <Coffee className={className} />;
    case 'library':
      return <BookOpen className={className} />;
    case 'charging':
      return <Zap className={className} />;
    case 'water':
      return <Droplets className={className} />;
    case 'washroom':
      return <Toilet className={className} />;
    case 'lab':
      return <FlaskConical className={className} />;
    case 'hostel':
      return <Home className={className} />;
    case 'academic':
      return <Building2 className={className} />;
    case 'sports':
      return <Trophy className={className} />;
    case 'parking':
      return <Car className={className} />;
    case 'medical':
      return <Activity className={className} />;
    case 'atm':
      return <Banknote className={className} />;
    case 'bus_stop':
      return <Bus className={className} />;
    case 'shop':
      return <ShoppingBag className={className} />;
    default:
      return <MapPin className={className} />;
  }
}

export function getMarkerHex(color: MarkerColor): {
  bg: string;
  border: string;
  ring: string;
} {
  switch (color) {
    case 'green':
      return { bg: '#16A34A', border: '#14532D', ring: 'rgba(22,163,74,0.22)' };
    case 'yellow':
      return { bg: '#D97706', border: '#78350F', ring: 'rgba(217,119,6,0.22)' };
    case 'red':
      return { bg: '#DC2626', border: '#7F1D1D', ring: 'rgba(220,38,38,0.22)' };
    case 'grey':
    default:
      return { bg: '#64748B', border: '#334155', ring: 'rgba(100,116,139,0.2)' };
  }
}

/**
 * Generates an inline SVG path snippet for Leaflet divIcon markers
 * so each facility category renders a crisp vector icon inside the status-colored pin.
 */
export function getCategorySvgPath(category: FacilityCategory): string {
  switch (category) {
    case 'cafeteria':
      return '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>';
    case 'library':
      return '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>';
    case 'charging':
      return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>';
    case 'water':
      return '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>';
    case 'washroom':
      return '<circle cx="9" cy="6" r="2"/><path d="M7 10h4v6H7z"/><circle cx="16" cy="6" r="2"/><path d="M14 10h4l-1 6h-2z"/>';
    case 'lab':
      return '<path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/>';
    case 'hostel':
      return '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>';
    case 'academic':
      return '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>';
    case 'sports':
      return '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>';
    case 'parking':
      return '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>';
    case 'medical':
      return '<path d="M12 6v12"/><path d="M6 12h12"/>';
    case 'atm':
      return '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>';
    case 'bus_stop':
      return '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>';
    case 'shop':
      return '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>';
    default:
      return '<circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>';
  }
}
