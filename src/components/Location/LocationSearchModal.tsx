import React, { useState, useEffect } from 'react';
import { LocationData } from '../../types/airguard';
import { locationService, GLOBAL_LOCATION_PRESETS } from '../../services/locationService';
import { Search, MapPin, Navigation, X, Loader2, Globe } from 'lucide-react';

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  currentLocation: LocationData;
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectLocation,
  currentLocation,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setErrorMsg(null);
      return;
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setErrorMsg(null);
    const timeout = setTimeout(async () => {
      try {
        const found = await locationService.searchPlaces(query);
        setResults(found);
      } catch (err: any) {
        setErrorMsg('Failed to query locations. Please check internet connection.');
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (loc: LocationData) => {
    onSelectLocation(loc);
    onClose();
  };

  const handleUseGps = async () => {
    setIsDetectingGps(true);
    setErrorMsg(null);
    try {
      const detected = await locationService.getCurrentBrowserLocation();
      handleSelect(detected);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not determine location. Check browser permissions.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[#071A24] border-t sm:border border-[#263238] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[#263238]">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#06B6D4]" />
            <h3 className="text-sm font-bold text-white">Select Monitored City</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar & GPS Trigger */}
        <div className="p-3 space-y-2 bg-[#09212D] border-b border-[#263238]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any global city or district..."
              className="w-full pl-9 pr-8 py-2 bg-[#071A24] border border-[#263238] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06B6D4]"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleUseGps}
            disabled={isDetectingGps}
            className="w-full py-2 px-3 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {isDetectingGps ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5EEAD4]" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#06B6D4]" />
            )}
            <span>Use My Exact GPS Location</span>
          </button>

          {errorMsg && (
            <p className="text-[11px] text-[#EF4444] bg-[#EF4444]/10 p-2 rounded-lg border border-[#EF4444]/20">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Results & Presets List */}
        <div className="p-3 overflow-y-auto flex-1 space-y-3">
          {isSearching && (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#06B6D4]" />
              <span>Querying Open-Meteo Geocoding...</span>
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block px-1">
                Found Locations ({results.length})
              </span>
              <div className="space-y-1">
                {results.map((loc, idx) => {
                  const isSelected =
                    loc.name === currentLocation.name &&
                    Math.abs(loc.latitude - currentLocation.latitude) < 0.01;
                  return (
                    <button
                      key={`${loc.name}-${loc.latitude}-${loc.longitude}-${idx}`}
                      onClick={() => handleSelect(loc)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between border transition-all ${
                        isSelected
                          ? 'bg-[#0F766E]/20 border-[#0F766E] text-white'
                          : 'bg-[#09212D] border-[#263238] text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white truncate">
                            {loc.name}
                            {loc.admin1 && (
                              <span className="text-slate-400 font-normal"> · {loc.admin1}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {loc.country} ({loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°)
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[9px] font-bold text-[#5EEAD4] px-1.5 py-0.5 rounded bg-[#0F766E]/40 shrink-0">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {query.trim().length < 2 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block px-1">
                Popular Cities
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {GLOBAL_LOCATION_PRESETS.map((preset) => {
                  const isSelected = preset.name === currentLocation.name;
                  return (
                    <button
                      key={preset.name}
                      onClick={() => handleSelect(preset)}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-[#0F766E]/20 border-[#0F766E] text-white'
                          : 'bg-[#09212D] border-[#263238] text-slate-200'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{preset.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{preset.country}</div>
                      <div className="text-[9px] font-mono text-[#06B6D4] mt-0.5">
                        {preset.latitude.toFixed(1)}°, {preset.longitude.toFixed(1)}°
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
