import React, { useState, useEffect, useMemo } from 'react';
import { HistoryRecord, PrimaryNavTab } from '../../types/airguard';
import { historyService } from '../../services/historyService';
import { notificationService } from '../../services/notificationService';
import { researchAnalysisService } from '../../services/research/researchAnalysisService';
import { ResearchMeasurementRecord } from '../../services/research/types';
import { ResearchMeasurementModal } from '../Research/ResearchMeasurementModal';
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
  Camera,
  Layers,
  Shield,
  Check,
  Activity,
  CheckCircle2,
  AlertTriangle,
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
  const [historyTab, setHistoryTab] = useState<'air_quality' | 'research'>('air_quality');
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [researchRecords, setResearchRecords] = useState<ResearchMeasurementRecord[]>([]);
  const [selectedResearchRecord, setSelectedResearchRecord] = useState<ResearchMeasurementRecord | null>(null);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => notificationService.getSettings().enabled
  );

  useEffect(() => {
    loadAllRecords();
    const unsub = notificationService.onSettingsChange((s) => {
      setNotificationsEnabled(s.enabled);
    });
    return unsub;
  }, []);

  const loadAllRecords = () => {
    setRecords(historyService.getHistory());
    setResearchRecords(researchAnalysisService.getMeasurements());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    historyService.deleteRecord(id);
    loadAllRecords();
  };

  const handleDeleteResearchRecord = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    researchAnalysisService.deleteMeasurement(id);
    loadAllRecords();
  };

  const handleClearAll = () => {
    if (historyTab === 'air_quality') {
      historyService.clearHistory();
    } else {
      researchAnalysisService.clearAllMeasurements();
    }
    loadAllRecords();
    setShowClearConfirm(false);
  };

  const handleExportCSV = () => {
    if (historyTab === 'air_quality') {
      const csvStr =
        'data:text/csv;charset=utf-8,' + encodeURIComponent(historyService.exportHistoryAsCSV());
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute('href', csvStr);
      dlAnchorElem.setAttribute('download', `airguard_history_${Date.now()}.csv`);
      dlAnchorElem.click();
    } else {
      const csvStr =
        'data:text/csv;charset=utf-8,' +
        encodeURIComponent(researchAnalysisService.exportResearchMeasurementsAsCSV());
      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute('href', csvStr);
      dlAnchorElem.setAttribute('download', `airguard_optical_research_${Date.now()}.csv`);
      dlAnchorElem.click();
    }
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
          month: 'short',
          day: 'numeric',
        });
      }

      if (!groups[label]) {
        groups[label] = { dateLabel: label, records: [] };
        order.push(label);
      }
      groups[label].records.push(rec);
    }

    return order.map((lbl) => groups[lbl]);
  }, [filteredRecords]);

  // Recent preview (max 6 items)
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
        <div className="p-2.5 flex items-center justify-between text-xs gap-2 select-none">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-mono text-slate-400 text-[11px] shrink-0">{rec.time.slice(0, 5)}</span>
            <span className="text-slate-600 shrink-0">·</span>
            <span className="font-bold text-white text-[11px] shrink-0 font-mono">AQI {rec.aqi}</span>
            <span className="text-slate-600 shrink-0">·</span>
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span
                className="text-[11px] font-medium truncate text-slate-200"
                title={`${rec.category} in ${rec.location.name}`}
              >
                {rec.category} in {rec.location.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pt-1 border-t border-slate-800/80 bg-[#09212D]/40 space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300 pt-1">
              <div>PM2.5: {rec.pollutants.pm2_5 ?? 'N/A'} µg/m³</div>
              <div>PM10: {rec.pollutants.pm10 ?? 'N/A'} µg/m³</div>
              <div>O₃: {rec.pollutants.o3 ?? 'N/A'} µg/m³</div>
              <div>NO₂: {rec.pollutants.no2 ?? 'N/A'} µg/m³</div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
              <span className="text-slate-400 font-mono">Source: {rec.source}</span>
              <button
                type="button"
                onClick={(e) => handleDelete(rec.id, e)}
                className="text-red-400 hover:text-red-300 p-1 flex items-center gap-1"
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

  // Chronological research records (Measurement 1, 2, 3...)
  const chronologicalResearch = useMemo(() => {
    return [...researchRecords].sort((a, b) => a.timestamp - b.timestamp);
  }, [researchRecords]);

  return (
    <div className="p-4 space-y-4 pb-8 select-none">
      {/* 1. Header with Tab Switcher */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs uppercase font-mono font-semibold text-slate-400">
            <History className="w-4 h-4 text-slate-300" />
            <span>AirGuard History</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
              title="Export CSV data"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
              title="Clear history"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-bold text-white">Historical Telemetry & Research</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Preserved environmental air records and optical skin research measurements
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setHistoryTab('air_quality')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              historyTab === 'air_quality'
                ? 'bg-[#0F766E]/30 border-[#06B6D4] text-white shadow-md'
                : 'bg-[#071A24] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Air Quality ({records.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab('research')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              historyTab === 'research'
                ? 'bg-[#0F766E]/30 border-[#5EEAD4] text-white shadow-md'
                : 'bg-[#071A24] border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#5EEAD4]" />
            <span>Research ({researchRecords.length})</span>
          </button>
        </div>

        {/* Clear Confirmation Prompt */}
        {showClearConfirm && (
          <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-white space-y-2 animate-in fade-in">
            <span className="font-bold text-[#EF4444] block">
              Clear all {historyTab === 'air_quality' ? 'air quality records' : 'research measurements'}?
            </span>
            <p className="text-[11px] text-slate-300">
              This action cannot be undone. Saved records will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl bg-[#EF4444] text-white font-bold text-xs"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* TAB 1: AIR QUALITY TELEMETRY                                        */}
      {/* =================================================================== */}
      {historyTab === 'air_quality' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Notification settings link */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#09212D] border border-slate-800 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className={`w-3.5 h-3.5 shrink-0 ${notificationsEnabled ? 'text-[#5EEAD4]' : 'text-slate-500'}`} />
              <span className="text-[11px] text-slate-300 font-medium truncate">
                AQI Notifications:
              </span>
              <span
                className={`text-[10px] font-mono font-bold shrink-0 ${
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
                className="text-[11px] font-semibold text-[#06B6D4] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Settings className="w-3 h-3 shrink-0" />
                <span>Configure</span>
              </button>
            )}
          </div>

          {/* Visual History Trend Curve */}
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

          {/* AI Long-Term Trend Summary */}
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

          {/* Compact Recent Air Quality List */}
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
                {(showAllHistory ? groupedAllRecords : compactGroups).map((group) => (
                  <div key={group.dateLabel} className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-300 block px-1">
                      {group.dateLabel}
                    </span>
                    <div className="space-y-1.5">
                      {group.records.map((rec) => renderHistoryRow(rec))}
                    </div>
                  </div>
                ))}

                {records.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#09212D] hover:bg-[#0F766E]/20 border border-[#263238] hover:border-[#0F766E]/60 text-[#5EEAD4] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md group mt-2"
                  >
                    <span>
                      {showAllHistory
                        ? 'Show less history ↑'
                        : `See More History (${records.length} records) →`}
                    </span>
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: OPTICAL RESEARCH MEASUREMENTS (Requirements 14 & 15)         */}
      {/* =================================================================== */}
      {historyTab === 'research' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Research Timeline Visual Nodes (Requirement 15) */}
          <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#5EEAD4]" />
                <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Research Timeline
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {chronologicalResearch.length} sessions
              </span>
            </div>

            {chronologicalResearch.length === 0 ? (
              <div className="p-4 text-center rounded-2xl bg-[#071A24] border border-slate-800 space-y-1">
                <p className="text-xs font-semibold text-slate-300">
                  No optical research sessions recorded yet.
                </p>
                <p className="text-[10px] text-slate-500">
                  Open the Camera prototype to perform an optical acquisition.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto pb-1 pt-2">
                <div className="flex items-center gap-2 min-w-max px-1">
                  {chronologicalResearch.map((item, idx) => {
                    const isLast = idx === chronologicalResearch.length - 1;
                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedResearchRecord(item);
                            setIsResearchModalOpen(true);
                          }}
                          className="p-2.5 rounded-2xl bg-[#071A24] hover:bg-[#0F766E]/20 border border-slate-800 hover:border-[#0F766E] transition-all cursor-pointer text-left space-y-1 min-w-[110px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-bold text-[#5EEAD4]">
                              #{item.sessionIndex}
                            </span>
                            <span className="text-[8px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                              {new Date(item.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-white truncate">
                            {item.location?.name || 'Local Site'}
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 truncate">
                            {item.opticalFeatures?.nose?.variationCategory || 'Recorded'}
                          </div>
                        </button>
                        {!isLast && (
                          <div className="w-4 h-0.5 bg-slate-700 shrink-0" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Research Measurements List (Requirement 14) */}
          <section className="space-y-3">
            <div className="px-1 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Optical Measurement Records
              </h2>
              <span className="text-[10px] font-mono text-slate-500">Tap to inspect</span>
            </div>

            {researchRecords.length === 0 ? (
              <div className="p-6 rounded-3xl bg-[#09212D]/60 border border-[#263238] text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[#0F766E]/20 text-[#5EEAD4] mx-auto flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-white">No Optical Research Records</p>
                <p className="text-[11px] text-slate-400">
                  When you analyze photos with the Research Camera, complete records are preserved here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {researchRecords.map((meas) => {
                  const measDate = new Date(meas.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });
                  const measTime = new Date(meas.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={meas.id}
                      onClick={() => {
                        setSelectedResearchRecord(meas);
                        setIsResearchModalOpen(true);
                      }}
                      className="p-3 rounded-2xl bg-[#09212D] border border-slate-800 hover:border-[#0F766E]/60 transition-all cursor-pointer shadow-md space-y-2"
                    >
                      {/* Top Row: Date/Time + Location + Simulation Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono font-bold text-[#5EEAD4] text-xs shrink-0">
                            #{meas.sessionIndex}
                          </span>
                          <span className="text-slate-500 shrink-0">·</span>
                          <span className="font-mono text-slate-400 text-[11px] shrink-0 whitespace-nowrap">
                            {measDate} {measTime}
                          </span>
                          <span className="text-slate-500 shrink-0">·</span>
                          <span className="font-semibold text-white text-xs truncate min-w-0 flex-1">
                            {meas.location?.name || 'Local Site'}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40 shrink-0 whitespace-nowrap self-start sm:self-auto">
                          SIMULATION
                        </span>
                      </div>

                      {/* Required Metrics Grid (Requirement 14): Acquisition, Calibration, Image Quality, Environmental */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono pt-1 border-t border-slate-800/80">
                        <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                          <span className="text-slate-500 block text-[8px] uppercase">Mode</span>
                          <span className="text-slate-300 font-bold">
                            {meas.acquisitionMode === 'live_camera' ? 'Camera' : 'Gallery'}
                          </span>
                        </div>

                        <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                          <span className="text-slate-500 block text-[8px] uppercase">Calibration</span>
                          <span
                            className={
                              meas.calibration.isReady ? 'text-[#22C55E] font-bold' : 'text-[#EF4444]'
                            }
                          >
                            {meas.calibration.isReady ? '✓ Valid' : 'Incomplete'}
                          </span>
                        </div>

                        <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                          <span className="text-slate-500 block text-[8px] uppercase">Quality</span>
                          <span
                            className={
                              meas.imageQuality.qualityCategory === 'Good'
                                ? 'text-[#22C55E] font-bold'
                                : 'text-[#F59E0B]'
                            }
                          >
                            {meas.imageQuality.qualityCategory}
                          </span>
                        </div>

                        <div className="p-1.5 rounded-lg bg-[#071A24] border border-slate-800">
                          <span className="text-slate-500 block text-[8px] uppercase">Atmosphere</span>
                          <span className="text-[#38BDF8] font-bold truncate block">
                            {meas.environmentalMeasurements?.measurements.aqi !== null
                              ? `AQI ${meas.environmentalMeasurements?.measurements.aqi}`
                              : 'Unavailable'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Subtext */}
                      <div className="flex items-center justify-between text-[9px] text-slate-400 pt-0.5">
                        <span>Analysis: {meas.dataStatus}</span>
                        <div className="flex items-center gap-1.5 text-[#5EEAD4]">
                          <span>Inspect Record →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Full Research Measurement Detail Modal (Requirement 14) */}
      <ResearchMeasurementModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
        record={selectedResearchRecord}
        onRecordUpdated={loadAllRecords}
        onRecordDeleted={loadAllRecords}
      />
    </div>
  );
};
