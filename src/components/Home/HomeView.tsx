import React from 'react';
import { AQIReading, PrimaryNavTab } from '../../types/airguard';
import {
  MapPin,
  Clock,
  Database,
  Shield,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  HeartPulse,
  History,
  Info,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface HomeViewProps {
  reading: AQIReading | null;
  isLoading: boolean;
  error: string | null;
  onNavigate: (tab: PrimaryNavTab) => void;
  onOpenLocationSearch: () => void;
  onRefresh: () => void;
}

/**
 * Breakpoint-based dynamic positioning helper for US AQI scale (0–500).
 * Interpolates smoothly across the six standard US AQI segments:
 * - AQI 0–50   → track position 0%–16.6%
 * - AQI 51–100 → track position 16.6%–33.3%
 * - AQI 101–150→ track position 33.3%–50%
 * - AQI 151–200→ track position 50%–66.6%
 * - AQI 201–300→ track position 66.6%–83.3%
 * - AQI 301–500→ track position 83.3%–100%
 */
export function calculateAQITrackPosition(aqiValue: number): number {
  if (aqiValue <= 0) return 0;
  if (aqiValue >= 500) return 100;

  if (aqiValue <= 50) {
    return (aqiValue / 50) * 16.6;
  }
  if (aqiValue <= 100) {
    const ratio = (aqiValue - 50) / 50;
    return 16.6 + ratio * (33.3 - 16.6);
  }
  if (aqiValue <= 150) {
    const ratio = (aqiValue - 100) / 50;
    return 33.3 + ratio * (50 - 33.3);
  }
  if (aqiValue <= 200) {
    const ratio = (aqiValue - 150) / 50;
    return 50 + ratio * (66.6 - 50);
  }
  if (aqiValue <= 300) {
    const ratio = (aqiValue - 200) / 100;
    return 66.6 + ratio * (83.3 - 66.6);
  }
  const ratio = (aqiValue - 300) / 200;
  return 83.3 + ratio * (100 - 83.3);
}

export const HomeView: React.FC<HomeViewProps> = ({
  reading,
  isLoading,
  error,
  onNavigate,
  onOpenLocationSearch,
  onRefresh,
}) => {
  if (isLoading && !reading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
        <div className="p-3.5 rounded-2xl bg-[#0F766E]/20 text-[#06B6D4] animate-spin border border-[#0F766E]/40">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Fetching Live Air Telemetry</h3>
        <p className="text-xs text-slate-400">Connecting to Open-Meteo Air Quality Grid...</p>
      </div>
    );
  }

  if (error && !reading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh] text-center space-y-3">
        <div className="p-3.5 rounded-2xl bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-white">Data Connection Interrupted</h3>
        <p className="text-xs text-slate-400 max-w-xs">{error}</p>
        <div className="pt-2 flex flex-col gap-2 w-full max-w-xs">
          <button
            onClick={onRefresh}
            className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0F766E]/80 text-white rounded-xl text-xs font-semibold"
          >
            Retry Sensor Connection
          </button>
          <button
            onClick={onOpenLocationSearch}
            className="w-full py-2.5 bg-[#263238] hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700"
          >
            Switch Monitored City
          </button>
        </div>
      </div>
    );
  }

  if (!reading) return null;

  const { location, aqi, scale, category, categoryColor, categoryBg, categoryBorder, pollutants, indicators } =
    reading;

  const formattedTimestamp = new Date(reading.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const markerPositionPercent = calculateAQITrackPosition(aqi);

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Stale Alert if Latest Fetch Failed */}
      {reading.lastAttemptFailed && (
        <div className="bg-[#F59E0B]/15 border border-[#F59E0B]/30 rounded-xl p-2.5 flex items-center gap-2 text-[11px] text-[#F59E0B]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Using cached verified telemetry from {formattedTimestamp}.</span>
        </div>
      )}

      {/* 1. Main Mobile AQI Gauge Card */}
      <section
        className="rounded-3xl p-5 border shadow-xl relative overflow-hidden flex flex-col items-center text-center space-y-3"
        style={{
          backgroundColor: '#09212D',
          borderColor: categoryBorder,
        }}
      >
        {/* Ambient Glow */}
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ backgroundColor: categoryColor }}
        />

        {/* Top Meta: Location Context & Category */}
        <div className="w-full flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300 truncate max-w-[200px]">
            <MapPin className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
            <span className="truncate">
              {location.name}
              {location.admin1 ? `, ${location.admin1}` : ''}
            </span>
          </div>

          <span
            className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full border"
            style={{
              backgroundColor: categoryBg,
              borderColor: categoryBorder,
              color: categoryColor,
            }}
          >
            {category}
          </span>
        </div>

        {/* Central Radial / Circular Gauge Display */}
        <div className="py-2 flex flex-col items-center justify-center relative">
          <div className="flex items-baseline justify-center">
            <span
              className="text-6xl font-extrabold font-mono tracking-tight tabular-nums"
              style={{ color: categoryColor }}
            >
              {aqi}
            </span>
            <span className="text-xs font-mono text-slate-400 ml-1.5 font-semibold">US AQI</span>
          </div>
          <span className="text-xs font-medium text-slate-300 mt-1 max-w-[280px]">
            {reading.categoryDescription}
          </span>
          <div className="text-[11px] text-slate-400 mt-1">
            Primary driver: <strong className="text-[#06B6D4]">{reading.dominantPollutant}</strong>
          </div>
        </div>

        {/* Visual Scale Meter Bar */}
        <div className="w-full space-y-1.5">
          <div className="relative w-full py-0.5">
            {/* The 6-segment background track */}
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex">
              <div className="h-full bg-[#22C55E]" style={{ width: '16.6%' }} title="0-50 Good" />
              <div className="h-full bg-[#06B6D4]" style={{ width: '16.7%' }} title="51-100 Moderate" />
              <div className="h-full bg-[#F59E0B]" style={{ width: '16.7%' }} title="101-150 USG" />
              <div className="h-full bg-[#EF4444]" style={{ width: '16.6%' }} title="151-200 Unhealthy" />
              <div className="h-full bg-[#A855F7]" style={{ width: '16.7%' }} title="201-300 Very Unhealthy" />
              <div className="h-full bg-[#881337]" style={{ width: '16.7%' }} title="301-500 Hazardous" />
            </div>

            {/* Dynamic Centered White Marker */}
            <div
              className="absolute top-0 bottom-0 w-1.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,1)] z-10 pointer-events-none"
              style={{
                left: `${markerPositionPercent}%`,
                transform: 'translateX(-50%)',
                transition: 'all 300ms ease',
              }}
            />
          </div>

          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>0</span>
            <span>50</span>
            <span>100</span>
            <span>150</span>
            <span>200</span>
            <span>300</span>
            <span>500</span>
          </div>
        </div>

        {/* Footer Subtext */}
        <div className="w-full pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> {formattedTimestamp}
          </span>
          <span className="flex items-center gap-1 font-mono text-slate-400">
            <Database className="w-3 h-3 text-slate-500" /> Open-Meteo
          </span>
        </div>
      </section>

      {/* 2. Pollutants Grid (Mobile 2-Column Touch Layout) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Monitored Pollutants (7)
          </h2>
          <span className="text-[10px] text-slate-500 font-mono">Real-time</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* PM2.5 */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">PM₂.₅</span>
              <span className="text-[9px] font-mono text-[#06B6D4] font-semibold">Fine</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.pm2_5 !== null ? pollutants.pm2_5 : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Combustion aerosols</p>
          </div>

          {/* PM10 */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">PM₁₀</span>
              <span className="text-[9px] font-mono text-slate-400">Coarse</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.pm10 !== null ? pollutants.pm10 : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Inhalable dust</p>
          </div>

          {/* NO2 */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">NO₂</span>
              <span className="text-[9px] font-mono text-slate-400">Traffic</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.no2 !== null ? pollutants.no2 : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Vehicle exhaust</p>
          </div>

          {/* O3 */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">O₃</span>
              <span className="text-[9px] font-mono text-slate-400">Ozone</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.o3 !== null ? pollutants.o3 : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Photochemical smog</p>
          </div>

          {/* CO */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">CO</span>
              <span className="text-[9px] font-mono text-slate-400">Carbon Mono</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.co !== null ? pollutants.co : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Incomplete burning</p>
          </div>

          {/* SO2 */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">SO₂</span>
              <span className="text-[9px] font-mono text-slate-400">Industrial</span>
            </div>
            <div className="text-xl font-bold font-mono text-white tabular-nums">
              {pollutants.so2 !== null ? pollutants.so2 : 'N/A'}{' '}
              <span className="text-[10px] font-normal text-slate-400">µg/m³</span>
            </div>
            <p className="text-[10px] text-slate-400 line-clamp-1">Sulphur emissions</p>
          </div>

          {/* CO2 */}
          <div className="col-span-2 p-3 rounded-2xl bg-[#09212D] border border-[#263238] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">CO₂ (Carbon Dioxide)</div>
              <p className="text-[10px] text-slate-400">Ambient atmospheric background</p>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {pollutants.co2 !== null ? pollutants.co2 : 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-400">ppm</span>
            </div>
          </div>

          {/* NH3 (Ammonia) - Documented Open-Meteo Air Quality Variable */}
          <div className="col-span-2 p-3 rounded-2xl bg-[#09212D] border border-[#263238] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">NH₃ (Ammonia)</div>
              <p className="text-[10px] text-slate-400">Atmospheric ammonia concentration</p>
            </div>
            <div className="text-lg font-bold font-mono text-white tabular-nums">
              {pollutants.nh3 !== null && pollutants.nh3 !== undefined ? pollutants.nh3 : 'N/A'}{' '}
              <span className="text-xs font-normal text-slate-400">µg/m³</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Environmental Indicators (Separate Context Measurements) */}
      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Environmental Indicators</span>
          </h2>
          <p className="text-[10px] text-slate-500 italic mt-0.5">
            «Context measurements — not part of the AQI.»
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238]">
            <span className="text-[10px] text-slate-400 block">UV Index</span>
            <div className="text-lg font-bold font-mono text-white">
              {indicators.uv_index !== null ? indicators.uv_index : 'N/A'}
            </div>
            <span className="text-[9px] text-slate-500 font-mono">Solar exposure</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238]">
            <span className="text-[10px] text-slate-400 block">Dust Concentration</span>
            <div className="text-lg font-bold font-mono text-white">
              {indicators.dust !== null ? indicators.dust : 'N/A'}{' '}
              <span className="text-[9px] font-normal text-slate-400">µg/m³</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">Airborne mineral</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238]">
            <span className="text-[10px] text-slate-400 block">AOD (Optical Depth)</span>
            <div className="text-lg font-bold font-mono text-white">
              {indicators.aod !== null ? indicators.aod : 'N/A'}
            </div>
            <span className="text-[9px] text-slate-500 font-mono">550nm unitless</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238]">
            <span className="text-[10px] text-slate-400 block">CH₄ (Methane)</span>
            <div className="text-lg font-bold font-mono text-white">
              {indicators.ch4 !== null ? indicators.ch4 : 'N/A'}{' '}
              <span className="text-[9px] font-normal text-slate-400">µg/m³</span>
            </div>
            <span className="text-[9px] text-slate-500 font-mono">Trace gas</span>
          </div>
        </div>
      </section>

      {/* 4. What This Means (Mobile Compact Card) */}
      <section className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
          <Info className="w-4 h-4 text-[#06B6D4]" />
          <span>What This Means</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          At <strong>{aqi} US AQI ({category})</strong>, conditions are primarily driven by{' '}
          <strong>{reading.dominantPollutant}</strong>.
          {aqi <= 50
            ? ' Atmospheric air quality is satisfactory with low exposure risk.'
            : aqi <= 100
            ? ' Air quality is acceptable for most; sensitive individuals may take mild precautions.'
            : ' Consider limiting prolonged outdoor exertion and keep indoor spaces ventilated.'}
        </p>
        <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800">
          Air-quality information and decision support only. Non-diagnostic.
        </p>
      </section>

      {/* 5. Mobile Quick Nav Tiles */}
      <section className="space-y-1.5 pt-1">
        <button
          onClick={() => onNavigate('map')}
          className="w-full p-3.5 rounded-2xl bg-[#09212D] hover:bg-[#0F766E]/20 border border-[#263238] hover:border-[#0F766E]/50 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Map & AI Advisor</div>
              <div className="text-[10px] text-slate-400">Geospatial air intelligence & live queries</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate('health')}
          className="w-full p-3.5 rounded-2xl bg-[#09212D] hover:bg-[#09212D]/80 border border-[#263238] flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#22C55E]/15 text-[#22C55E]">
              <HeartPulse className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Health Guidance</div>
              <div className="text-[10px] text-slate-400">Respiratory protection & sensitive group tips</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate('forecast')}
          className="w-full p-3.5 rounded-2xl bg-[#09212D] hover:bg-[#09212D]/80 border border-[#263238] flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#38BDF8]/15 text-[#38BDF8]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">AI Forecast (72h)</div>
              <div className="text-[10px] text-slate-400">Hourly trajectory & peak stagnation windows</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate('history')}
          className="w-full p-3.5 rounded-2xl bg-[#09212D] hover:bg-[#09212D]/80 border border-[#263238] flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Persistent Archive</div>
              <div className="text-[10px] text-slate-400">Stored verified readings & export</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      </section>
    </div>
  );
};
