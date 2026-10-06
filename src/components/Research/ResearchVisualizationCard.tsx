/**
 * AirGuard AI - Research Visualization Component
 * 
 * Displays:
 * AIRGUARDIAN RESEARCH VISUALIZATION
 * - Responsive header: Title wraps naturally, badge never overlaps (stacks on mobile, side-by-side on desktop)
 * - Data Quality Panel: Responsive 1-col on mobile, 2-col on tablet/desktop, min-w-0 flex-1 truncate labels and shrink-0 badges
 * - Image Quality: Responsive card with clear exposure, blur score, and coverage
 * - Calibration Pipeline: 4-stage pipeline with responsive flex layout
 * - Facial Region Analysis: Forehead, Nose, Left cheek, Right cheek, Chin (cautious optical variation labels)
 * - Personal Baseline: Current vs Personal Baseline comparison
 * - Spectral Visualization: Band 1..N with preview slices, regional mean & variation
 * - Reflectance Curve: Calibrated reflectance plot across bands
 * - Environmental Conditions & Time Alignment (optical timestamp, environmental timestamp, minute diff)
 * - Environmental Association: Active when longitudinal data exists; strict CORRELATION vs CAUSATION disclaimer
 * - 5-Stage AI Research Reasoning: DATA -> OBSERVATION -> COMPARISON -> ENVIRONMENTAL ASSOCIATION -> LIMITATION
 * - Privacy Controls: Save measurement, delete sensitive face image, delete record
 */

import React, { useState } from 'react';
import {
  Shield,
  Layers,
  Sparkles,
  Database,
  Activity,
  ChevronDown,
  ChevronUp,
  MapPin,
  TrendingUp,
  Check,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  FaceRegion,
  RegionalOpticalFeatures,
  SpectralCube,
  EnvironmentalSnapshot,
  CalibrationState,
  HardwareStatus,
  QualifiedResearchInterpretation,
  ImageQualityMetrics,
  TimeAlignmentInfo,
  PersonalBaselineComparison,
  DataQualityPanelStatus,
  MeasurementDataStatus,
} from '../../services/research/types';

interface ResearchVisualizationCardProps {
  cube: SpectralCube;
  regionalFeatures: Record<FaceRegion, RegionalOpticalFeatures>;
  environmental: EnvironmentalSnapshot | null;
  calibration: CalibrationState;
  hardware: HardwareStatus;
  interpretation: QualifiedResearchInterpretation;
  confidenceScore?: number;
  imageQuality?: ImageQualityMetrics;
  timeAlignment?: TimeAlignmentInfo;
  baselineComparison?: PersonalBaselineComparison;
  dataQuality?: DataQualityPanelStatus;
  dataStatus?: MeasurementDataStatus;
  onSaveToHistory?: () => void;
  isSaved?: boolean;
  onDeleteImage?: () => void;
  imageDataUrl?: string | null;
}

export const ResearchVisualizationCard: React.FC<ResearchVisualizationCardProps> = ({
  cube,
  regionalFeatures,
  environmental,
  calibration,
  hardware,
  interpretation,
  imageQuality,
  timeAlignment,
  baselineComparison,
  dataQuality,
  dataStatus = 'SIMULATED DATA',
  onSaveToHistory,
  isSaved = false,
  onDeleteImage,
  imageDataUrl,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<FaceRegion>('nose');
  const [selectedBandIndex, setSelectedBandIndex] = useState<number>(0);
  const [showSpectralSection, setShowSpectralSection] = useState(true);
  const [showDataQualityPanel, setShowDataQualityPanel] = useState(true);

  const regionKeys: FaceRegion[] = [
    'forehead',
    'left_cheek',
    'right_cheek',
    'nose',
    'chin',
  ];

  const activeFeatures = regionalFeatures[selectedRegion] || regionalFeatures['nose'];
  const activeBand = cube.bands[selectedBandIndex] || cube.bands[0];

  // Variation badge styling helper (strictly neutral scientific terms)
  const getVariationBadge = (cat: string) => {
    switch (cat) {
      case 'Low variation':
        return 'text-[#22C55E] bg-[#22C55E]/15 border-[#22C55E]/30';
      case 'Moderate variation':
        return 'text-[#06B6D4] bg-[#06B6D4]/15 border-[#06B6D4]/30';
      case 'Higher variation':
        return 'text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/30';
      case 'Insufficient data':
      default:
        return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  // Data status badge helper (Requirements 2, 3, 7)
  const renderDataStatusBadge = () => {
    switch (dataStatus) {
      case 'REAL MEASUREMENT':
        return (
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]">
            ● REAL ACQUISITION
          </span>
        );
      case 'RGB IMAGE ONLY':
        return (
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-[#06B6D4]/20 text-[#5EEAD4] border border-[#06B6D4]/60">
            RGB IMAGE ONLY
          </span>
        );
      case 'MULTISPECTRAL HARDWARE NOT CONNECTED':
        return (
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/60">
            SOFTWARE OPTICAL MODE
          </span>
        );
      case 'INCOMPLETE DATA':
        return (
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/60">
            ⚠ INCOMPLETE DATA
          </span>
        );
      case 'SIMULATED DATA':
      default:
        return (
          <span className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-mono font-extrabold bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/60">
            OPTICAL CAMERA RECORD
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 text-xs select-none">
      {/* 1. AIRGUARDIAN RESEARCH VISUALIZATION HEADER (Requirements 2 & 7: Never overlaps) */}
      <div className="p-4 rounded-3xl bg-[#071A24] border border-[#263238] space-y-3 shadow-xl relative overflow-hidden">
        {/* Responsive flex-col on mobile, sm:flex-row on larger screens */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#06B6D4] border border-[#0F766E]/30 shrink-0 mt-0.5">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#38BDF8] block font-bold">
                AirGuardian
              </span>
              <h2 className="text-sm font-extrabold text-white tracking-tight break-words min-w-0">
                RESEARCH VISUALIZATION
              </h2>
            </div>
          </div>
          <div className="shrink-0 self-start sm:self-center">
            {renderDataStatusBadge()}
          </div>
        </div>

        {/* Optical Mode Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[10px] text-slate-400 pt-2 border-t border-slate-800">
          <span className="font-mono text-[#5EEAD4] font-semibold break-words min-w-0 flex-1">
            Standard Device Camera Optical Analysis
          </span>
          <span className="font-mono text-slate-400 shrink-0 whitespace-nowrap">
            Software Engine (Zero External Hardware Required)
          </span>
        </div>
      </div>

      {/* 2. DATA QUALITY PANEL (Requirement 3: Never overflows or overlaps) */}
      <section className="p-3.5 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2 shadow-md">
        <div
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => setShowDataQualityPanel(!showDataQualityPanel)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Shield className="w-3.5 h-3.5 text-[#5EEAD4] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              Data Quality Panel
            </h2>
          </div>
          <div className="shrink-0">
            {showDataQualityPanel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {showDataQualityPanel && dataQuality && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[10px] font-mono animate-in fade-in">
            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Camera Acquisition
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.cameraAcquisition === 'Good'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30'
                }`}
              >
                {dataQuality.cameraAcquisition}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Calibration
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.calibration === 'Valid'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-[#EF4444] bg-[#EF4444]/15 border border-[#EF4444]/30'
                }`}
              >
                {dataQuality.calibration}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Face Segmentation
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.faceSegmentation === 'Valid'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30'
                }`}
              >
                {dataQuality.faceSegmentation}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Spectral Data
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.spectralData === 'Available'
                    ? 'text-[#06B6D4] bg-[#06B6D4]/15 border border-[#06B6D4]/30'
                    : 'text-slate-400 bg-slate-800 border border-slate-700'
                }`}
              >
                {dataQuality.spectralData}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Environmental Data
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.environmentalData === 'Available'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-slate-400 bg-slate-800 border border-slate-700'
                }`}
              >
                {dataQuality.environmentalData}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Time Alignment
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.timeAlignment === 'Valid'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30'
                }`}
              >
                {dataQuality.timeAlignment}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2 sm:col-span-2">
              <span className="text-slate-300 min-w-0 flex-1 break-words sm:truncate text-[11px]">
                Longitudinal Data
              </span>
              <span
                className={`shrink-0 whitespace-nowrap font-bold px-2 py-0.5 rounded-md ${
                  dataQuality.longitudinalData === 'Sufficient'
                    ? 'text-[#22C55E] bg-[#22C55E]/15 border border-[#22C55E]/30'
                    : 'text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/30'
                }`}
              >
                {dataQuality.longitudinalData}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* 3. IMAGE QUALITY & CALIBRATION DUAL SUMMARY (Requirements 4 & 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Image Quality Card */}
        {imageQuality && (
          <section className="p-3.5 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
              <span className="text-xs font-bold text-white font-mono uppercase tracking-wide min-w-0 break-words">
                Image Quality
              </span>
              <span
                className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold font-mono self-start sm:self-auto ${
                  imageQuality.qualityCategory === 'Good'
                    ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                    : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                }`}
              >
                {imageQuality.qualityCategory}
              </span>
            </div>
            <div className="space-y-1 text-[10px] text-slate-300">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 min-w-0 flex-1 truncate">Exposure:</span>
                <span className="font-mono text-white shrink-0 whitespace-nowrap">
                  {imageQuality.exposureQuality} (L: {imageQuality.meanLuminance}/255)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 min-w-0 flex-1 truncate">Sharpness Metric:</span>
                <span className="font-mono text-white shrink-0 whitespace-nowrap">
                  {imageQuality.blurSharpnessScore} {imageQuality.isSharp ? '✓ (Adequate)' : '⚠ (Blurry)'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 min-w-0 flex-1 truncate">Face Coverage:</span>
                <span className="font-mono text-white shrink-0 whitespace-nowrap">
                  {imageQuality.usableFaceAreaPercent}% ({imageQuality.faceDetectionConfidence}% conf)
                </span>
              </div>
            </div>
            {imageQuality.issues.length > 0 && (
              <div className="p-2 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[10px] text-[#F59E0B] space-y-0.5">
                {imageQuality.issues.map((issue, idx) => (
                  <p key={idx} className="leading-snug break-words">
                    • {issue}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Calibration Pipeline Card (Requirement 5) */}
        <section className="p-3.5 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <span className="text-xs font-bold text-white font-mono uppercase tracking-wide min-w-0 break-words">
              Calibration Pipeline
            </span>
            <span
              className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold font-mono self-start sm:self-auto ${
                calibration.isReady && calibration.normalized
                  ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                  : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
              }`}
            >
              {calibration.isReady && calibration.normalized ? '✓ Complete' : '⚠ Incomplete'}
            </span>
          </div>
          <div className="space-y-1 text-[10px] font-mono">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 truncate">Dark Reference</span>
              <span className={`shrink-0 whitespace-nowrap ${calibration.darkCaptured ? 'text-[#22C55E] font-bold' : 'text-slate-500'}`}>
                {calibration.darkCaptured ? `✓ Captured (${calibration.darkValue.toFixed(1)})` : '✗ Not captured'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 truncate">Reference Target (White)</span>
              <span className={`shrink-0 whitespace-nowrap ${calibration.whiteCaptured ? 'text-[#22C55E] font-bold' : 'text-slate-500'}`}>
                {calibration.whiteCaptured ? `✓ Captured (${calibration.whiteValue.toFixed(1)})` : '✗ Not captured'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 truncate">Skin Acquisition</span>
              <span className={`shrink-0 whitespace-nowrap ${calibration.skinCaptured ? 'text-[#22C55E] font-bold' : 'text-slate-500'}`}>
                {calibration.skinCaptured ? '✓ Captured' : '✗ Not captured'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300 min-w-0 flex-1 truncate">Normalization</span>
              <span className={`shrink-0 whitespace-nowrap ${calibration.normalized ? 'text-[#22C55E] font-bold' : 'text-slate-500'}`}>
                {calibration.normalized ? '✓ Applied' : '✗ Incomplete'}
              </span>
            </div>
          </div>
          <p className="text-[9px] font-mono text-slate-400 pt-0.5 border-t border-slate-800 break-words">
            {calibration.formula}
          </p>
        </section>
      </div>

      {/* 4. FACIAL REGION ANALYSIS (Requirement 8) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-4 h-4 text-[#06B6D4] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              Facial Region Analysis
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 self-start sm:self-auto">
            Select region for optical detail
          </span>
        </div>

        {/* Region Selector Pills */}
        <div className="grid grid-cols-5 gap-1.5">
          {regionKeys.map((key) => {
            const feat = regionalFeatures[key];
            const isSelected = selectedRegion === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedRegion(key)}
                className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0F766E]/30 border-[#06B6D4] text-white shadow-md'
                    : 'bg-[#071A24] border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-[10px] truncate">{feat?.regionLabel || key}</div>
                <div className="text-[9px] mt-0.5 font-mono text-slate-400">
                  {feat?.meanReflectance ? `${(feat.meanReflectance * 100).toFixed(0)}%` : '—'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Region Optical Metrics */}
        {activeFeatures && (
          <div className="p-3.5 rounded-2xl bg-[#071A24] border border-slate-800 space-y-2.5 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-white uppercase font-mono tracking-wide block truncate">
                  {activeFeatures.regionLabel}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Confidence: {activeFeatures.confidence}% · Usable Box: {activeFeatures.boundingBox.width}×{activeFeatures.boundingBox.height}
                </span>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border self-start sm:self-auto ${getVariationBadge(
                  activeFeatures.variationCategory
                )}`}
              >
                {activeFeatures.variationCategory}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1">
              <div className="p-2 rounded-xl bg-[#09212D] border border-slate-800 min-w-0">
                <span className="text-slate-400 block text-[9px] truncate">Mean Reflectance</span>
                <span className="font-bold text-white text-xs block truncate">
                  {activeFeatures.meanReflectance.toFixed(3)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#09212D] border border-slate-800 min-w-0">
                <span className="text-slate-400 block text-[9px] truncate">Variation Score</span>
                <span className="font-bold text-white text-xs block truncate">
                  {activeFeatures.variationScore.toFixed(3)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#09212D] border border-slate-800 min-w-0">
                <span className="text-slate-400 block text-[9px] truncate">Red/Green Ratio</span>
                <span className="font-bold text-white text-xs block truncate">
                  {activeFeatures.relativeSpectralDifferences.redGreenRatio.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5. PERSONAL BASELINE COMPARISON (Requirement 9) */}
      <section className="p-3.5 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sparkles className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              Personal Baseline Comparison
            </h2>
          </div>
          {baselineComparison && (
            <span
              className={`shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full text-[9px] font-mono font-bold self-start sm:self-auto ${
                baselineComparison.baselineEstablished
                  ? 'bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {baselineComparison.variationCategory}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed break-words">
          {baselineComparison?.comparisonNotes ||
            'Establishing personal baseline. Subsequent acquisitions will measure optical shift relative to your own skin reference.'}
        </p>
      </section>

      {/* 6. SPECTRAL VISUALIZATION & REFLECTANCE CURVE (Requirements 6 & 7) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
        <div
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => setShowSpectralSection(!showSpectralSection)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <TrendingUp className="w-4 h-4 text-[#38BDF8] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              Spectral Visualization (Band 1..N)
            </h2>
          </div>
          <div className="shrink-0">
            {showSpectralSection ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </div>

        {showSpectralSection && (
          <div className="space-y-3 animate-in fade-in">
            {/* Spectral Band Selector Tabs */}
            <div className="grid grid-cols-6 gap-1">
              {cube.bands.map((band, idx) => {
                const isSelected = selectedBandIndex === idx;
                return (
                  <button
                    key={band.id}
                    type="button"
                    onClick={() => setSelectedBandIndex(idx)}
                    className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#38BDF8]/25 border-[#38BDF8] text-white shadow-md'
                        : 'bg-[#071A24] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-[10px] font-mono truncate">{band.label}</div>
                    <div className="text-[8px] text-slate-500 font-mono mt-0.5 truncate">
                      {band.nominalWavelengthNm}nm
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Band Plane Detail Card */}
            <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 flex items-center gap-3">
              {activeBand.thumbnailUrl ? (
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0 bg-black">
                  <img
                    src={activeBand.thumbnailUrl}
                    alt={`${activeBand.label} optical slice`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-slate-800 flex items-center justify-center text-slate-600 font-mono text-[9px] shrink-0">
                  Slice N/A
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1 text-[10px] font-mono">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-xs truncate min-w-0 flex-1">{activeBand.label}</span>
                  <span className="text-slate-400 shrink-0 whitespace-nowrap">Nominal: {activeBand.nominalWavelengthNm} nm</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-300">
                  <span className="text-slate-400 truncate min-w-0 flex-1">Regional Mean:</span>
                  <span className="font-bold text-[#38BDF8] shrink-0 whitespace-nowrap">
                    {activeFeatures?.wavelengthReflectances[selectedBandIndex]?.reflectance.toFixed(3) ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-slate-400 text-[9px]">
                  <span className="truncate min-w-0 flex-1">Spectral Channel:</span>
                  <span className="shrink-0 whitespace-nowrap">Visible plane simulation</span>
                </div>
              </div>
            </div>

            {/* Reflectance Curve Visualization (Requirement 7) */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-slate-300 font-mono uppercase block">
                Reflectance vs. Band Profile
              </span>
              {calibration.isReady ? (
                <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-2">
                  <div className="h-24 flex items-end justify-between gap-1.5 px-2 pt-2 pb-1 border-b border-slate-800">
                    {cube.bands.map((b, idx) => {
                      const refVal =
                        activeFeatures?.wavelengthReflectances[idx]?.reflectance || 0.3;
                      const heightPercent = Math.max(10, Math.min(100, Math.round(refVal * 100)));
                      const isCur = selectedBandIndex === idx;

                      return (
                        <div
                          key={b.id}
                          className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer"
                          onClick={() => setSelectedBandIndex(idx)}
                        >
                          <span className="text-[8px] font-mono text-slate-400">
                            {refVal.toFixed(2)}
                          </span>
                          <div
                            className={`w-full rounded-t-md transition-all ${
                              isCur
                                ? 'bg-[#38BDF8] shadow-[0_0_10px_#38BDF8]'
                                : 'bg-[#0F766E]/60 hover:bg-[#0F766E]'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-slate-400 px-1">
                    {cube.bands.map((b) => (
                      <span key={b.id}>{b.label}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 text-center text-[10px] text-slate-400">
                  Reflectance curve unavailable — calibrated multispectral data required.
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 7. ENVIRONMENTAL CONDITIONS & TIME ALIGNMENT (Requirements 10 & 11) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Database className="w-4 h-4 text-[#22C55E] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              Environmental Conditions
            </h2>
          </div>
          {environmental?.locationName && (
            <div className="flex items-center gap-1 text-[10px] text-slate-300 font-mono min-w-0 shrink-0 self-start sm:self-auto">
              <MapPin className="w-3 h-3 text-[#06B6D4] shrink-0" />
              <span className="truncate max-w-[150px]">{environmental.locationName}</span>
            </div>
          )}
        </div>

        {environmental ? (
          <div className="space-y-2.5">
            {/* Real Open-Meteo Pollutants Grid */}
            <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800 min-w-0">
                <span className="text-[9px] text-slate-400 block truncate">PM2.5</span>
                <span className="text-xs font-bold text-white block truncate">
                  {environmental.measurements.pm2_5 !== null
                    ? `${environmental.measurements.pm2_5}`
                    : 'N/A'}
                </span>
                <span className="text-[8px] text-slate-500 block truncate">µg/m³</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800 min-w-0">
                <span className="text-[9px] text-slate-400 block truncate">PM10</span>
                <span className="text-xs font-bold text-white block truncate">
                  {environmental.measurements.pm10 !== null
                    ? `${environmental.measurements.pm10}`
                    : 'N/A'}
                </span>
                <span className="text-[8px] text-slate-500 block truncate">µg/m³</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800 min-w-0">
                <span className="text-[9px] text-slate-400 block truncate">O₃</span>
                <span className="text-xs font-bold text-white block truncate">
                  {environmental.measurements.o3 !== null
                    ? `${environmental.measurements.o3}`
                    : 'N/A'}
                </span>
                <span className="text-[8px] text-slate-500 block truncate">µg/m³</span>
              </div>
              <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800 min-w-0">
                <span className="text-[9px] text-slate-400 block truncate">NO₂</span>
                <span className="text-xs font-bold text-white block truncate">
                  {environmental.measurements.no2 !== null
                    ? `${environmental.measurements.no2}`
                    : 'N/A'}
                </span>
                <span className="text-[8px] text-slate-500 block truncate">µg/m³</span>
              </div>
            </div>

            {/* Time Alignment Card (Requirement 11) */}
            {timeAlignment && (
              <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1 text-[10px] font-mono">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 min-w-0 flex-1 truncate">Optical capture:</span>
                  <span className="text-white shrink-0 whitespace-nowrap">
                    {new Date(timeAlignment.opticalTimestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400 min-w-0 flex-1 truncate">Environmental record:</span>
                  <span className="text-white shrink-0 whitespace-nowrap">
                    {timeAlignment.environmentalTimestamp
                      ? new Date(timeAlignment.environmentalTimestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Unavailable'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-slate-800">
                  <span className="text-slate-400 min-w-0 flex-1 truncate">Time difference:</span>
                  <span
                    className={`shrink-0 whitespace-nowrap font-bold ${
                      timeAlignment.isAligned ? 'text-[#22C55E]' : 'text-[#F59E0B]'
                    }`}
                  >
                    {timeAlignment.differenceMinutes !== null
                      ? `${timeAlignment.differenceMinutes} minutes`
                      : 'N/A'}
                  </span>
                </div>
                {!timeAlignment.isAligned && (
                  <div className="pt-1 text-[9px] text-[#F59E0B] break-words">
                    ⚠ {timeAlignment.alignmentStatus}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 text-center text-[10px] text-slate-400">
            Environmental data unavailable for this measurement.
          </div>
        )}
      </section>

      {/* 8. AI RESEARCH REASONING: 5-STAGE FRAMEWORK (Requirements 12 & 16) */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Sparkles className="w-4 h-4 text-[#5EEAD4] shrink-0" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
              AI Research Analysis & Association
            </h2>
          </div>
          <span className="text-[9px] font-mono text-[#5EEAD4] bg-[#0F766E]/20 px-2 py-0.5 rounded-full border border-[#0F766E]/40 shrink-0 whitespace-nowrap self-start sm:self-auto">
            5-Stage Analytical Structure
          </span>
        </div>

        <div className="space-y-2 text-xs">
          {/* Stage 1: DATA */}
          <div className="p-2.5 rounded-2xl bg-[#071A24] border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-mono font-bold text-[#38BDF8] block uppercase">
              1. Data
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans break-words">{interpretation.data}</p>
          </div>

          {/* Stage 2: OBSERVATION */}
          <div className="p-2.5 rounded-2xl bg-[#071A24] border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-mono font-bold text-[#06B6D4] block uppercase">
              2. Observation
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans break-words">
              {interpretation.observation}
            </p>
          </div>

          {/* Stage 3: COMPARISON */}
          <div className="p-2.5 rounded-2xl bg-[#071A24] border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-mono font-bold text-[#5EEAD4] block uppercase">
              3. Comparison
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans break-words">
              {interpretation.comparison}
            </p>
          </div>

          {/* Stage 4: ENVIRONMENTAL ASSOCIATION */}
          <div className="p-2.5 rounded-2xl bg-[#071A24] border border-slate-800/80 space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
              <span className="text-[10px] font-mono font-bold text-[#F59E0B] uppercase truncate min-w-0 flex-1">
                4. Environmental Association
              </span>
              <span className="text-[9px] font-mono text-slate-400 shrink-0 whitespace-nowrap self-start sm:self-auto">
                {interpretation.hasSufficientLongitudinalData ? 'Available' : 'Insufficient data'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans break-words">
              {interpretation.environmentalAssociation}
            </p>
          </div>

          {/* Stage 5: LIMITATION (Correlation vs Causation) */}
          <div className="p-2.5 rounded-2xl bg-[#071A24] border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
              5. Scientific Limitation
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans break-words">
              {interpretation.limitation}
            </p>
          </div>
        </div>

        {/* Scientific Disclaimer */}
        <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 leading-relaxed break-words">
          <strong className="text-slate-300">Disclaimer: </strong>
          {interpretation.disclaimer}
        </div>
      </section>

      {/* 9. PRIVACY CONTROLS & SAVE ACTIONS (Requirement 19) */}
      <section className="p-4 rounded-3xl bg-[#071A24] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 text-xs font-bold min-w-0 flex-1">
            <Lock className="w-3.5 h-3.5 text-[#5EEAD4] shrink-0" />
            <span className="truncate">Data Privacy & Record Storage</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono shrink-0 whitespace-nowrap">Local storage only</span>
        </div>

        <p className="text-[11px] text-slate-300 leading-snug break-words">
          Facial images are sensitive personal data. They remain on your local device and can be deleted anytime while retaining anonymous optical metrics.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onSaveToHistory && (
            <button
              type="button"
              onClick={onSaveToHistory}
              disabled={isSaved}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                isSaved
                  ? 'bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E]'
                  : 'bg-[#0F766E] hover:bg-[#0F766E]/80 text-white'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Saved to Research Timeline' : 'Save to Research Timeline'}</span>
            </button>
          )}

          {onDeleteImage && imageDataUrl && (
            <button
              type="button"
              onClick={onDeleteImage}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Delete face photo while keeping computed numerical metrics"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              <span>Delete Photo (Keep Metrics)</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
