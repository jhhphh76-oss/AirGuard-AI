import React, { useState, useMemo, useCallback } from 'react';
import { HistoryRecord } from '../../types/airguard';
import { getLocalDateKey, historyService } from '../../services/historyService';
import { getAQICategory } from '../../services/airQualityService';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Star,
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

export interface DailyAqiSummary {
  primaryAqi: number;
  maxAqi: number;
  category: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  validCount: number;
  isMultiple: boolean;
  isSummary: boolean;
  summaryTypeLabel: string;
  timeLabel: string;
  maxTime: string;
  firstTime: string;
  lastTime: string;
  maxObservation: HistoryRecord;
  locationName: string;
  locationCountry?: string;
  latitude: number;
  longitude: number;
  pm2_5: number | null;
  pm10: number | null;
  o3: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  co2: number | null;
  uv: number | null;
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
 * Calculates the Daily Maximum AQI among genuine valid observations for a given date and location.
 * Rule:
 * 1. Filter genuine valid numeric AQI observations (r.aqi >= 0, not NaN, not stale/failed).
 *    Treat a genuine AQI value of zero as valid.
 *    Ignore missing, invalid, or failed observations. Never substitute zero for unavailable data.
 * 2. Separate by location: Do not combine readings from different locations into one daily maximum.
 * 3. If multiple valid observations exist, use the HIGHEST US AQI value (not average or latest).
 * 4. If only one valid observation exists, display that value.
 * 5. Returns null when no valid observations exist (does not fabricate or default to 0).
 */
export function computeDailySummary(
  records: HistoryRecord[],
  targetLocationName?: string
): DailyAqiSummary | null {
  if (!records || records.length === 0) return null;

  // Filter only genuine valid numeric AQI observations
  let validRecords = records.filter(
    (r) =>
      typeof r.aqi === 'number' &&
      !isNaN(r.aqi) &&
      r.aqi >= 0 &&
      !r.isStale &&
      !r.lastAttemptFailed
  );

  if (validRecords.length === 0) return null;

  // Strict location separation: do not combine readings from different locations into one daily maximum
  if (targetLocationName && targetLocationName.trim()) {
    const targetNorm = targetLocationName.trim().toLowerCase();
    validRecords = validRecords.filter(
      (r) => r.location?.name && r.location.name.trim().toLowerCase() === targetNorm
    );
    if (validRecords.length === 0) return null;
  } else {
    // If no target location was explicitly provided, isolate to the location of the latest record
    // so observations from different locations are NEVER combined into one daily maximum!
    const primaryLoc = validRecords[validRecords.length - 1].location?.name?.trim().toLowerCase();
    if (primaryLoc) {
      validRecords = validRecords.filter(
        (r) => r.location?.name && r.location.name.trim().toLowerCase() === primaryLoc
      );
    }
  }

  // Sort chronologically
  validRecords.sort((a, b) => a.retrievalTimestamp - b.retrievalTimestamp);

  // Find observation that produced the MAXIMUM valid US AQI
  let maxRec = validRecords[0];
  for (let i = 1; i < validRecords.length; i++) {
    if (validRecords[i].aqi > maxRec.aqi) {
      maxRec = validRecords[i];
    }
  }

  const primaryAqi = maxRec.aqi;
  const catInfo = getAQICategory(primaryAqi);
  const validCount = validRecords.length;
  const isMultiple = validCount > 1;

  const firstTime = validRecords[0].time;
  const lastTime = validRecords[validRecords.length - 1].time;

  const summaryTypeLabel = isMultiple
    ? `Daily Maximum (${validCount} observations)`
    : 'Single observation';

  const timeLabel = isMultiple
    ? `Peak at ${maxRec.time} (${firstTime} – ${lastTime})`
    : `at ${maxRec.time}`;

  const pm2_5 = maxRec.pollutants?.pm2_5 ?? null;
  const pm10 = maxRec.pollutants?.pm10 ?? null;
  const o3 = maxRec.pollutants?.o3 ?? null;
  const no2 = maxRec.pollutants?.no2 ?? null;
  const so2 = maxRec.pollutants?.so2 ?? null;
  const co = maxRec.pollutants?.co ?? null;
  const co2 = maxRec.pollutants?.co2 ?? null;
  const uv = maxRec.indicators?.uv_index ?? null;

  return {
    primaryAqi,
    maxAqi: primaryAqi,
    category: catInfo.category,
    color: catInfo.color,
    bg: catInfo.bg,
    border: catInfo.border,
    description: catInfo.description,
    validCount,
    isMultiple,
    isSummary: isMultiple,
    summaryTypeLabel,
    timeLabel,
    maxTime: maxRec.time,
    firstTime,
    lastTime,
    maxObservation: maxRec,
    locationName: maxRec.location.name,
    locationCountry: maxRec.location.country,
    latitude: maxRec.location.latitude,
    longitude: maxRec.location.longitude,
    pm2_5,
    pm10,
    o3,
    no2,
    so2,
    co,
    co2,
    uv,
    avgPm2_5: pm2_5,
    avgPm10: pm10,
    avgO3: o3,
    avgNo2: no2,
    avgSo2: so2,
    avgCo: co,
    avgCo2: co2,
    avgUv: uv,
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

  // Extract distinct locations to prevent combining readings from different locations into one daily maximum
  const availableLocations = useMemo(() => {
    const locMap = new Map<string, { key: string; name: string; country?: string; count: number }>();
    for (const r of records) {
      if (r.location && r.location.name) {
        const norm = r.location.name.trim();
        const key = norm.toLowerCase();
        const existing = locMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          locMap.set(key, {
            key,
            name: norm,
            country: r.location.country,
            count: 1,
          });
        }
      }
    }
    return Array.from(locMap.values());
  }, [records]);

  // Selected location (defaults to first available or empty)
  const [selectedLocation, setSelectedLocation] = useState<string>('');

  const activeLocation = useMemo(() => {
    if (selectedLocation && availableLocations.some((l) => l.name.toLowerCase() === selectedLocation.toLowerCase())) {
      return selectedLocation;
    }
    return availableLocations.length > 0 ? availableLocations[0].name : '';
  }, [selectedLocation, availableLocations]);

  // Dynamic available years list: at least past 5 years up to current year, plus any years with saved records
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    const currentYear = today.getFullYear();
    for (let y = currentYear - 5; y <= currentYear; y++) {
      yearsSet.add(y);
    }
    for (const r of records) {
      if (r.retrievalTimestamp) {
        const recYear = new Date(r.retrievalTimestamp).getFullYear();
        if (!isNaN(recYear) && recYear >= 1990 && recYear <= currentYear + 1) {
          yearsSet.add(recYear);
        }
      }
    }
    yearsSet.add(viewYear);
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [today, records, viewYear]);

  // Convenient Month and Year selection handlers
  const handleMonthSelect = useCallback((month: number) => {
    setViewMonth(month);
    if (viewYear === today.getFullYear() && month === today.getMonth()) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey(`${viewYear}-${String(month + 1).padStart(2, '0')}-01`);
    }
  }, [viewYear, today, todayKey]);

  const handleYearSelect = useCallback((year: number) => {
    setViewYear(year);
    if (year === today.getFullYear() && viewMonth === today.getMonth()) {
      setSelectedDateKey(todayKey);
    } else {
      setSelectedDateKey(`${year}-${String(viewMonth + 1).padStart(2, '0')}-01`);
    }
  }, [viewMonth, today, todayKey]);

  // Map all saved records by local date key 'YYYY-MM-DD' for the active location
  const recordsByDate = useMemo(() => {
    const map: Record<string, HistoryRecord[]> = {};
    for (const rec of records) {
      // Isolate by active location to prevent cross-location merging
      if (activeLocation) {
        const recLoc = rec.location?.name?.trim().toLowerCase();
        if (recLoc !== activeLocation.trim().toLowerCase()) {
          continue;
        }
      }
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
  }, [records, activeLocation]);

  // Month navigation handlers with intelligent date selection updates across year boundaries
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
        summary: computeDailySummary(dayRecs, activeLocation),
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
        summary: computeDailySummary(dayRecs, activeLocation),
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
        summary: computeDailySummary(dayRecs, activeLocation),
        records: dayRecs,
      });
    }

    return days;
  }, [viewYear, viewMonth, recordsByDate, todayKey, activeLocation]);

  // Selected date details
  const selectedRecords = useMemo(() => {
    return recordsByDate[selectedDateKey] || [];
  }, [recordsByDate, selectedDateKey]);

  const selectedSummary = useMemo(() => {
    return computeDailySummary(selectedRecords, activeLocation);
  }, [selectedRecords, activeLocation]);

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
        {/* Month & Year Navigation Header with Convenient Selectors */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0F766E]/40 text-[#5EEAD4] border border-[#0F766E] shrink-0 font-semibold">
                    Current
                  </span>
                )}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Daily maximum US AQI observations
                {activeLocation ? ` · ${activeLocation}` : ''}
              </p>
            </div>
          </div>

          {/* Convenient Month & Year Selectors and Navigation Arrows */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Convenient Month Selector */}
            <div className="relative">
              <select
                value={viewMonth}
                onChange={(e) => handleMonthSelect(parseInt(e.target.value, 10))}
                className="appearance-none bg-[#071A24] hover:bg-[#0B2533] border border-slate-700/80 hover:border-[#06B6D4]/60 rounded-xl px-2.5 py-1 pr-6 text-xs font-mono font-bold text-slate-200 hover:text-white cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[#06B6D4]"
                aria-label="Select month"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx} className="bg-[#071A24] text-white">
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Convenient Year Selector */}
            <div className="relative">
              <select
                value={viewYear}
                onChange={(e) => handleYearSelect(parseInt(e.target.value, 10))}
                className="appearance-none bg-[#071A24] hover:bg-[#0B2533] border border-slate-700/80 hover:border-[#06B6D4]/60 rounded-xl px-2.5 py-1 pr-6 text-xs font-mono font-bold text-slate-200 hover:text-white cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-[#06B6D4]"
                aria-label="Select year"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-[#071A24] text-white">
                    {yr}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2" />
            </div>

            {/* Jump to Today */}
            <button
              type="button"
              onClick={handleJumpToToday}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono font-medium transition-colors cursor-pointer border border-slate-700/60"
              title="Jump to current month & today"
            >
              Today
            </button>

            {/* Previous and Next Month across year boundaries */}
            <div className="flex items-center bg-slate-800/90 rounded-xl border border-slate-700/60 p-0.5">
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

        {/* Location Selector (when records from multiple locations exist) */}
        {availableLocations.length > 1 && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#071A24] border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1 shrink-0">
              <MapPin className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Location:</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {availableLocations.map((loc) => {
                const isActive = loc.name.toLowerCase() === activeLocation.toLowerCase();
                return (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => setSelectedLocation(loc.name)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#0F766E]/40 text-[#5EEAD4] border border-[#06B6D4]/60'
                        : 'bg-slate-800/60 text-slate-300 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    {loc.name} ({loc.count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    DAILY MAX US AQI
                  </span>
                </div>
              </div>

              {/* Time Range, Location & Verification Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-300">
                <div className="flex items-center gap-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  <span className="truncate">
                    {selectedSummary.isMultiple ? 'Peak observation: ' : 'Observation time: '}
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
                    {selectedSummary.isMultiple
                      ? `Atmospheric Parameters at Peak AQI (${selectedSummary.maxTime})`
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
                    {selectedSummary.pm2_5 !== null ? `${selectedSummary.pm2_5} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">PM10</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.pm10 !== null ? `${selectedSummary.pm10} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Ozone (O₃)</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.o3 !== null ? `${selectedSummary.o3} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Nitrogen Dioxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.no2 !== null ? `${selectedSummary.no2} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Sulphur Dioxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.so2 !== null ? `${selectedSummary.so2} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">Carbon Monoxide</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.co !== null ? `${selectedSummary.co} µg/m³` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">CO₂ Background</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.co2 !== null ? `${selectedSummary.co2} ppm` : 'N/A'}
                  </span>
                </div>
                <div className="bg-[#09212D]/80 p-2 rounded-xl border border-slate-800/80">
                  <span className="text-slate-500 text-[10px] block">UV Index</span>
                  <span className="text-slate-100 font-bold">
                    {selectedSummary.uv !== null ? selectedSummary.uv : 'N/A'}
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
                    const isDailyMax =
                      rec.id === selectedSummary.maxObservation.id ||
                      (rec.aqi === selectedSummary.primaryAqi && rec.time === selectedSummary.maxTime);
                    return (
                      <div
                        key={rec.id || index}
                        className={`p-3 rounded-xl border transition-colors space-y-2 ${
                          isDailyMax
                            ? 'bg-[#071A24] border-[#06B6D4]/50 shadow-sm'
                            : 'bg-[#071A24] border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
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
                            {isDailyMax && selectedSummary.isMultiple && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#06B6D4]/20 text-[#5EEAD4] border border-[#06B6D4]/40 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-[#5EEAD4]" />
                                <span>DAILY MAX</span>
                              </span>
                            )}
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
