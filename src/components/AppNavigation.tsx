import {
  Activity,
  Bus,
  Calendar,
  Compass,
  GraduationCap,
  Home,
  LayoutGrid,
  Map as MapIcon,
  MessageSquare,
  Search,
  ShieldAlert,
  ShoppingBag,
  User,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { NavSection, PublicStudentProfile } from '../types/campus';

export interface NavItemConfig {
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
  { id: 'map', label: 'Campus Map', shortLabel: 'Map', icon: MapIcon },
  { id: 'live', label: 'Live Updates', shortLabel: 'Live', icon: Activity },
  { id: 'community', label: 'Student Community', shortLabel: 'Community', icon: Users },
  { id: 'events', label: 'Events & Clubs', shortLabel: 'Events', icon: Calendar },
  { id: 'marketplace', label: 'Marketplace', shortLabel: 'Market', icon: ShoppingBag },
  { id: 'lost_found', label: 'Lost & Found', shortLabel: 'Lost/Found', icon: Search },
  { id: 'academic', label: 'Academic Hub', shortLabel: 'Academic', icon: GraduationCap },
  { id: 'transport', label: 'Transport', shortLabel: 'Transport', icon: Bus },
  { id: 'safety', label: 'Safety & Help', shortLabel: 'Safety', icon: ShieldAlert },
  { id: 'profile', label: 'Profile & Feedback', shortLabel: 'Profile', icon: User },
];

interface AppNavigationProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  unreadNotifications: number;
  liveReportsCount: number;
  profile: PublicStudentProfile | null;
  onOpenFeedback: () => void;
}

export function AppNavigation({
  activeSection,
  onSelectSection,
  unreadNotifications,
  liveReportsCount,
  profile,
  onOpenFeedback,
}: AppNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const mobilePrimary: NavSection[] = ['home', 'map', 'live', 'community'];
  const isMoreActive = !mobilePrimary.includes(activeSection);

  return (
    <>
      {/* Desktop Left Rail */}
      <nav
        aria-label="Primary Campus Navigation"
        className="hidden md:flex flex-col w-[224px] shrink-0 bg-[#090F1D] border-r border-slate-800 h-full select-none"
      >
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-display font-bold text-white truncate">
              JECRC Ecosystem
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Jaipur Campus Super App
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2.5 px-2.5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`w-full h-10 px-3 rounded-lg flex items-center justify-between gap-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-blue-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'live' && liveReportsCount > 0 && (
                  <span className="font-mono text-[11px] text-emerald-400 tabular-nums shrink-0">
                    {liveReportsCount}
                  </span>
                )}
                {item.id === 'profile' && unreadNotifications > 0 && (
                  <span className="font-mono text-[11px] text-violet-300 tabular-nums shrink-0">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-2.5 border-t border-slate-800/80 space-y-2">
          <button
            type="button"
            onClick={onOpenFeedback}
            className="w-full h-9 px-3 rounded-lg bg-[#0F172A] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">Campus Feedback &amp; Polls</span>
          </button>

          {profile && (
            <button
              type="button"
              onClick={() => onSelectSection('profile')}
              className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-800/60 flex items-center gap-2.5 text-left transition-colors"
            >
              {profile.photoDataUrl ? (
                <img
                  src={profile.photoDataUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-blue-300 shrink-0">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-white truncate">
                  {profile.displayName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {profile.department || profile.course || 'JECRC Student'}
                </div>
              </div>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-[475] h-14 bg-[#090F1D]/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 px-1"
      >
        {NAV_ITEMS.filter((i) => mobilePrimary.includes(i.id)).map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onSelectSection(item.id);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full px-1">{item.shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
            moreOpen || isMoreActive
              ? 'text-violet-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile "All 11 Sections" Drawer */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[495] bg-black/70 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="All Campus Sections"
        >
          <div className="bg-[#0B1120] border-t border-slate-800 rounded-t-2xl p-4 pb-6 space-y-3 max-h-[78vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-sm text-white">
                All Campus Sections
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="p-2 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onSelectSection(item.id);
                    }}
                    className={`min-h-[44px] px-3 py-2.5 rounded-lg border text-left flex items-center gap-2.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                        : 'bg-[#0F172A] border-slate-800 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onOpenFeedback();
              }}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-[#0F172A] border border-slate-800 text-xs font-medium text-violet-300 flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Campus Feedback &amp; Student Polls</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
