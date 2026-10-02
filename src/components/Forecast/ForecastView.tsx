import React, { useState } from 'react';
import { AQIReading, HourlyForecastPoint } from '../../types/airguard';
import { getAQICategory } from '../../services/airQualityService';
import {
  TrendingUp,
  Clock,
  BarChart3,
  Calendar,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  CalendarDays,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';

interface ForecastViewProps {
  reading: AQIReading;
  forecast: HourlyForecastPoint[];
}

interface DayForecastData {
  dayNumber: number;
  dayLabel: string;
  dateStr: string;
  hasForecast: boolean;
  avgAqi: string;
  minAqi: string;
  maxAqi: string;
  avgPm25: string;
  avgPm10: string;
  avgNo2: string;
  avgO3: string;
  avgCo: string;
  avgSo2: string;
  category: string;
  categoryColor: string;
  points: HourlyForecastPoint[];
}

export const ForecastView: React.FC<ForecastViewProps> = ({ reading, forecast }) => {
  const { location, aqi } = reading;
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [hoveredPoint, setHoveredPoint] = useState<HourlyForecastPoint | null>(null);

  // Build dates for Day 1 to Day 8
  // Strict rule: Days 1–5 (index 0 to 4) contain actual Open-Meteo forecast data.
  // Days beyond (Day 6, Day 7, Day 8) strictly display "None".
  const allDaysSchedule: DayForecastData[] = Array.from({ length: 8 }, (_, i) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    const dateIso = targetDate.toISOString().split('T')[0];
    const dateFormatted = targetDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    const dayNumber = i + 1;
    const dayLabel = i === 0 ? 'Today' : `Day ${dayNumber}`;

    if (i < 5) {
      // Days 1–5: Extract actual Open-Meteo hourly data for this date
      const dayPoints = forecast.filter((p) => p.time.startsWith(dateIso));
      if (dayPoints.length > 0) {
        const aqiList = dayPoints.map((p) => p.aqi);
        const avgAqi = Math.round(
          aqiList.reduce((sum, val) => sum + val, 0) / aqiList.length
        );
        const minAqi = Math.min(...aqiList);
        const maxAqi = Math.max(...aqiList);
        const catInfo = getAQICategory(avgAqi);

        const pm25List = dayPoints
          .map((p) => p.pm2_5)
          .filter((v): v is number => v !== null);
        const avgPm25 =
          pm25List.length > 0
            ? (
                Math.round(
                  (pm25List.reduce((a, b) => a + b, 0) / pm25List.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        const pm10List = dayPoints
          .map((p) => p.pm10)
          .filter((v): v is number => v !== null);
        const avgPm10 =
          pm10List.length > 0
            ? (
                Math.round(
                  (pm10List.reduce((a, b) => a + b, 0) / pm10List.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        const no2List = dayPoints
          .map((p) => p.no2)
          .filter((v): v is number => v !== null);
        const avgNo2 =
          no2List.length > 0
            ? (
                Math.round(
                  (no2List.reduce((a, b) => a + b, 0) / no2List.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        const o3List = dayPoints
          .map((p) => p.o3)
          .filter((v): v is number => v !== null);
        const avgO3 =
          o3List.length > 0
            ? (
                Math.round(
                  (o3List.reduce((a, b) => a + b, 0) / o3List.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        const coList = dayPoints
          .map((p) => p.co)
          .filter((v): v is number => v !== null && v !== undefined);
        const avgCo =
          coList.length > 0
            ? (
                Math.round(
                  (coList.reduce((a, b) => a + b, 0) / coList.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        const so2List = dayPoints
          .map((p) => p.so2)
          .filter((v): v is number => v !== null && v !== undefined);
        const avgSo2 =
          so2List.length > 0
            ? (
                Math.round(
                  (so2List.reduce((a, b) => a + b, 0) / so2List.length) * 10
                ) / 10
              ).toFixed(1)
            : 'None';

        return {
          dayNumber,
          dayLabel,
          dateStr: dateFormatted,
          hasForecast: true,
          avgAqi: `${avgAqi}`,
          minAqi: `${minAqi}`,
          maxAqi: `${maxAqi}`,
          avgPm25: avgPm25 !== 'None' ? `${avgPm25} µg/m³` : 'None',
          avgPm10: avgPm10 !== 'None' ? `${avgPm10} µg/m³` : 'None',
          avgNo2: avgNo2 !== 'None' ? `${avgNo2} µg/m³` : 'None',
          avgO3: avgO3 !== 'None' ? `${avgO3} µg/m³` : 'None',
          avgCo: avgCo !== 'None' ? `${avgCo} µg/m³` : 'None',
          avgSo2: avgSo2 !== 'None' ? `${avgSo2} µg/m³` : 'None',
          category: catInfo.category,
          categoryColor: catInfo.color,
          points: dayPoints,
        };
      }
    }

    // Days beyond the 5-day forecast (Day 6, Day 7, Day 8): STRICTLY NONE
    return {
      dayNumber,
      dayLabel,
      dateStr: dateFormatted,
      hasForecast: false,
      avgAqi: 'None',
      minAqi: 'None',
      maxAqi: 'None',
      avgPm25: 'None',
      avgPm10: 'None',
      avgNo2: 'None',
      avgO3: 'None',
      avgCo: 'None',
      avgSo2: 'None',
      category: 'None',
      categoryColor: '#64748B',
      points: [],
    };
  });

  // Extract the primary 5 forecast cards (Today | Day 2 | Day 3 | Day 4 | Day 5)
  const fiveForecastCards = allDaysSchedule.slice(0, 5);
  // Days beyond the 5-day forecast (Day 6, Day 7, Day 8)
  const beyondForecastDays = allDaysSchedule.slice(5);

  // Active day selection (default to Today, restricted to 0..4)
  const activeDay = fiveForecastCards[selectedDayIndex] || fiveForecastCards[0];
  const activePoints = activeDay.points;

  // Real 5-Day Open-Meteo Forecast AI Analysis
  // Must ONLY analyze the 5 available days. For dates with None, no analysis is provided.
  const day1Aqi = parseInt(fiveForecastCards[0]?.avgAqi) || aqi;
  const day5Aqi = parseInt(fiveForecastCards[4]?.avgAqi) || day1Aqi;
  const overallTrendDiff = day5Aqi - day1Aqi;

  // Find peak spike in the 5 days
  let peakSpikeAqi = 0;
  let peakSpikeDay = 'Day 1';
  let peakSpikeHour = '12:00';

  fiveForecastCards.forEach((day) => {
    day.points.forEach((p) => {
      if (p.aqi > peakSpikeAqi) {
        peakSpikeAqi = p.aqi;
        peakSpikeDay = day.dayLabel;
        peakSpikeHour = p.formattedHour;
      }
    });
  });

  // Detect which measured pollutant shifts the most between Day 1 and Day 5
  const getNumVal = (str: string) => {
    if (!str || str === 'None') return null;
    const match = str.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : null;
  };

  const pm25Shift = Math.abs(
    (getNumVal(fiveForecastCards[4]?.avgPm25) ?? 0) -
      (getNumVal(fiveForecastCards[0]?.avgPm25) ?? 0)
  );
  const pm10Shift = Math.abs(
    (getNumVal(fiveForecastCards[4]?.avgPm10) ?? 0) -
      (getNumVal(fiveForecastCards[0]?.avgPm10) ?? 0)
  );
  const o3Shift = Math.abs(
    (getNumVal(fiveForecastCards[4]?.avgO3) ?? 0) -
      (getNumVal(fiveForecastCards[0]?.avgO3) ?? 0)
  );
  const no2Shift = Math.abs(
    (getNumVal(fiveForecastCards[4]?.avgNo2) ?? 0) -
      (getNumVal(fiveForecastCards[0]?.avgNo2) ?? 0)
  );

  let mostChangedPollutant = 'PM2.5';
  let maxShift = pm25Shift;
  if (pm10Shift > maxShift) {
    mostChangedPollutant = 'PM10';
    maxShift = pm10Shift;
  }
  if (o3Shift > maxShift) {
    mostChangedPollutant = 'Ozone (O₃)';
    maxShift = o3Shift;
  }
  if (no2Shift > maxShift) {
    mostChangedPollutant = 'Nitrogen Dioxide (NO₂)';
    maxShift = no2Shift;
  }

  // Direction explanation
  let trendDescription = '';
  if (Math.abs(overallTrendDiff) <= 4) {
    trendDescription =
      'Air quality is forecast to remain relatively stable across the 5-day period with minimal baseline fluctuations.';
  } else if (overallTrendDiff > 4) {
    trendDescription = `Air pollution is forecast to increase overall across the 5 days (+${overallTrendDiff} AQI change from ${fiveForecastCards[0].dayLabel} to ${fiveForecastCards[4].dayLabel}).`;
  } else {
    trendDescription = `Air quality is forecast to improve overall across the 5 days (${Math.abs(
      overallTrendDiff
    )} AQI decrease from ${fiveForecastCards[0].dayLabel} to ${fiveForecastCards[4].dayLabel}).`;
  }

  // SVG Chart dimensions for the active day's hourly data
  const chartHeight = 140;
  const chartWidth = 380;
  const paddingX = 24;
  const paddingY = 22;

  let minChartAqi = 999;
  let maxChartAqi = 0;
  activePoints.forEach((p) => {
    if (p.aqi < minChartAqi) minChartAqi = p.aqi;
    if (p.aqi > maxChartAqi) maxChartAqi = p.aqi;
  });
  if (minChartAqi === 999) minChartAqi = 0;
  if (maxChartAqi === 0) maxChartAqi = 100;

  const yMax = Math.max(100, Math.ceil(maxChartAqi / 25) * 25 + 20);
  const yMin = 0;

  const getX = (index: number) => {
    if (activePoints.length <= 1) return paddingX;
    return (
      paddingX +
      (index / (activePoints.length - 1)) * (chartWidth - paddingX * 2)
    );
  };

  const getY = (val: number) => {
    const range = yMax - yMin;
    const norm = (val - yMin) / range;
    return chartHeight - paddingY - norm * (chartHeight - paddingY * 2);
  };

  const pointsPath = activePoints
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.aqi).toFixed(1)}`
    )
    .join(' ');

  const areaPath =
    activePoints.length > 0
      ? `${pointsPath} L ${getX(activePoints.length - 1)} ${
          chartHeight - paddingY
        } L ${getX(0)} ${chartHeight - paddingY} Z`
      : '';

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* 1. Header with Selected Location Coordinates */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs uppercase font-mono font-semibold text-slate-400">
            <TrendingUp className="w-4 h-4 text-[#38BDF8]" />
            <span>AI Atmospheric Forecast</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px]">
            {location.name}
          </span>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white">Forecast for {location.name}</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1 font-mono">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>Air quality data: Open-Meteo</span>
          </span>
          <span className="text-[10px] font-mono text-[#5EEAD4] bg-[#0F766E]/20 px-2 py-0.5 rounded border border-[#0F766E]/40">
            5-Day Model Window
          </span>
        </div>
      </section>

      {/* 2. Five Forecast Cards: Today | Day 2 | Day 3 | Day 4 | Day 5 */}
      <section className="space-y-2.5">
        <div className="px-1 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>5-Day Forecast Cards</span>
          </h2>
          <span className="text-[10px] font-mono text-slate-400">Tap card to inspect</span>
        </div>

        {/* 5-Card Horizontal / Tab Selector */}
        <div className="grid grid-cols-5 gap-1.5">
          {fiveForecastCards.map((card, idx) => {
            const isSelected = selectedDayIndex === idx;
            return (
              <button
                key={card.dayNumber}
                type="button"
                onClick={() => {
                  setSelectedDayIndex(idx);
                  setHoveredPoint(null);
                }}
                className={`p-2 rounded-2xl border text-center transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#0F766E]/40 border-[#06B6D4] shadow-md'
                    : 'bg-[#09212D] border-[#263238] hover:border-slate-700'
                }`}
              >
                <div className="text-[10px] font-mono font-bold text-white truncate w-full">
                  {card.dayLabel}
                </div>
                <div className="text-[9px] text-slate-400 truncate w-full font-mono mt-0.5">
                  {card.dateStr.split(',')[0]}
                </div>
                <div className="text-base font-extrabold font-mono text-white tabular-nums my-1">
                  {card.avgAqi}
                </div>
                <div
                  className="text-[9px] font-bold uppercase truncate w-full"
                  style={{ color: card.categoryColor }}
                >
                  {card.category}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Selected Card Detailed Breakdown */}
        <div className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {activeDay.dayLabel} ({activeDay.dateStr})
                </span>
                <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40">
                  Open-Meteo Verified
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Range: {activeDay.minAqi} – {activeDay.maxAqi} AQI
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xl font-extrabold font-mono text-white tabular-nums">
                {activeDay.avgAqi}
              </span>
              <span
                className="block text-[10px] font-bold uppercase font-mono"
                style={{ color: activeDay.categoryColor }}
              >
                {activeDay.category}
              </span>
            </div>
          </div>

          {/* Supported Pollutants Grid for Selected Day */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400">
              Measured Daily Average Pollutants
            </span>
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">PM2.5</span>
                <span className="font-bold text-white">{activeDay.avgPm25}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">PM10</span>
                <span className="font-bold text-white">{activeDay.avgPm10}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">NO₂</span>
                <span className="font-bold text-white">{activeDay.avgNo2}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">O₃</span>
                <span className="font-bold text-white">{activeDay.avgO3}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">CO</span>
                <span className="font-bold text-white">{activeDay.avgCo}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">SO₂</span>
                <span className="font-bold text-white">{activeDay.avgSo2}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Hourly Curve for the Selected Day */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-2 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>{activeDay.dayLabel} Hourly Trajectory</span>
          </h2>
          {hoveredPoint ? (
            <span className="text-[11px] font-mono font-bold text-[#5EEAD4]">
              {hoveredPoint.formattedHour}: {hoveredPoint.aqi} AQI
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">
              Tap point to inspect
            </span>
          )}
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto overflow-visible"
          >
            <defs>
              <linearGradient id="mobileChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Threshold Guidelines */}
            {[50, 100].map((th) => {
              if (th > yMax) return null;
              const y = getY(th);
              return (
                <g key={th}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="#263238"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={paddingX - 4}
                    y={y + 3}
                    fill="#64748B"
                    fontSize="9"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {th}
                  </text>
                </g>
              );
            })}

            {/* Area & Line */}
            {areaPath && <path d={areaPath} fill="url(#mobileChartGrad)" />}
            {pointsPath && (
              <path
                d={pointsPath}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Points */}
            {activePoints.map((point, idx) => {
              const cx = getX(idx);
              const cy = getY(point.aqi);
              const isHovered = hoveredPoint?.time === point.time;
              const catColor = getAQICategory(point.aqi).color;

              return (
                <circle
                  key={point.time}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 2.5}
                  fill={isHovered ? catColor : '#06B6D4'}
                  stroke="#071A24"
                  strokeWidth="1.5"
                  onClick={() => setHoveredPoint(point)}
                  className="cursor-pointer"
                />
              );
            })}

            {/* Hour Labels */}
            {activePoints.map((point, idx) => {
              if (idx % 4 !== 0) return null;
              const cx = getX(idx);
              return (
                <text
                  key={`lbl-${idx}`}
                  x={cx}
                  y={chartHeight - 6}
                  fill="#94A3B8"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {point.formattedHour}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Hourly Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {activePoints.map((p) => {
            const cat = getAQICategory(p.aqi);
            return (
              <div
                key={p.time}
                onClick={() => setHoveredPoint(p)}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer min-w-[70px] shrink-0 ${
                  hoveredPoint?.time === p.time
                    ? 'bg-[#0F766E]/30 border-[#06B6D4]'
                    : 'bg-[#071A24] border-slate-800'
                }`}
              >
                <div className="text-[9px] font-mono text-slate-400">{p.formattedHour}</div>
                <div className="text-sm font-bold font-mono text-white tabular-nums my-0.5">
                  {p.aqi}
                </div>
                <div
                  className="text-[8px] font-bold uppercase truncate"
                  style={{ color: cat.color }}
                >
                  {cat.category}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. AI Forecast Analysis (Strictly Real 5-Day Open-Meteo Data) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                AI Forecast Analysis (5-Day Real Data)
              </h2>
              <span className="text-[10px] text-slate-500 font-mono">
                Analyzes only real Open-Meteo 5-day readings
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono">
            {overallTrendDiff > 3 ? (
              <span className="flex items-center text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded border border-[#EF4444]/30">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{overallTrendDiff} AQI
              </span>
            ) : overallTrendDiff < -3 ? (
              <span className="flex items-center text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/30">
                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> {overallTrendDiff} AQI
              </span>
            ) : (
              <span className="flex items-center text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                <Minus className="w-3 h-3 mr-0.5" /> Steady
              </span>
            )}
          </div>
        </div>

        {/* Structured 5-Day Trend Bullet Points */}
        <div className="space-y-2 text-xs text-slate-300">
          <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-[#06B6D4] font-bold uppercase">
              • 5-Day Trajectory
            </span>
            <p className="text-[11px] leading-relaxed text-slate-300">
              {trendDescription}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-[#5EEAD4] font-bold uppercase">
              • Pollutant Dynamics
            </span>
            <p className="text-[11px] leading-relaxed text-slate-300">
              <strong>{mostChangedPollutant}</strong> exhibits the most pronounced variance across the 5 days (shift of ~{maxShift.toFixed(1)} µg/m³ between {fiveForecastCards[0].dayLabel} and {fiveForecastCards[4].dayLabel}).
            </p>
          </div>

          {peakSpikeAqi > 0 && (
            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-[#F59E0B] font-bold uppercase">
                • Peak Spike Window
              </span>
              <p className="text-[11px] leading-relaxed text-slate-300">
                Highest recorded spike within the 5 days reaches <strong>{peakSpikeAqi} AQI</strong> on <strong>{peakSpikeDay} at {peakSpikeHour}</strong>.
              </p>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400">
            <strong>Exclusion Rule:</strong> Dates with <strong>None</strong> (Days 6–8) are outside the 5-day forecast period and are strictly excluded from AI analysis. No health guidance or predictions are generated for nonexistent dates.
          </div>
        </div>
      </section>

      {/* 5. Days Beyond the 5-Day Forecast (Day 6, Day 7, Day 8) -> Strictly "None" */}
      <section className="space-y-2.5">
        <div className="px-1 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
            <span>Extended Dates (Beyond 5-Day Limit)</span>
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Values: None</span>
        </div>

        <div className="space-y-2">
          {beyondForecastDays.map((day) => (
            <div
              key={day.dayNumber}
              className="p-3 rounded-2xl bg-[#071A24]/60 border border-dashed border-slate-800 flex items-center justify-between gap-3 text-slate-400"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">
                    Day {day.dayNumber} · {day.dateStr}
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    None
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5 space-x-2">
                  <span>AQI: <strong className="text-slate-400">None</strong></span>
                  <span>· PM2.5: <strong className="text-slate-400">None</strong></span>
                  <span>· PM10: <strong className="text-slate-400">None</strong></span>
                </div>
                <p className="text-[9px] text-slate-600 mt-0.5">
                  Beyond 5-day Open-Meteo forecast limit. No fabricated data.
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm font-bold font-mono text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                  None
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
