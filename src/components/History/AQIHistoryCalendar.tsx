import React, { useState, useMemo, useCallback } from 'react';
import { HistoryRecord } from '../../types/airguard';
import { getLocalDateKey, historyService } from '../../services/historyService';
import { getAQICategory } from '../../services/airQualityService';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Trash2,
  Wind,
  Layers,
  Activity,
  CalendarX2,
  CheckCircle2,
  ListFilter,
  BarChart2,
} from 'lucide-react';

interface AQIHistoryCalendarProps {
  records: HistoryRecord[];
  onRecordsChange?: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface DailyAqiSummary {
  primaryAqi: number;
  category: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  validCount: number;
  isSummary: boolean;
  summaryTypeLabel: string;
  timeLabel: string;
  firstTime: string;
  lastTime: string;
  locationName: string;
  locationCountry?: string;
  latitude: number;
  longitude: number;
  avgPm2_5: number | null;
  avgPm10: number | null;
  avgO3: number | null;
  avgNo2: number | null;
  avgSo2: number | null;
  avgCo: number | null;
  avgCo2: number | null;
  avgUv: number | null;
  validRecords: HistoryRecord[];
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  summary: DailyAqiSummary | null;
  records: HistoryRecord[];
}

/**
 * Calculates a mathematically sound, documented daily summary from valid observations.
 * Summary rule: Arithmetic mean of all verified observations with valid numeric AQI.
 */
export function computeDailySummary(records: HistoryRecord[]): DailyAqiSummary | null {
  if (!records || records.length === 0) return null;

  // Filter only genuine valid numeric AQI observations
  const validRecords = records
    .filter((r) => typeof r.aqi === 'number' && !isNaN(r.aqi) && r.aqi >= 0)
    .sort((a, b) => a.retrievalTimestamp - b.retrievalTimestamp);

  if (validRecords.length === 0) return null;

  const validCount = validRecords.length;
  const isSummary = validCount > 1;

  // Primary AQI value: single observation or arithmetic mean of valid observations
  const primaryAqi = isSummary
    ? Math.round(validRecords.reduce((sum, r) => sum + r.aqi, 0) / validCount)
    : validRecords[0].aqi;

  const catInfo = getAQICategory(primaryAqi);
  const firstTime = validRecords[0].time;
  const lastTime = validRecords[validRecords.length - 1].time;

  const summaryTypeLabel = isSummary
    ? `Daily Mean (${validCount} observations)`
    : 'Single observation';

  const timeLabel = isSummary ? `${firstTime} – ${lastTime}` : `at ${firstTime}`;

  // Average pollutants
  const calcAvg = (getter: (r: HistoryRecord) => number | null | undefined, roundDecimals = 1) => {
    const vals = validRecords
      .map(getter)
      .filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const factor = Math.pow(10, roundDecimals);
    return Math.round(avg * factor) / factor;
  };

  const primaryRec = validRecords[validRecords.length - 1]; // latest observation for primary coordinates

  return {
    primaryAqi,
    category: catInfo.category,
    color: catInfo.color,
    bg: catInfo.bg,
    border: catInfo.border,
    description: catInfo.description,
    validCount,
    isSummary,
    summaryTypeLabel,
    timeLabel,
    firstTime,
    lastTime,
    locationName: primaryRec.location.name,
    locationCountry: primaryRec.location.country,
    latitude: primaryRec.location.latitude,
    longitude: primaryRec.location.longitude,
    avgPm2_5: calcAvg((r) => r.pollutants?.pm2_5),
    avgPm10: calcAvg((r) => r.pollutants?.pm10),
    avgO3: calcAvg((r) => r.pollutants?.o3),
    avgNo2: calcAvg((r) => r.pollutants?.no2),
    avgSo2: calcAvg((r) => r.pollutants?.so2),
    avgCo: calcAvg((r) => r.pollutants?.co),
    avgCo2: calcAvg((r) => r.pollutants?.co2, 0),
    avgUv: calcAvg((r) => r.indicators?.uv_index),
    validRecords,
  };
}

export const AQIHistoryCalendar: React.FC<AQIHistoryCalendarProps> = ({
  records,
  onRecordsChange,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => getLocalDateKey(today), [today]);

  // Current viewed month and year
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Selected date key (YYYY-MM-DD), default to today
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // Expanded state for individual observation details
  const [showIndividualObservations, setShowIndividualObservations] = useState<boolean>(true);

  // Map all saved records by local date key 'YYYY-MM-DD'
  const recordsByDate = useMemo(() => {
    const map: Record<string, HistoryRecord[]> = {};
    for (const rec of records) {
      const key = getLocalDateKey(rec.retrievalTimestamp);
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(rec);
    }
    // Sort records chronologically within each day
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.retrievalTimestamp - b.retrievalTimestamp);
    }
    return map;
  }, [records]);

  // Month navigation handlers with intelligent date selection updates
  const handlePrevMonth = useCallback(() => {
    let nextYear = viewYear;
    let nextMonth = viewMonth - 1;
    if (nextMonth < 0) {
      nextMonth = 11;
      nextYear -= 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);

    // Update selected date to 1st of the newly viewed month unless viewing current month
    if (nextYear === today.getFullYear() && nextMonth === today.getMonth()) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`);
    }
  }, [viewYear, viewMonth, today, todayKey]);

  const handleNextMonth = useCallback(() => {
    let nextYear = viewYear;
    let nextMonth = viewMonth + 1;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);

    if (nextYear === today.getFullYear() && nextMonth === today.getMonth()) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`);
    }
  }, [viewYear, viewMonth, today, todayKey]);

  const handleJumpToToday = useCallback(() => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDateKey(todayKey);
  }, [today, todayKey]);

  // Generate calendar grid for viewYear and viewMonth (proper leap year handling)
  const calendarDays = useMemo<CalendarDay[]>(() => {
    // Number of days in current month: new Date(year, month + 1, 0).getDate()
    // Properly accounts for leap years (e.g. Feb 2024 = 29, Feb 2025 = 28)
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // First day of current month: 0 = Sun, 1 = Mon, ..., 6 = Sat
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

    // Number of days in previous month
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: CalendarDay[] = [];

    // 1. Leading days from previous month
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, dayNum);
      const key = getLocalDateKey(prevDate);
      const dayRecs = recordsByDate[key] || [];
      days.push({
        date: prevDate,
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
        summary: computeDailySummary(dayRecs),
        records: dayRecs,
      });
    }

    // 2. Days in current month
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const curDate = new Date(viewYear, viewMonth, dayNum);
      const key = getLocalDateKey(curDate);
      const dayRecs = recordsByDate[key] || [];
      days.push({
        date: curDate,
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: key === todayKey,
        summary: computeDailySummary(dayRecs),
        records: dayRecs,
      });
    }

    // 3. Trailing days from next month to complete the grid (multiples of 7)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
      const nextDate = new Date(viewYear, viewMonth + 1, dayNum);
      const key = getLocalDateKey(nextDate);
      const dayRecs = recordsByDate[key] || [];
      days.push({
        date: nextDate,
        dateKey: key,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: key === todayKey,
        summary: computeDailySummary(dayRecs),
        records: dayRecs,
      });
    }

    return days;
  }, [viewYear, viewMonth, recordsByDate, todayKey]);

  // Selected date details
  const selectedRecords = useMemo(() => {
    return recordsByDate[selectedDateKey] || [];
  }, [recordsByDate, selectedDateKey]);

  const selectedSummary = useMemo(() => {
    return computeDailySummary(selectedRecords);
  }, [selectedRecords]);

  const formattedSelectedDate = useMemo(() => {
    const parts = selectedDateKey.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return selectedDateKey;
  }, [selectedDateKey]);

  // Delete observation handler
  const handleDeleteRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    historyService.deleteRecord(id);
    if (onRecordsChange) {
      onRecordsChange();
    }
  };

  return (
    <div className="space-y-4">
      {/* =================================================================== */}
      {/* 1. Monthly Calendar Navigation & Grid                                */}
      {/* =================================================================== */}
      <section className="p-3 sm:p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        {/* Month Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#0F766E]/20 text-[#06B6D4] flex items-center justify-center border border-[#0F766E]/40 shrink-0">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <span>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </span>
                {viewYear === today.getFullYear() && viewMonth === today.getMonth() && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0F766E]/40 text-[#5EEAD4] border border-[#0F766E] shrink-0">
                    Current
                  </span>
                )}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Daily US AQI observations
              </p>
            </div>
          </div>

          {/* Jump to Today & Navigation Arrows */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono font-medium transition-colors cursor-pointer border border-slate-700/60"
              title="Jump to current month & today"
            >
              Today
            </button>
            <div className="flex items-center bg-slate-800/90 rounded-lg border border-slate-700/60 p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center select-none">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-[10px] sm:text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider py-0.5"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Day Grid — Optimized for Mobile Legibility */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {calendarDays.map((cell) => {
            const isSelected = cell.dateKey === selectedDateKey;
            const summary = cell.summary;
            const hasData = summary !== null;
            const additionalCount = summary ? summary.validCount - 1 : 0;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => {
                  setSelectedDateKey(cell.dateKey);
                  // If clicking a date from adjacent month, shift view to that month
                  if (!cell.isCurrentMonth) {
                    setViewYear(cell.date.getFullYear());
                    setViewMonth(cell.date.getMonth());
                  }
                }}
                className={`relative min-h-[56px] sm:min-h-[62px] p-1 sm:p-1.5 rounded-xl flex flex-col justify-between items-center transition-all cursor-pointer box-border ${
                  cell.isCurrentMonth
                    ? 'bg-[#071A24] hover:bg-[#071A24]/90'
                    : 'bg-[#071A24]/40 hover:bg-[#071A24]/60 opacity-40'
                } ${
                  isSelected
                    ? 'ring-2 ring-[#06B6D4] bg-[#0F766E]/25 shadow-md z-10'
                    : cell.isToday
                    ? 'ring-1 ring-[#06B6D4]/60 border-slate-700'
                    : 'border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Header row in cell: day number + indicators */}
                <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] font-mono leading-none px-0.5">
                  <span
                    className={`font-semibold ${
                      isSelected
                        ? 'text-[#5EEAD4]'
                        : cell.isToday
                        ? 'text-[#06B6D4] font-bold'
                        : cell.isCurrentMonth
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Today marker */}
                    {cell.isToday && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]"
                        title="Today"
                      />
                    )}

                    {/* Additional observations indicator: clearly shows '+N' without truncating AQI */}
                    {additionalCount > 0 && (
                      <span
                        className="text-[8px] sm:text-[9px] font-mono text-slate-400 font-normal leading-none"
                        title={`${summary?.validCount} observations recorded`}
                      >
                        +{additionalCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* AQI Indicator Pill: Clean, unclipped, full-width chip */}
                <div className="w-full mt-1 flex flex-col items-center justify-center">
                  {hasData && summary ? (
                    <div
                      className="w-full py-0.5 px-0.5 rounded-md flex items-center justify-center font-mono font-bold leading-tight text-[11px] sm:text-xs whitespace-nowrap transition-transform"
                      style={{
                        backgroundColor: summary.bg,
                        color: summary.color,
                        border: `1px solid ${summary.border}`,
                      }}
                      title={`${summary.primaryAqi} US AQI (${summary.category}) · ${summary.summaryTypeLabel}`}
                    >
                      <span>{summary.primaryAqi}</span>
                    </div>
                  ) : (
                    <div className="h-4 flex items-center justify-center">
                      <span className="text-[10px] text-slate-700 font-mono">·</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Compact AQI Category Legend with High-Contrast Colors */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-mono text-slate-400 select-none">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>0-50 Good</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#06B6D4]" />
            <span>51-100 Mod</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>101-150 USG</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span>151-200 Unhealthy</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#A855F7]" />
            <span>201-300 Very Unhealthy</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FB7185]" />
            <span>301+ Haz</span>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 2. Selected Date Detail Panel & Individual Observations              */}
      {/* =================================================================== */}
      <section className="p-3 sm:p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
        {/* Panel Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#06B6D4]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Date Details
            </h3>
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-400">
            {formattedSelectedDate}
          </span>
        </div>

        {/* Case A: Records Exist for Selected Date */}
        {selectedSummary ? (
          <div className="space-y-3.5">
            {/* Primary Daily AQI Summary Hero Card */}
            <div
              className="p-4 rounded-2xl border space-y-3 transition-colors"
              style={{
                backgroundColor: selectedSummary.bg,
                borderColor: selectedSummary.border,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-bold font-mono uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{
                        backgroundColor: 'rgba(7, 26, 36, 0.75)',
                        color: selectedSummary.color,
                        border: `1px solid ${selectedSummary.border}`,
                      }}
                    >
                      {selectedSummary.category}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/60">
                      {selectedSummary.summaryTypeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    {selectedSummary.description}
                  </p>
                </div>

                {/* Primary AQI Number */}
                <div className="text-right shrink-0">
                  <div
                    className="text-3xl sm:text-4xl font-extrabold font-mono leading-none tracking-tight"
                    style={{ color: selectedSummary.color }}
                  >
                    {selectedSummary.primaryAqi}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    US AQI
                  </span>
                </div>
              </div>

              {/* Time Range, Location & Verification Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300">
                <div className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  <span className="truncate">
                    {selectedSummary.isSummary ? 'Window: ' : 'Time: '}
                    {selectedSummary.timeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {selectedSummary.locationName}
                    {selectedSummary.locationCountry ? `, ${selectedSummary.locationCountry}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Daily Pollutant Readings Grid */}
            <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Wind className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>
                    {selectedSummary.isSummary
                      ? 'Daily Mean Atmospheric Parameters'
                      : 'Atmospheric Parameters'}
                  </span>
                </div>
                <span className="text-[9px] text-[#5EEAD4] font-semibold">
                  Open-Meteo Verified
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">PM2.5</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgPm2_5 !== null ? `${selectedSummary.avgPm2_5} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">PM10</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgPm10 !== null ? `${selectedSummary.avgPm10} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Ozone (O₃)</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgO3 !== null ? `${selectedSummary.avgO3} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Nitrogen Dioxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgNo2 !== null ? `${selectedSummary.avgNo2} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Sulphur Dioxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgSo2 !== null ? `${selectedSummary.avgSo2} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Carbon Monoxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgCo !== null ? `${selectedSummary.avgCo} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">CO₂ Background</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgCo2 !== null ? `${selectedSummary.avgCo2} ppm` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">UV Index</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.avgUv !== null ? selectedSummary.avgUv : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual Observations Breakdown (Accessible for every observation) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-1.5 font-bold text-slate-300 font-mono text-[11px] uppercase tracking-wider">
                  <ListFilter className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>
                    Logged Observations ({selectedSummary.validCount})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIndividualObservations(!showIndividualObservations)}
                  className="text-[10px] font-mono text-[#06B6D4] hover:underline cursor-pointer"
                >
                  {showIndividualObservations ? 'Hide log' : 'Show log'}
                </button>
              </div>

              {showIndividualObservations && (
                <div className="space-y-2">
                  {selectedSummary.validRecords.map((rec, index) => {
                    const cat = getAQICategory(rec.aqi);
                    return (
                      <div
                        key={rec.id || index}
                        className="p-3 rounded-xl bg-[#071A24] border border-slate-800/90 hover:border-slate-700 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              #{index + 1}
                            </span>
                            <span className="font-mono font-bold text-white text-xs">
                              {rec.time}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-300 text-xs truncate">
                              {rec.location.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              className="px-2 py-0.5 rounded-lg text-center font-mono font-bold text-xs"
                              style={{
                                backgroundColor: cat.bg,
                                color: cat.color,
                                border: `1px solid ${cat.border}`,
                              }}
                            >
                              {rec.aqi} AQI
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecord(rec.id, e)}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete this observation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Individual parameters row */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                          <span>PM2.5: <strong className="text-slate-200">{rec.pollutants?.pm2_5 ?? 'N/A'} µg/m³</strong></span>
                          <span>PM10: <strong className="text-slate-200">{rec.pollutants?.pm10 ?? 'N/A'} µg/m³</strong></span>
                          <span>NO₂: <strong className="text-slate-200">{rec.pollutants?.no2 ?? 'N/A'} µg/m³</strong></span>
                          <span>O₃: <strong className="text-slate-200">{rec.pollutants?.o3 ?? 'N/A'} µg/m³</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Case B: No Records Exist for Selected Date */
          <div className="p-6 rounded-2xl bg-[#071A24] border border-slate-800 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <CalendarX2 className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-300">
                No saved AQI records for this date
              </h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                AirGuard AI logs authentic environmental measurements when air quality is queried or refreshed. No readings were recorded on this calendar day.
              </p>
            </div>
            <div className="pt-1 text-[10px] font-mono text-slate-500">
              Select any date with an AQI badge to inspect verified past telemetry.
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
