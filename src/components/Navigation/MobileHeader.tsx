import React from 'react';
import { LocationData } from '../../types/airguard';
import { AirGuardLogo } from '../Brand/AirGuardLogo';
import { MapPin, RotateCw, Bell, Settings } from 'lucide-react';

interface MobileHeaderProps {
  activeLocation: LocationData;
  onOpenLocationSearch: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  cacheMinutesRemaining?: number;
  onOpenSettings?: () => void;
  notificationsEnabled?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeLocation,
  onOpenLocationSearch,
  onRefresh,
  isRefreshing,
  cacheMinutesRemaining = 60,
  onOpenSettings,
  notificationsEnabled = true,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#071A24]/95 backdrop-blur-md border-b border-[#263238] select-none">
      {/* Main Mobile App Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2">
          <AirGuardLogo size="sm" showWordmark={true} />
        </div>

        {/* Location Pill & Header Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenLocationSearch}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#0B212D] border border-slate-700/70 text-slate-200 hover:text-white hover:border-[#06B6D4]/60 text-xs font-medium max-w-[120px] sm:max-w-[150px] transition-colors cursor-pointer"
            title="Change active location"
          >
            <MapPin className="w-3 h-3 text-[#06B6D4] shrink-0" />
            <span className="truncate text-[11px] font-semibold">{activeLocation.name}</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-1.5 rounded-full bg-[#0B212D] border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer ${
              isRefreshing ? 'animate-spin text-[#06B6D4]' : ''
            }`}
            title={`Refresh telemetry (${cacheMinutesRemaining}m cache)`}
            aria-label="Refresh data"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-full bg-[#0B212D] border border-slate-700/70 text-slate-300 hover:text-white transition-all cursor-pointer relative"
              title="Settings & AQI Notifications"
              aria-label="Settings and notifications"
            >
              <Bell className="w-3.5 h-3.5" />
              {notificationsEnabled && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#06B6D4] ring-2 ring-[#071A24]" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
