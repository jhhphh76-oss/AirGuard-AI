import React from 'react';
import { MapPin, RotateCw, Bell } from 'lucide-react';
import { LocationData } from '../../types/airguard';
import { AirGuardLogo } from '../Brand/AirGuardLogo';
import { RefreshStatus } from '../../services/refreshService';

interface MobileHeaderProps {
  activeLocation: LocationData;
  onOpenLocationSearch: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  refreshStatus?: RefreshStatus;
  cacheMinutesRemaining?: number;
  onOpenSettings?: () => void;
  notificationsEnabled?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeLocation,
  onOpenLocationSearch,
  onRefresh,
  isRefreshing = false,
  refreshStatus = 'idle',
  onOpenSettings,
  notificationsEnabled = false,
}) => {
  const currentStatus: RefreshStatus = isRefreshing ? 'refreshing' : refreshStatus;

  // Visual classes for the compact refresh icon button:
  const getRefreshBtnClass = () => {
    switch (currentStatus) {
      case 'refreshing':
        return 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#5EEAD4] cursor-wait';
      case 'success':
        return 'bg-[#22C55E]/15 border-[#22C55E]/40 text-[#22C55E]';
      case 'failed':
        return 'bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444]';
      case 'idle':
      default:
        return 'bg-[#0B212D] border-slate-700/70 text-slate-300 hover:text-white hover:border-[#06B6D4]/50 cursor-pointer';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#071A24]/95 backdrop-blur-md border-b border-[#263238] select-none">
      {/* Main Mobile App Bar */}
      <div className="px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-2 max-w-7xl mx-auto">
        {/* Brand Logo & Name (shrink-0 so never squished or replaced) */}
        <div className="flex items-center gap-1 shrink-0 min-w-0">
          <AirGuardLogo size="sm" showWordmark={true} />
        </div>

        {/* Location Pill & Header Actions */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          {/* Location button - Responsive, never overflows, full name in title & accessible tooltip */}
          <button
            onClick={onOpenLocationSearch}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-[#0B212D] border border-slate-700/70 text-slate-200 hover:text-white hover:border-[#06B6D4]/60 text-xs font-medium min-w-0 max-w-[90px] xs:max-w-[130px] sm:max-w-[190px] md:max-w-[260px] transition-colors cursor-pointer shrink"
            title={`Active location: ${activeLocation.name}${
              activeLocation.admin1 ? `, ${activeLocation.admin1}` : ''
            }, ${activeLocation.country}. Click to switch location.`}
            aria-label={`Change location, current is ${activeLocation.name}`}
          >
            <MapPin className="w-3 h-3 text-[#06B6D4] shrink-0" />
            <span className="truncate text-[11px] font-semibold">{activeLocation.name}</span>
          </button>

          {/* Action buttons: ALWAYS shrink-0 so they never get pushed outside or clipped */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Dedicated Compact Refresh Icon Button (Requirement 1) */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={currentStatus === 'refreshing'}
              className={`p-1.5 rounded-full border text-xs flex items-center justify-center transition-all shrink-0 ${getRefreshBtnClass()}`}
              title="Refresh air-quality data"
              aria-label="Refresh air-quality data"
            >
              <RotateCw
                className={`w-3.5 h-3.5 transition-transform ${
                  currentStatus === 'refreshing'
                    ? 'animate-spin text-[#06B6D4]'
                    : currentStatus === 'success'
                    ? 'text-[#22C55E]'
                    : currentStatus === 'failed'
                    ? 'text-[#EF4444]'
                    : 'text-slate-300'
                }`}
              />
            </button>

            {/* Bell Icon: Shortcut to Centralized Permissions & Notifications */}
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 rounded-full bg-[#0B212D] border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer relative shrink-0"
                title="Permissions & Notifications Settings"
                aria-label="Permissions and Notifications Settings"
              >
                <Bell className="w-3.5 h-3.5" />
                {notificationsEnabled && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#06B6D4] ring-2 ring-[#071A24]" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
