import React from 'react';
import { PrimaryNavTab } from '../../types/airguard';
import { Home, MapPin, HeartPulse, TrendingUp, History } from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: PrimaryNavTab;
  onSelectTab: (tab: PrimaryNavTab) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentTab, onSelectTab }) => {
  const tabs: { id: PrimaryNavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'health', label: 'Health', icon: HeartPulse },
    { id: 'forecast', label: 'AI Forecast', icon: TrendingUp },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <nav
      aria-label="Primary Navigation"
      className="shrink-0 z-30 w-full bg-[#071A24] border-b border-[#263238] px-1 py-1 flex items-center justify-between select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all relative min-h-[44px] ${
              isActive
                ? 'text-[#5EEAD4] bg-[#0F766E]/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
            title={tab.label}
          >
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#06B6D4] rounded-full shadow-[0_0_8px_#06B6D4]" />
            )}
            <Icon
              className={`w-4 h-4 mb-0.5 shrink-0 transition-transform ${
                isActive ? 'text-[#06B6D4] scale-110' : 'text-slate-400'
              }`}
            />
            <span
              className={`text-[10px] tracking-tight whitespace-nowrap leading-tight ${
                isActive ? 'text-[#5EEAD4] font-bold' : 'text-slate-400 font-medium'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
