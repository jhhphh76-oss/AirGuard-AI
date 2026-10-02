import React, { useState, useRef } from 'react';
import { AQIReading, HealthcarePoint } from '../../types/airguard';
import {
  SymptomType,
  SYMPTOM_OPTIONS,
  getHealthGuidance,
} from '../../services/healthGuidanceService';
import {
  photoAnalysisService,
  PhotoAnalysisResult,
} from '../../services/photoAnalysisService';
import { HealthCameraModal } from './HealthCameraModal';
import {
  HeartPulse,
  AlertCircle,
  ShieldCheck,
  Users,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  MapPin,
  Stethoscope,
  Camera,
  Upload,
  RefreshCw,
  Clock,
  Database,
  Check,
  Info,
  Trash2,
  Eye,
  ShieldAlert,
  Compass,
  Sparkles,
} from 'lucide-react';

interface HealthViewProps {
  reading: AQIReading;
  facilities?: HealthcarePoint[];
}

export const HealthView: React.FC<HealthViewProps> = ({ reading, facilities = [] }) => {
  const { aqi, category, categoryColor, dominantPollutant, location } = reading;

  // Selected concern state (Default: 'No symptoms — check air')
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomType>('No symptoms — check air');
  const [customConcernText, setCustomConcernText] = useState<string>('');

  // Camera & Image Analysis State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Called when camera captures photo or user selects image from device
  const handlePhotoCapturedOrSelected = (dataUrl: string, fileBlob?: Blob) => {
    setSelectedImage(dataUrl);
    if (fileBlob) {
      setSelectedBlob(fileBlob);
    }
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalyzing(false);
  };

  // Direct file picker upload handler with validation
  const handleDirectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User cancelled picker dialog
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAnalysisError('Invalid file type. Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setAnalysisError('Image too large. Please select an image under 20MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        handlePhotoCapturedOrSelected(dataUrl, file);
      }
    };
    reader.onerror = (readErr) => {
      console.error('File reading failed:', readErr);
      setAnalysisError('Unable to read selected image. Please try another photo.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Start actual Gemini AI multimodal analysis (called by Analyze Image button)
  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const concern =
        selectedSymptom === 'Other concern' ? customConcernText : selectedSymptom;
      const result = await photoAnalysisService.analyzePhoto(
        selectedImage,
        reading,
        concern
      );
      setAnalysisResult(result);
    } catch (err: any) {
      console.error('Gemini image analysis failed:', err);
      setAnalysisError(
        err?.message || 'We could not analyze this image. Please try another photo.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedBlob(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsAnalyzing(false);
  };

  // Healthcare facilities filter state
  const [facilityFilter, setFacilityFilter] = useState<'all' | 'emergency' | 'respiratory' | 'urgent'>('all');

  // Accordion state for pollutant mechanisms
  const [activeAccordion, setActiveAccordion] = useState<string | null>('pm25');

  // Compute non-diagnostic environmental guidance based on selected concern and actual air data
  const guidance = getHealthGuidance(selectedSymptom, reading, customConcernText);

  // Verified healthcare facilities
  const healthcareFacilities: HealthcarePoint[] = facilities;

  const filteredFacilities = healthcareFacilities.filter((f) => {
    if (facilityFilter === 'emergency') return f.emergencyAvailable;
    if (facilityFilter === 'respiratory') return f.type === 'respiratory_clinic';
    if (facilityFilter === 'urgent') return f.type === 'urgent_care';
    return true;
  });

  const formattedTimestamp = new Date(reading.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const pollutantsInfo = [
    {
      id: 'pm25',
      name: 'PM2.5',
      tag: '≤ 2.5 µm',
      healthImpact:
        'Inhaled deep into the alveolar sacs and enters systemic circulation. Can contribute to airway inflammation and cardiovascular stress.',
      protectiveAction:
        'Operate mechanical HEPA air filtration. Consider wearing a certified N95/FFP2 respirator when outdoor levels are elevated.',
    },
    {
      id: 'pm10',
      name: 'PM10',
      tag: '≤ 10 µm',
      healthImpact:
        'Deposits in upper respiratory airways and nasal passages, capable of irritating the throat and triggering coughing.',
      protectiveAction:
        'Keep windows sealed on windy days. Avoid vigorous outdoor physical exertion near high-dust traffic roads.',
    },
    {
      id: 'no2',
      name: 'NO₂',
      tag: 'Traffic Gas',
      healthImpact:
        'Irritates airway mucosa and can increase bronchial reactivity to allergens, particularly in pediatric asthma.',
      protectiveAction:
        'Ensure proper ventilation when using gas appliances and choose commuter corridors away from diesel traffic.',
    },
    {
      id: 'o3',
      name: 'O₃',
      tag: 'Photochemical',
      healthImpact:
        'Potent oxidant that can cause chest tightness and reduced vital capacity, typically peaking during hot sunny afternoons.',
      protectiveAction:
        'Shift outdoor workouts to early morning hours before solar photochemical ozone formation peaks.',
    },
    {
      id: 'so2',
      name: 'SO₂',
      tag: 'Acidic Gas',
      healthImpact:
        'Can contribute to acute bronchoconstriction within minutes of inhalation in susceptible individuals.',
      protectiveAction:
        'Stay indoors with closed windows during industrial plume dispersion alerts.',
    },
    {
      id: 'co',
      name: 'CO',
      tag: 'Traffic Gas',
      healthImpact:
        'Reduces oxygen delivery capacity of hemoglobin. Never operate combustion generators in enclosed spaces.',
      protectiveAction:
        'Install working carbon monoxide detectors in living and sleeping spaces.',
    },
  ];

  return (
    <div className="p-4 space-y-4 pb-8">
      {/* ------------------------------------------------------------- */}
      {/* A. Current Air Quality Health Context                         */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs uppercase font-mono font-semibold text-slate-400">
            <HeartPulse className="w-4 h-4 text-[#22C55E]" />
            <span>Air Quality Health Context</span>
          </div>
          <span
            className="text-[10px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-full border"
            style={{
              backgroundColor: `${categoryColor}20`,
              borderColor: `${categoryColor}50`,
              color: categoryColor,
            }}
          >
            {category}
          </span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">
              Respiratory Context in {location.name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Primary driving pollutant: <strong className="text-[#06B6D4]">{dominantPollutant}</strong>
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-extrabold font-mono text-white tabular-nums">
              {aqi} <span className="text-[10px] font-normal text-slate-400">AQI</span>
            </div>
          </div>
        </div>

        {/* Real Pollutant Readings Snapshot */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
          <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
            <span className="text-[9px] text-slate-400 block font-sans">PM2.5</span>
            <span className="text-xs font-bold text-white">
              {reading.pollutants.pm2_5 !== null ? `${reading.pollutants.pm2_5}` : 'N/A'}
            </span>
            <span className="text-[8px] text-slate-500 block">µg/m³</span>
          </div>
          <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
            <span className="text-[9px] text-slate-400 block font-sans">PM10</span>
            <span className="text-xs font-bold text-white">
              {reading.pollutants.pm10 !== null ? `${reading.pollutants.pm10}` : 'N/A'}
            </span>
            <span className="text-[8px] text-slate-500 block">µg/m³</span>
          </div>
          <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
            <span className="text-[9px] text-slate-400 block font-sans">Ozone (O₃)</span>
            <span className="text-xs font-bold text-white">
              {reading.pollutants.o3 !== null ? `${reading.pollutants.o3}` : 'N/A'}
            </span>
            <span className="text-[8px] text-slate-500 block">µg/m³</span>
          </div>
        </div>

        {/* Meta Bar */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Live reading: {formattedTimestamp}
          </span>
          <span className="flex items-center gap-1 font-mono text-slate-400">
            <Database className="w-3 h-3 text-slate-500" /> Open-Meteo Verified
          </span>
        </div>

        {/* Non-Diagnostic Disclaimer */}
        <div className="p-2.5 rounded-xl bg-[#0F766E]/15 border border-[#0F766E]/30 flex items-start gap-2 text-[11px] text-slate-300">
          <HelpCircle className="w-4 h-4 text-[#5EEAD4] shrink-0 mt-0.5" />
          <p className="leading-snug">
            AirGuard provides environmental-exposure information and decision support only. It does not provide medical diagnoses or determine disease etiology.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* B. "How Are You Feeling?" Symptom/Exposure Selector           */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">How Are You Feeling?</h2>
            <p className="text-[11px] text-slate-400">
              Select your current comfort or exposure concern:
            </p>
          </div>
          <span className="text-[10px] font-mono text-[#5EEAD4] bg-[#0F766E]/20 px-2 py-0.5 rounded-full border border-[#0F766E]/40">
            1 Selected
          </span>
        </div>

        {/* 12 Accessible Selectable Cards/Chips */}
        <div className="grid grid-cols-2 gap-2">
          {SYMPTOM_OPTIONS.map((opt) => {
            const isSelected = selectedSymptom === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedSymptom(opt.id)}
                className={`p-2.5 rounded-2xl text-left border transition-all flex items-start justify-between gap-1.5 min-h-[46px] select-none ${
                  isSelected
                    ? 'bg-[#0F766E]/30 border-[#06B6D4] text-white shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                    : 'bg-[#071A24] border-[#263238] text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs block leading-tight ${
                      isSelected ? 'font-bold text-[#5EEAD4]' : 'font-medium'
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected
                      ? 'bg-[#06B6D4] border-[#06B6D4] text-[#071A24]'
                      : 'border-slate-600 bg-transparent'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Short Text Description for "Other concern" */}
        {selectedSymptom === 'Other concern' && (
          <div className="pt-2 space-y-1.5 animate-in fade-in">
            <label htmlFor="other-concern-input" className="text-xs font-semibold text-slate-300 block">
              Describe your concern briefly:
            </label>
            <input
              id="other-concern-input"
              type="text"
              value={customConcernText}
              onChange={(e) => setCustomConcernText(e.target.value)}
              placeholder="e.g., mild nasal congestion, burning sensation after commute..."
              maxLength={120}
              className="w-full px-3 py-2 bg-[#071A24] border border-[#263238] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06B6D4]"
            />
            <p className="text-[10px] text-slate-500">
              Used strictly to provide general environmental exposure context. Non-diagnostic.
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* C. Camera Feature & Photo Vision Analysis                     */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Visual Reference & AI Photo Analysis</h2>
              <p className="text-[11px] text-slate-400">
                Capture or upload an image for multimodal environmental analysis
              </p>
            </div>
          </div>
        </div>

        {/* Hidden File Input for device gallery / photo picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleDirectFileUpload}
        />

        {!selectedImage ? (
          /* Initial State: Two prominent, comfortably tappable buttons */
          <div className="p-4 rounded-2xl bg-[#071A24] border border-slate-800 space-y-3">
            <p className="text-xs text-slate-300 leading-relaxed">
              Capture or upload an image (e.g. eye irritation, skin reaction, outdoor haze, or smoke). The existing Gemini vision model will analyze visible features alongside live Open-Meteo telemetry.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="py-4 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#0F766E]/80 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md min-h-[54px] cursor-pointer"
              >
                <Camera className="w-5 h-5 text-white shrink-0" />
                <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-4 px-4 rounded-2xl bg-[#071A24] hover:bg-slate-800 active:scale-[0.98] border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all min-h-[54px] cursor-pointer shadow-md"
              >
                <Upload className="w-5 h-5 text-[#38BDF8] shrink-0" />
                <span>Upload Image</span>
              </button>
            </div>
          </div>
        ) : (
          /* Image Selected State: Large Preview + Analyze Button / Loading / Results */
          <div className="p-4 rounded-2xl bg-[#071A24] border border-slate-800 space-y-3.5 animate-in fade-in">
            {/* Header info & quick actions */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Selected Image</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isAnalyzing
                    ? 'AI analysis in progress...'
                    : analysisResult
                    ? 'Analysis complete'
                    : 'Ready for analysis'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  disabled={isAnalyzing}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  title="Retake photo"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  title="Upload another image"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isAnalyzing}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-[#EF4444] disabled:opacity-50 transition-colors"
                  title="Remove image"
                  aria-label="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Large Image Preview for clear verification on mobile */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-slate-700 bg-black max-h-72 aspect-video flex items-center justify-center shadow-inner">
              <img
                src={selectedImage}
                alt="Selected reference for analysis"
                className="w-full h-full object-contain"
              />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 text-[#5EEAD4] animate-spin" />
                  <span className="text-xs font-bold text-white font-mono">Processing vision frame...</span>
                </div>
              )}
            </div>

            {/* Large "Analyze Image" Button (Shown before analysis or after error) */}
            {!isAnalyzing && !analysisResult && !analysisError && (
              <button
                type="button"
                onClick={handleAnalyzeImage}
                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#0F766E]/20 transition-all border border-[#14B8A6]/40 cursor-pointer min-h-[52px]"
              >
                <Sparkles className="w-5 h-5 text-[#5EEAD4]" />
                <span>Analyze Image</span>
              </button>
            )}

            {/* 1. Loading State: "Analyzing image…" */}
            {isAnalyzing && (
              <div className="p-4 rounded-2xl bg-[#09212D] border border-[#0F766E]/50 flex flex-col items-center justify-center text-center space-y-2 py-6 animate-pulse">
                <div className="p-3 rounded-full bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40 animate-spin">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-base font-bold text-white">Analyzing image…</div>
                <p className="text-xs text-slate-400 max-w-[280px]">
                  Evaluating visual features with Gemini multimodal AI alongside live Open-Meteo telemetry...
                </p>
              </div>
            )}

            {/* 2. Error State: "Image analysis failed" + "Try Again" */}
            {analysisError && !isAnalyzing && (
              <div className="p-4 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-[#EF4444] font-bold text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Image analysis failed</span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  {analysisError}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAnalyzeImage}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white text-xs font-bold transition-colors shadow-md flex items-center justify-center gap-2 min-h-[46px] cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setAnalysisResult(null);
                      setAnalysisError(null);
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors min-h-[46px]"
                  >
                    Select Another
                  </button>
                </div>
              </div>
            )}

            {/* 3. Success State: Real Gemini Multimodal AI Analysis */}
            {analysisResult && !isAnalyzing && (
              <div className="space-y-3 pt-1 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-bold text-[#5EEAD4] flex items-center gap-1.5 font-mono">
                    <Sparkles className="w-4 h-4" />
                    <span>Gemini Vision Analysis</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Correlated with Open-Meteo
                  </span>
                </div>

                {/* Visible in Image (haze, dust, smoke, environmental conditions, or surface features) */}
                <div className="p-3.5 rounded-xl bg-[#09212D] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#38BDF8] uppercase flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visible in Image</span>
                  </span>
                  <p className="text-slate-200 leading-relaxed text-xs">
                    {analysisResult.visibleContent}
                  </p>
                </div>

                {/* Environmental & Air-Quality Observations */}
                <div className="p-3.5 rounded-xl bg-[#09212D] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#5EEAD4] uppercase flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>Air-Quality & Environmental Observations</span>
                  </span>
                  <p className="text-slate-200 leading-relaxed text-xs">
                    {analysisResult.environmentalObservations}
                  </p>
                </div>

                {/* Potential Environmental Factors with Cautious Language */}
                <div className="p-3.5 rounded-xl bg-[#09212D] border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#F59E0B] uppercase flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    <span>Potential Contributing Factors</span>
                  </span>
                  <p className="text-slate-200 leading-relaxed text-xs">
                    {analysisResult.potentialFactors}
                  </p>
                </div>

                {/* Appropriate Precautions */}
                {analysisResult.precautions?.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#09212D] border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-mono font-bold text-[#22C55E] uppercase flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Appropriate Precautions</span>
                    </span>
                    <ul className="space-y-1.5 text-slate-300">
                      {analysisResult.precautions.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                          <span className="leading-snug text-xs">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Strict Health Safety Rule Notice */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-snug">
                    <strong>Notice:</strong> An image alone cannot determine the exact cause. AirGuard AI provides non-diagnostic environmental assessment and does not diagnose disease or replace evaluation by a qualified medical professional.
                  </p>
                </div>

                {/* Action buttons after analysis */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAnalyzeImage}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#0F766E]/40 hover:bg-[#0F766E]/60 border border-[#0F766E] text-[#5EEAD4] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-Analyze</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setAnalysisResult(null);
                      setAnalysisError(null);
                    }}
                    className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                  >
                    Analyze New Image
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* D. Symptom-Specific Guidance & Environmental Contributors     */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{guidance.title}</h2>
              <p className="text-[10px] text-slate-400">Contextual environmental assessment</p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {selectedSymptom}
          </span>
        </div>

        {/* Breathing Discomfort / Severe Warning if applicable */}
        {guidance.urgencyWarning && (
          <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-start gap-2.5 text-xs text-white">
            <ShieldAlert className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
            <p className="leading-snug font-medium text-slate-200">
              {guidance.urgencyWarning}
            </p>
          </div>
        )}

        {/* Environmental Explanation */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Environmental Context
          </h3>
          <p className="text-xs text-slate-200 leading-relaxed">
            {guidance.environmentalExplanation}
          </p>
        </div>

        {/* Possible Environmental Contributors based on real readings */}
        <div className="space-y-1.5 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Possible Environmental Contributors
          </h3>
          <ul className="space-y-1 text-xs text-slate-300">
            {guidance.possibleContributors.map((c, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] shrink-0 mt-1.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actual Observed Pollutants Checklist */}
        <div className="space-y-1.5 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Current Telemetry Baseline
          </h3>
          <div className="space-y-1 text-xs">
            {guidance.observedPollutantsStatus.map((obs, idx) => (
              <div
                key={idx}
                className="p-2 rounded-xl bg-[#071A24] border border-slate-800 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-white block text-[11px] truncate">
                    {obs.pollutant}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">{obs.note}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] font-bold text-slate-200">
                    {obs.value}
                  </span>
                  {obs.isElevated ? (
                    <span className="block text-[9px] font-mono text-[#F59E0B]">Elevated</span>
                  ) : (
                    <span className="block text-[9px] font-mono text-[#22C55E]">Baseline</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Exposure Actions */}
        <div className="space-y-1.5 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Recommended Practical Actions</span>
          </h3>
          <div className="space-y-1.5 text-xs text-slate-300">
            {guidance.actionableSteps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-xl bg-[#071A24] border border-slate-800">
                <CheckCircle className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                <span className="leading-snug">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* E. Practical Air-Exposure Guidance ("What You Can Do")       */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-2.5 shadow-lg">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
          <h2 className="text-sm font-bold text-white">What You Can Do (AQI {aqi} · {category})</h2>
        </div>

        <div className="space-y-2 text-xs text-slate-300">
          <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
            <span className="font-bold text-white text-[11px]">Outdoor Physical Activity:</span>
            <p className="text-[11px] text-slate-400 leading-snug">
              {aqi <= 50
                ? 'Air quality is satisfactory. Outdoor workouts, running, and cycling carry minimal particulate exposure concern.'
                : aqi <= 100
                ? 'Acceptable for most individuals. If you are unusually sensitive to ozone or particulate matter, consider taking more rest breaks.'
                : aqi <= 150
                ? 'Sensitive groups should reduce prolonged outdoor exertion. Choose cleaner times of day (early mornings) for walks.'
                : 'Everyone should limit strenuous outdoor activities. Shift cardiovascular exercise to filtered indoor environments.'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
            <span className="font-bold text-white text-[11px]">Indoor Air Quality & Ventilation:</span>
            <p className="text-[11px] text-slate-400 leading-snug">
              {aqi <= 50
                ? 'Good time for natural window ventilation to refresh indoor air.'
                : 'Keep windows closed along busy traffic corridors during peak rush hours. Use certified mechanical HEPA purifiers.'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1">
            <span className="font-bold text-white text-[11px]">Personal Exposure Reduction:</span>
            <p className="text-[11px] text-slate-400 leading-snug">
              Avoid commuting along congested diesel routes on foot or bicycle. Consider certified N95/FFP2 particulate respirators when ambient levels are high.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* F. People Who May Be More Sensitive                            */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-2">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>People Who May Be More Sensitive</span>
          </h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            General guidance — AirGuard does not assume individual medical status
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <span className="text-[10px] font-bold text-[#5EEAD4] font-mono">Children</span>
            <div className="text-xs font-semibold text-white">Higher Ventilation Rate</div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Children breathe more air per pound of body weight and spend more time active outdoors.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <span className="text-[10px] font-bold text-[#5EEAD4] font-mono">Older Adults</span>
            <div className="text-xs font-semibold text-white">Cardiovascular Load</div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Fine particulate matter can elevate vascular resistance and cardiac workload.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <span className="text-[10px] font-bold text-[#5EEAD4] font-mono">Asthma & COPD</span>
            <div className="text-xs font-semibold text-white">Airway Hyperreactivity</div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Particulates and ozone can trigger bronchospasm; keep prescribed rescue medication accessible.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#09212D] border border-[#263238] space-y-1">
            <span className="text-[10px] font-bold text-[#5EEAD4] font-mono">Outdoor Workers</span>
            <div className="text-xs font-semibold text-white">Cumulative Exposure</div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Prolonged outdoor shifts accumulate higher total inhaled particulate doses.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* G. Healthcare Facilities Nearby                                */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-[#38BDF8]" />
            <h2 className="text-sm font-bold text-white">Healthcare Facilities Nearby</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
            {location.name}
          </span>
        </div>

        {/* Emergency Triage Notice */}
        <div className="p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/25 flex items-start gap-2 text-[11px] text-slate-300">
          <AlertCircle className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />
          <p className="leading-snug">
            <strong className="text-white">Emergency Warning:</strong> In case of acute shortness of breath, chest heaviness, or cyanosis (blue lips), contact local emergency services immediately.
          </p>
        </div>

        {/* Real-Data Verification Rule: Honest empty state when no verified data is available */}
        {healthcareFacilities.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#071A24] border border-slate-800 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#09212D] text-slate-400 mx-auto flex items-center justify-center border border-slate-800">
              <Building2 className="w-5 h-5 text-[#38BDF8]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-white">
                Healthcare facilities will appear here when verified location data is available.
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                AirGuard connects only with verified healthcare registries for {location.name}. Unverified or simulated clinic listings are not displayed.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Pills: smooth horizontal scrolling on narrow screens with right padding */}
            <div className="w-full overflow-x-auto no-scrollbar scroll-smooth pb-1 pt-0.5 touch-pan-x">
              <div className="flex items-center gap-2 min-w-max pr-8">
                <button
                  type="button"
                  onClick={() => setFacilityFilter('all')}
                  className={`shrink-0 flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    facilityFilter === 'all'
                      ? 'bg-[#0F766E]/40 text-[#5EEAD4] border border-[#0F766E]'
                      : 'bg-[#071A24] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFacilityFilter('emergency')}
                  className={`shrink-0 flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    facilityFilter === 'emergency'
                      ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                      : 'bg-[#071A24] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  24/7 ER
                </button>
                <button
                  type="button"
                  onClick={() => setFacilityFilter('respiratory')}
                  className={`shrink-0 flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    facilityFilter === 'respiratory'
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40'
                      : 'bg-[#071A24] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  Pulmonary
                </button>
                <button
                  type="button"
                  onClick={() => setFacilityFilter('urgent')}
                  className={`shrink-0 flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    facilityFilter === 'urgent'
                      ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                      : 'bg-[#071A24] text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  Urgent Care
                </button>
              </div>
            </div>

            {/* Filter empty message */}
            {filteredFacilities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4 bg-[#071A24] rounded-2xl border border-slate-800">
                No verified facilities found for this category nearby.
              </p>
            ) : (
              /* Verified Facility Mobile Cards */
              <div className="space-y-2.5 pt-1">
                {filteredFacilities.map((med) => (
                  <div
                    key={med.id}
                    className="p-3.5 rounded-2xl bg-[#071A24] border border-slate-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white leading-snug break-words">
                          {med.name}
                        </h3>
                        {med.address && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="truncate">{med.address}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {med.emergencyAvailable ? (
                          <span className="block text-[9px] font-mono px-2 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 font-semibold">
                            24/7 ER
                          </span>
                        ) : (
                          <span className="block text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            Clinic
                          </span>
                        )}
                      </div>
                    </div>

                    {med.specialty && (
                      <div className="flex items-start gap-1 text-[11px] text-slate-300">
                        <Stethoscope className="w-3.5 h-3.5 text-[#5EEAD4] shrink-0 mt-0.5" />
                        <span className="text-[10px] text-slate-300 leading-snug">{med.specialty}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* H. Monitored Pollutant Impact Accordions                       */}
      {/* ------------------------------------------------------------- */}
      <section className="space-y-1.5">
        <div className="px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
            Pollutant Mechanism Reference
          </h2>
        </div>

        <div className="space-y-1.5">
          {pollutantsInfo.map((p) => {
            const isOpen = activeAccordion === p.id;
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-slate-800 bg-[#09212D] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setActiveAccordion(isOpen ? null : p.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors gap-2"
                >
                  {/* Left side: Pollutant name and primary information */}
                  <div className="flex items-center min-w-0 pr-2">
                    <span className="text-xs font-bold text-white font-mono tracking-tight">{p.name}</span>
                  </div>

                  {/* Right side: Secondary descriptive tag and dropdown chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 border border-slate-700/60">
                      [{p.tag}]
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#06B6D4] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-800 text-[11px] space-y-1.5 bg-[#071A24]">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block font-semibold">
                        Impact:
                      </span>
                      <p className="text-slate-300 leading-snug">{p.healthImpact}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#5EEAD4] block font-semibold">
                        Guidance:
                      </span>
                      <p className="text-slate-300 leading-snug">{p.protectiveAction}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Camera Modal Dialog */}
      <HealthCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onPhotoSelected={handlePhotoCapturedOrSelected}
      />
    </div>
  );
};
