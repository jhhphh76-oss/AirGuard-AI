import React, { useState, useEffect, useMemo } from 'react';
import { HistoryRecord, PrimaryNavTab } from '../../types/airguard';
import { historyService } from '../../services/historyService';
import { notificationService } from '../../services/notificationService';
import {
  History,
  Trash2,
  Download,
  Search,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Bell,
  Settings,
} from 'lucide-react';

interface HistoryViewProps {
  onNavigate: (tab: PrimaryNavTab) => void;
  onOpenSettings?: () => void;
}

interface DateGroup {
  dateLabel: string;
  records: HistoryRecord[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onNavigate, onOpenSettings }) => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => notificationService.getSettings().enabled
  );

  useEffect(() => {
    loadRecords();
    const unsub = notificationService.onSettingsChange((s) => {
      setNotificationsEnabled(s.enabled);
    });
    return unsub;
  }, []);

  const loadRecords = () => {
    setRecords(historyService.getHistory());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    historyService.deleteRecord(id);
    loadRecords();
  };

  const handleClearAll = () => {
    historyService.clearHistory();
    setRecords([]);
    setShowClearConfirm(false);
  };

  const handleExportCSV = () => {
    const csvStr =
      'data:text/csv;charset=utf-8,' + encodeURIComponent(historyService.exportHistoryAsCSV());
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', csvStr);
    dlAnchorElem.setAttribute('download', `airguard_history_${Date.now()}.csv`);
    dlAnchorElem.click();
  };

  // Filter records based on search term
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter(
      (r) =>
        r.location.name.toLowerCase().includes(term) ||
        (r.location.country && r.location.country.toLowerCase().includes(term)) ||
        r.date.toLowerCase().includes(term) ||
        r.category.toLowerCase().includes(term)
    );
  }, [records, searchTerm]);

  // Group records by date (Today, Yesterday, Month Day, etc.)
  const groupedAllRecords = useMemo(() => {
    const groups: { [key: string]: DateGroup } = {};
    const order: string[] = [];

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayMidnight = todayMidnight - oneDayMs;

    for (const rec of filteredRecords) {
      const recDate = new Date(rec.retrievalTimestamp);
      const recMidnight = new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate()).getTime();

      let label = '';
      if (recMidnight === todayMidnight) {
        label = 'Today';
      } else if (recMidnight === yesterdayMidnight) {
        label = 'Yesterday';
      } else {
        label = recDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: recDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        });
      }

      const key = `date_${recMidnight}`;
      if (!groups[key]) {
        groups[key] = { dateLabel: label, records: [] };
        order.push(key);
      }
      groups[key].records.push(rec);
    }

    return order.map((k) => groups[k]);
  }, [filteredRecords]);

  // For compact Main History view: show recent date groups (e.g. up to 6 records total)
  const compactGroups = useMemo(() => {
    let count = 0;
    const result: DateGroup[] = [];
    for (const g of groupedAllRecords) {
      if (count >= 6) break;
      const remaining = 6 - count;
      const slice = g.records.slice(0, remaining);
      result.push({
        dateLabel: g.dateLabel,
        records: slice,
      });
      count += slice.length;
    }
    return result;
  }, [groupedAllRecords]);

  // Color helper for AQI category pills
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Good':
        return '#22C55E';
      case 'Moderate':
        return '#EAB308';
      case 'Unhealthy for Sensitive Groups':
        return '#F97316';
      case 'Unhealthy':
        return '#EF4444';
      case 'Very Unhealthy':
        return '#A855F7';
      case 'Hazardous':
        return '#7E22CE';
      default:
        return '#5EEAD4';
    }
  };

  // Trend analysis calculations
  const chronologicalRecords = [...records].reverse();
  const hasEnoughRecords = chronologicalRecords.length >= 2;
  let trendExplanation = '';
  let highestRecord: HistoryRecord | null = null;

  if (hasEnoughRecords) {
    const firstAqi = chronologicalRecords[0].aqi;
    const lastAqi = chronologicalRecords[chronologicalRecords.length - 1].aqi;
    const diff = lastAqi - firstAqi;
    highestRecord = [...chronologicalRecords].sort((a, b) => b.aqi - a.aqi)[0];

    if (diff > 10) {
      trendExplanation = `Overall exposure trend has increased by +${diff} AQI across your logged timeline. High readings were observed around ${highestRecord.location.name} (${highestRecord.aqi} AQI).`;
    } else if (diff < -10) {
      trendExplanation = `Overall exposure trend has improved by ${Math.abs(diff)} AQI compared to your earliest recorded session. Baseline conditions are cleaner.`;
    } else {
      trendExplanation = `Recorded exposure has remained steady with minimal overall variance across ${records.length} saved sessions.`;
    }
  }

  // SVG Chart points
  const chartHeight = 110;
  const chartWidth = 360;
  const paddingX = 24;
  const paddingY = 18;
  const chartRecords = chronologicalRecords.slice(-15);
  const maxAqi = Math.max(100, ...chartRecords.map((r) => r.aqi));
  const minAqi = 0;

  const getX = (idx: number) => {
    if (chartRecords.length <= 1) return paddingX;
    return paddingX + (idx / (chartRecords.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val: number) => {
    const norm = (val - minAqi) / (maxAqi - minAqi || 1);
    return chartHeight - paddingY - norm * (chartHeight - paddingY * 2);
  };

  const pointsPath = chartRecords
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(r.aqi).toFixed(1)}`)
    .join(' ');

  // Render a compact single-line history item
  const renderHistoryRow = (rec: HistoryRecord) => {
    const isExpanded = expandedRecordId === rec.id;
    const color = getCategoryColor(rec.category);

    return (
      <div
        key={rec.id}
        onClick={() => setExpandedRecordId(isExpanded ? null : rec.id)}
        className="rounded-xl bg-[#071A24] border border-slate-800/80 hover:border-slate-700/80 transition-all cursor-pointer overflow-hidden shadow-sm"
      >
        {/* Compact Single Row matching format: 17:00 — AQI 82 — Moderate */}
        <div className="py-2.5 px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 font-mono text-xs">
            <span className="text-slate-400 font-semibold shrink-0">
              {rec.time ? rec.time.slice(0, 5) : '—'}
            </span>
            <span className="text-slate-600">—</span>
            <span className="text-white font-bold shrink-0">AQI {rec.aqi}</span>
            <span className="text-slate-600">—</span>
            <span
              className="font-semibold truncate max-w-[120px]"
              style={{ color }}
            >
              {rec.category}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-sans truncate max-w-[85px]">
              {rec.location.name}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            )}
          </div>
        </div>

        {/* Expandable Pollutant Breakdown when tapped */}
        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-slate-800/70 bg-[#05141D] space-y-2 text-xs animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
              <span>{rec.location.name}, {rec.location.country || ''}</span>
              <span>{rec.date} {rec.time}</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">PM2.5</span>
                <span className="font-bold text-white">
                  {rec.pollutants.pm2_5 !== null ? `${rec.pollutants.pm2_5} µg/m³` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">PM10</span>
                <span className="font-bold text-white">
                  {rec.pollutants.pm10 !== null ? `${rec.pollutants.pm10} µg/m³` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">NO₂</span>
                <span className="font-bold text-white">
                  {rec.pollutants.no2 !== null ? `${rec.pollutants.no2} µg/m³` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">O₃</span>
                <span className="font-bold text-white">
                  {rec.pollutants.o3 !== null ? `${rec.pollutants.o3} µg/m³` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">CO</span>
                <span className="font-bold text-white">
                  {rec.pollutants.co !== null ? `${rec.pollutants.co} µg/m³` : 'N/A'}
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                <span className="text-slate-400 block text-[9px]">SO₂</span>
                <span className="font-bold text-white">
                  {rec.pollutants.so2 !== null ? `${rec.pollutants.so2} µg/m³` : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] font-mono text-slate-500">Source: Open-Meteo Verified Feed</span>
              <button
                type="button"
                onClick={(e) => handleDelete(rec.id, e)}
                className="text-[10px] text-slate-400 hover:text-[#EF4444] flex items-center gap-1 font-semibold transition-colors"
                title="Delete this record"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW MODE: EXPANDED FULL HISTORY VIEW ("See More History")
  // -------------------------------------------------------------
  if (showAllHistory) {
    return (
      <div className="p-4 space-y-4 pb-8 animate-in fade-in">
        {/* Navigation back to compact view */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowAllHistory(false)}
            className="py-2 px-3 rounded-xl bg-[#09212D] hover:bg-slate-800 border border-[#263238] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#5EEAD4]" />
            <span>← Back to Summary</span>
          </button>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
            {filteredRecords.length} stored records
          </span>
        </div>

        {/* Search Bar & Actions */}
        <div className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-2.5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Complete Stored History</h2>
              <p className="text-[10px] text-slate-400">All sessions grouped chronologically by date</p>
            </div>
            {records.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="py-1 px-2.5 rounded-lg bg-[#071A24] hover:bg-slate-800 text-slate-300 text-[10px] font-semibold flex items-center gap-1 border border-slate-700/80 transition-colors"
                  title="Export records to CSV"
                >
                  <Download className="w-3 h-3 text-[#22C55E]" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="py-1 px-2.5 rounded-lg bg-[#EF4444]/15 hover:bg-[#EF4444]/25 text-[#EF4444] text-[10px] font-semibold flex items-center gap-1 border border-[#EF4444]/30 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative pt-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by city, date or category..."
              className="w-full pl-9 pr-3 py-2 bg-[#071A24] border border-[#263238] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06B6D4]"
            />
          </div>

          {/* Confirm clear inline */}
          {showClearConfirm && (
            <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 space-y-2 animate-in fade-in">
              <p className="text-xs text-white font-semibold">
                Clear all {records.length} stored history records?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 py-1.5 rounded-xl bg-[#EF4444] text-white text-xs font-bold"
                >
                  Yes, Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Grouped Records List */}
        {groupedAllRecords.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#09212D]/60 border border-[#263238] text-center space-y-2">
            <p className="text-xs font-semibold text-white">No matching records found.</p>
            <p className="text-[11px] text-slate-400">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedAllRecords.map((group) => (
              <section key={group.dateLabel} className="space-y-2">
                <div className="px-1 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 font-mono flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>{group.dateLabel}</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {group.records.length} {group.records.length === 1 ? 'record' : 'records'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.records.map((rec) => renderHistoryRow(rec))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE: COMPACT MAIN HISTORY VIEW (Default)
  // -------------------------------------------------------------
  return (
    <div className="p-4 space-y-4 pb-8 animate-in fade-in">
      {/* 1. Header with Summary Stats & Notification Quick Toggle */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs uppercase font-mono font-semibold text-slate-400">
            <History className="w-4 h-4 text-slate-300" />
            <span>AirGuard History</span>
          </div>
          <span className="text-[10px] font-mono text-[#5EEAD4] bg-[#0F766E]/25 px-2.5 py-0.5 rounded-full border border-[#0F766E]/40">
            {records.length} saved {records.length === 1 ? 'reading' : 'readings'}
          </span>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white">Telemetry Timeline</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Preserved air-quality records collected during actual Open-Meteo checks
          </p>
        </div>

        {/* Notification settings link */}
        <div className="pt-1 flex items-center justify-between p-2.5 rounded-2xl bg-[#071A24] border border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className={`w-3.5 h-3.5 ${notificationsEnabled ? 'text-[#5EEAD4]' : 'text-slate-500'}`} />
            <span className="text-[11px] text-slate-300 font-medium">
              AQI Notifications:
            </span>
            <span
              className={`text-[10px] font-mono font-bold ${
                notificationsEnabled ? 'text-[#5EEAD4]' : 'text-slate-400'
              }`}
            >
              {notificationsEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] font-semibold text-[#06B6D4] hover:underline flex items-center gap-1"
            >
              <Settings className="w-3 h-3" />
              <span>Configure</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Visual History Trend Curve */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-2 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Recorded AQI History Curve</span>
          </h2>
          <span className="text-[10px] font-mono text-slate-400">
            {chartRecords.length} points
          </span>
        </div>

        {!hasEnoughRecords ? (
          <div className="p-4 text-center rounded-2xl bg-[#071A24] border border-slate-800 space-y-1">
            <p className="text-xs font-semibold text-slate-300">
              Not enough readings yet to chart a multi-point trend curve.
            </p>
            <p className="text-[10px] text-slate-500">
              Readings are saved automatically as you check air quality.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-hidden select-none pt-1">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              <path
                d={pointsPath}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chartRecords.map((r, idx) => (
                <circle
                  key={r.id}
                  cx={getX(idx)}
                  cy={getY(r.aqi)}
                  r={3.5}
                  fill="#5EEAD4"
                  stroke="#071A24"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <div className="flex justify-between text-[9px] font-mono text-slate-500 px-2 pt-1 border-t border-slate-800 mt-1">
              <span>{chartRecords[0]?.date}</span>
              <span>{chartRecords[chartRecords.length - 1]?.date}</span>
            </div>
          </div>
        )}
      </section>

      {/* 3. AI Long-Term Trend Summary */}
      {hasEnoughRecords && (
        <section className="p-3.5 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1.5 shadow-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#5EEAD4]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
              Exposure Trend Analysis
            </span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            {trendExplanation}
          </p>
        </section>
      )}

      {/* 4. COMPACT RECENT AIR QUALITY LIST (Matches user requirement) */}
      <section className="space-y-3">
        <div className="px-1 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            Recent Air Quality
          </h2>
          <span className="text-[10px] font-mono text-slate-500">Compact list</span>
        </div>

        {records.length === 0 ? (
          <div className="p-6 rounded-3xl bg-[#09212D]/60 border border-[#263238] text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-[#0F766E]/20 text-[#06B6D4] mx-auto flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-white">No Telemetry Logged Yet</p>
            <p className="text-[11px] text-slate-400">
              When you check air quality, verified readings are saved here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {compactGroups.map((group) => (
              <div key={group.dateLabel} className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 block px-1">
                  {group.dateLabel}
                </span>
                <div className="space-y-1.5">
                  {group.records.map((rec) => renderHistoryRow(rec))}
                </div>
              </div>
            ))}

            {/* Prominent "See more history →" Button */}
            <button
              type="button"
              onClick={() => setShowAllHistory(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#09212D] hover:bg-[#0F766E]/20 border border-[#263238] hover:border-[#0F766E]/60 text-[#5EEAD4] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md group mt-2"
            >
              <span>See more history ({records.length} records) →</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
