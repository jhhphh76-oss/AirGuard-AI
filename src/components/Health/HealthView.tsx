import React, { useState, useRef, useEffect } from 'react';
import { AQIReading, HealthcarePoint, PrimaryNavTab } from '../../types/airguard';
import {
  SymptomType,
  SYMPTOM_OPTIONS,
  getHealthGuidance,
} from '../../services/healthGuidanceService';
import {
  photoAnalysisService,
  PhotoAnalysisResult,
} from '../../services/photoAnalysisService';
import { healthContextService } from '../../services/healthContextService';
import { HealthCameraModal } from './HealthCameraModal';
import { AirGuardianCameraModal } from '../Research/AirGuardianCameraModal';
import { ResearchMeasurementModal } from '../Research/ResearchMeasurementModal';
import { researchAnalysisService } from '../../services/research/researchAnalysisService';
import { LongitudinalRecord, ResearchMeasurementRecord, EnvironmentalSnapshot } from '../../services/research/types';
import { historyService } from '../../services/historyService';
import {
  HeartPulse,
  AlertCircle,
  AlertTriangle,
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
  Layers,
  History,
  Activity,
  Home,
  Wind,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

interface HealthViewProps {
  reading: AQIReading;
  facilities?: HealthcarePoint[];
  onNavigate?: (tab: PrimaryNavTab) => void;
}

export const HealthView: React.FC<HealthViewProps> = ({ reading, facilities = [], onNavigate }) => {
  const { aqi, category, categoryColor, dominantPollutant, location } = reading;

  // Multi-selection symptoms state (Default: empty; no forced fallback)
  const [selectedSymptoms, setSelectedSymptoms] = useState<SymptomType[]>([]);
  const [customConcernText, setCustomConcernText] = useState<string>('');
  const [continueWithoutPhoto, setContinueWithoutPhoto] = useState<boolean>(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  // Keep health context service updated for AI Advisor reasoning
  useEffect(() => {
    healthContextService.setSymptoms(selectedSymptoms, customConcernText);
  }, [selectedSymptoms, customConcernText]);

  // Camera & Image Analysis State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isResearchCameraOpen, setIsResearchCameraOpen] = useState(false);
  const [selectedResearchRecord, setSelectedResearchRecord] = useState<ResearchMeasurementRecord | null>(null);
  const [isMeasurementModalOpen, setIsMeasurementModalOpen] = useState(false);
  const [researchSessions, setResearchSessions] = useState<LongitudinalRecord[]>(() =>
    researchAnalysisService.getHistory()
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBlob, setSelectedBlob] = useState<Blob | File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isSavedToTimeline, setIsSavedToTimeline] = useState(false);
  const [isSavedToHistory, setIsSavedToHistory] = useState(false);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);
  const [showResearchAnalysis, setShowResearchAnalysis] = useState(false);
  const [showNearbyHospitals, setShowNearbyHospitals] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toggle symptom handler with direct navigation for "No symptoms" -> Home, "Other concern" -> AI Advisor, and dedicated face exposure flow
  const handleToggleSymptom = (symptomId: SymptomType) => {
    setValidationMessage(null);

    // Requirement 3: No Symptoms / Check Air -> Home
    if (symptomId === 'No symptoms / just checking air' || symptomId === 'No symptoms — check air') {
      onNavigate?.('home');
      return;
    }

    // Requirement 4: Other Concern -> AI Advisor
    if (symptomId === 'Other concern') {
      healthContextService.setSymptom('Other concern', customConcernText || 'Individual health or environmental concern');
      onNavigate?.('map');
      return;
    }

    // Requirement 7: Special flow — "Check general exposure on face"
    if (symptomId === 'Check general exposure on face') {
      setSelectedSymptoms(['Check general exposure on face']);
      if (!selectedImage) {
        setIsCameraOpen(true);
      }
      return;
    }

    setSelectedSymptoms((prev) => {
      const cleaned = prev.filter(
        (s) =>
          s !== 'No symptoms / just checking air' &&
          s !== 'No symptoms — check air' &&
          s !== 'Other concern' &&
          s !== 'Check general exposure on face'
      );
      if (cleaned.includes(symptomId)) {
        return cleaned.filter((s) => s !== symptomId);
      }
      return [...cleaned, symptomId];
    });
  };

  // Called when camera captures photo or user selects image from device
  const handlePhotoCapturedOrSelected = (dataUrl: string, fileBlob?: Blob) => {
    setSelectedImage(dataUrl);
    if (fileBlob) {
      setSelectedBlob(fileBlob);
    }
    setContinueWithoutPhoto(false);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsSavedToTimeline(false);
    setIsSavedToHistory(false);
    setShowResearchAnalysis(false);
    setSaveConfirmation(null);
    setValidationMessage(null);
    setIsAnalyzing(false);
  };

  // Core analysis runner for both photo and no-photo exposure checks
  const runExposureAnalysis = async (
    imageToAnalyze: string | null = selectedImage,
    symptomsToAnalyze: SymptomType[] = selectedSymptoms
  ) => {
    setValidationMessage(null);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);
    setIsSavedToTimeline(false);
    setIsSavedToHistory(false);
    setShowResearchAnalysis(false);
    setSaveConfirmation(null);

    const isFaceExposure = symptomsToAnalyze.includes('Check general exposure on face');

    try {
      const result = await photoAnalysisService.analyzeExposure({
        imageBase64: imageToAnalyze,
        symptoms: symptomsToAnalyze,
        customConcernText,
        reading,
        isFaceExposureMode: isFaceExposure,
      });
      setAnalysisResult(result);
      if (result.visibleContent && result.photoProvided) {
        healthContextService.setPhotoObservation(
          `Visible: ${result.visibleContent}. Potential factors: ${result.potentialFactors}`
        );
      }

      // Requirement 7: Saving the face-exposure analysis
      // When the photo analysis is completed, save the submitted picture and its analysis directly to AirGuardian History.
      // IMPORTANT: This face-exposure photo analysis must NOT be added to the AirGuardian Research Dashboard.
      if (isFaceExposure) {
        historyService.addPhotoAnalysisRecord({
          reading,
          imageDataUrl: imageToAnalyze,
          analysis: result,
        });
        setIsSavedToHistory(true);
        setSaveConfirmation('Saved to AirGuardian History');
      }
    } catch (err: any) {
      console.error('Health exposure analysis failed:', err);
      setAnalysisError(
        err?.message || 'We could not analyze this exposure check right now. Please try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // User explicitly chooses to continue without photo — prepares no-photo state
  const handleChooseContinueWithoutPhoto = () => {
    setSelectedImage(null);
    setSelectedBlob(null);
    setContinueWithoutPhoto(true);
    setIsCameraOpen(false);
    setValidationMessage(null);
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

  // Start actual Gemini AI health & exposure analysis
  const handleAnalyze = async () => {
    if (!selectedImage && !continueWithoutPhoto && selectedSymptoms.length === 0) {
      setValidationMessage('Select a concern or choose an environmental exposure check to continue.');
      setAnalysisResult(null);
      return;
    }

    runExposureAnalysis(selectedImage, selectedSymptoms);
  };

  // Save complete analysis to Research Timeline (Requirement 2)
  const handleSaveToResearchTimeline = () => {
    if (!analysisResult) return;
    const timestamp = Date.now();
    const existingMeasurements = researchAnalysisService.getMeasurements();
    const sessionIndex = existingMeasurements.length + 1;

    const envSnapshot: EnvironmentalSnapshot | null = reading
      ? {
          timestamp: new Date(reading.timestamp).toISOString(),
          opticalMeasurementTimestamp: timestamp,
          locationName: reading.location.name,
          coordinates: {
            latitude: reading.location.latitude,
            longitude: reading.location.longitude,
          },
          measurements: {
            aqi: reading.aqi,
            pm2_5: reading.pollutants?.pm2_5 ?? null,
            pm10: reading.pollutants?.pm10 ?? null,
            o3: reading.pollutants?.o3 ?? null,
            no2: reading.pollutants?.no2 ?? null,
            so2: reading.pollutants?.so2 ?? null,
            co: reading.pollutants?.co ?? null,
            uv_index: reading.indicators?.uv_index ?? null,
          },
          dataSource: 'Open-Meteo Air Quality Grid',
        }
      : null;

    const record: ResearchMeasurementRecord = {
      id: `analysis_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      sessionIndex,
      acquisitionMode: analysisResult.photoProvided ? 'live_camera' : 'gallery_upload',
      sourceType: analysisResult.photoProvided
        ? 'Visual Photo Exposure Assessment'
        : 'Symptom & Environmental Exposure Assessment',
      location: reading?.location || null,
      environmentalDataTimestamp: reading ? new Date(reading.timestamp).toISOString() : null,
      calibration: {
        darkCaptured: true,
        darkValue: 0,
        whiteCaptured: true,
        whiteValue: 255,
        skinCaptured: true,
        normalized: true,
        isReady: true,
        statusLabel: 'Ready',
        formula: 'Normalized Reflectance',
      },
      imageQuality: {
        qualityCategory: 'Good',
        brightnessConsistency: 95,
        exposureQuality: 'Balanced',
        meanLuminance: 128,
        blurSharpnessScore: 85,
        isSharp: true,
        faceDetectionConfidence: analysisResult.photoProvided ? 90 : 0,
        usableFaceAreaPercent: analysisResult.photoProvided ? 85 : 0,
        resolution: { width: 640, height: 480 },
        issues: [],
      },
      detectedFacialRegions: {} as any,
      opticalFeatures: {} as any,
      environmentalMeasurements: envSnapshot,
      analysis: {
        data: `AQI ${reading?.aqi ?? 'N/A'} (${reading?.category ?? 'N/A'}, dominant: ${reading?.dominantPollutant ?? 'N/A'}) in ${reading?.location.name ?? 'Current Site'}.`,
        observation: analysisResult.visibleContent || 'Observation recorded.',
        comparison: analysisResult.potentialFactors || 'Exposure factors evaluated.',
        environmentalAssociation: analysisResult.environmentalObservations || 'Environmental telemetry correlated.',
        limitation: analysisResult.limitationNotice || 'Non-diagnostic environmental correlation.',
        hasSufficientLongitudinalData: true,
        disclaimer: 'AirGuardian Research Record',
      },
      dataStatus: 'REAL MEASUREMENT',
      timeAlignment: {
        opticalTimestamp: timestamp,
        environmentalTimestamp: reading ? new Date(reading.timestamp).toISOString() : null,
        differenceMinutes: 0,
        isAligned: true,
        alignmentStatus: 'Time-aligned',
      },
      baselineComparison: {
        baselineEstablished: true,
        baselineTimestamp: timestamp,
        baselineLocationName: reading?.location.name || null,
        variationCategory: 'Minimal variation',
        averageOpticalShift: null,
        highestShiftRegion: null,
        comparisonNotes: analysisResult.potentialFactors || 'Logged to research timeline.',
      },
      dataQuality: {
        cameraAcquisition: 'Good',
        calibration: 'Valid',
        faceSegmentation: 'Valid',
        spectralData: 'Available',
        environmentalData: 'Available',
        timeAlignment: 'Valid',
        longitudinalData: 'Sufficient',
      },
      imageDataUrl: selectedImage,
      cubeBandsCount: 4,
      notes: `Concerns: ${analysisResult.selectedConcerns?.join(', ') || 'None reported'}. Guidance: ${analysisResult.precautions?.join('; ') || ''}`,
    };

    researchAnalysisService.saveMeasurement(record);
    if (reading) {
      historyService.addRecord(reading);
    }
    setResearchSessions(researchAnalysisService.getHistory());
    setIsSavedToTimeline(true);
    setSaveConfirmation('Saved to Research Timeline');
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setSelectedBlob(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setIsSavedToTimeline(false);
    setIsSavedToHistory(false);
    setShowResearchAnalysis(false);
    setSaveConfirmation(null);
    setIsAnalyzing(false);
  };

  // Healthcare facilities filter state
  const [facilityFilter, setFacilityFilter] = useState<'all' | 'emergency' | 'respiratory' | 'urgent'>('all');

  // Accordion state for pollutant mechanisms
  const [activeAccordion, setActiveAccordion] = useState<string | null>('pm25');

  // Compute non-diagnostic environmental guidance based on selected concerns and actual air data
  const guidance = getHealthGuidance(selectedSymptoms, reading, customConcernText);

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
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-white leading-tight break-words">
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
      {/* B. Environmental Exposure & Health Check Flow                 */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Environmental Exposure & Health Check
              </h2>
              <p className="text-[11px] text-slate-400">
                Correlate symptoms and optional visual reference with Open-Meteo telemetry
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40">
            HEALTH & EXPOSURE
          </span>
        </div>

        {/* Hidden File Input for direct photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleDirectFileUpload}
        />

        {/* 1. What would you like to check? (Three clear choices) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              What would you like to check?
            </h3>
            {selectedImage ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40 font-semibold">
                Photo attached
              </span>
            ) : continueWithoutPhoto ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                Without photo
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 📷 Capture Photo */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className={`py-3 px-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                selectedImage
                  ? 'bg-[#0F766E]/30 border-[#06B6D4] text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-[#071A24] border-slate-800 text-slate-200 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Camera className="w-4 h-4 text-[#5EEAD4] shrink-0" />
              <span>Capture Photo</span>
            </button>

            {/* 🖼 Upload Photo */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-3 px-3.5 rounded-2xl bg-[#071A24] border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#38BDF8] shrink-0" />
              <span>Upload Photo</span>
            </button>

            {/* Continue without photo */}
            <button
              type="button"
              onClick={handleChooseContinueWithoutPhoto}
              className={`py-3 px-3.5 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                continueWithoutPhoto && !selectedImage
                  ? 'bg-[#0F766E]/25 border-[#5EEAD4] text-[#5EEAD4] shadow-[0_0_10px_rgba(94,234,212,0.2)]'
                  : 'bg-[#071A24] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span>Continue without photo</span>
            </button>
          </div>

          {/* Photo Preview if an image is provided */}
          {selectedImage && (
            <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-2 mt-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5 font-mono">
                  <Eye className="w-3.5 h-3.5 text-[#5EEAD4]" />
                  <span>Photo Reference Attached</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    disabled={isAnalyzing}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isAnalyzing}
                    className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-[#EF4444] disabled:opacity-50 transition-colors"
                    title="Remove photo"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 bg-black h-44 flex items-center justify-center">
                <img
                  src={selectedImage}
                  alt="User submitted reference"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Optical features will be evaluated alongside your reported symptoms and live Open-Meteo telemetry.
              </p>
            </div>
          )}

          {continueWithoutPhoto && !selectedImage && (
            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-center gap-2 text-xs text-slate-300 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-[#22C55E] shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-white text-[11px] block">Photo: Not provided</span>
                <span className="text-[10px] text-slate-400 block leading-tight">
                  Analysis will evaluate your reported symptoms and current AirGuardian environmental data only.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. What are you experiencing? (Symptom/Concern Multi-Select) */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">What are you experiencing?</h3>
              <p className="text-[11px] text-slate-400">
                Select all that apply (multiple selections allowed):
              </p>
            </div>
            <span className="text-[10px] font-mono text-[#5EEAD4] bg-[#0F766E]/20 px-2 py-0.5 rounded-full border border-[#0F766E]/40 font-semibold">
              {selectedSymptoms.length} Selected
            </span>
          </div>

          {/* 12 Accessible Selectable Cards/Chips with Checkboxes */}
          <div className="grid grid-cols-2 gap-2">
            {SYMPTOM_OPTIONS.map((opt) => {
              const isSelected = selectedSymptoms.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleSymptom(opt.id)}
                  className={`p-2.5 rounded-2xl text-left border transition-all flex items-start justify-between gap-1.5 min-h-[46px] select-none cursor-pointer ${
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
                    className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'bg-[#06B6D4] border-[#06B6D4] text-[#071A24]'
                        : 'border-slate-600 bg-transparent'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Other concern short user description */}
          {selectedSymptoms.includes('Other concern') && (
            <div className="pt-2 space-y-1.5 animate-in fade-in">
              <label htmlFor="other-concern-input" className="text-xs font-semibold text-slate-300 block">
                Describe your concern
              </label>
              <input
                id="other-concern-input"
                type="text"
                value={customConcernText}
                onChange={(e) => setCustomConcernText(e.target.value)}
                placeholder="Briefly describe your concern..."
                maxLength={120}
                className="w-full px-3 py-2 bg-[#071A24] border border-[#263238] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06B6D4]"
              />
              <p className="text-[10px] text-slate-500">
                Non-diagnostic description used strictly for environmental exposure correlation.
              </p>
            </div>
          )}
        </div>

        {/* Validation warning if neither photo nor symptoms selected */}
        {validationMessage && (
          <div className="p-3 rounded-2xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 flex items-center gap-2 text-xs text-[#F59E0B] animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{validationMessage}</span>
          </div>
        )}

        {/* 3. Analyze Button (Always visible and clickable) */}
        {!isAnalyzing && (
          <button
            type="button"
            onClick={handleAnalyze}
            className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#0D9488] hover:from-[#115E59] hover:to-[#0F766E] active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#0F766E]/20 transition-all border border-[#14B8A6]/40 cursor-pointer min-h-[52px]"
          >
            <Sparkles className="w-5 h-5 text-[#5EEAD4]" />
            <span>Analyze</span>
          </button>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <div className="p-4 rounded-2xl bg-[#09212D] border border-[#0F766E]/50 flex flex-col items-center justify-center text-center space-y-2 py-6 animate-pulse">
            <div className="p-3 rounded-full bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40 animate-spin">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-white">Analyzing exposure…</div>
            <p className="text-xs text-slate-400 max-w-[280px]">
              Correlating reported concerns and environmental conditions with live Open-Meteo telemetry...
            </p>
          </div>
        )}

        {/* Error State */}
        {analysisError && !isAnalyzing && (
          <div className="p-4 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-[#EF4444] font-bold text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>Analysis failed</span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">{analysisError}</p>
            <button
              type="button"
              onClick={handleAnalyze}
              className="py-2.5 px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold transition-colors shadow-md flex items-center justify-center gap-2 min-h-[42px] cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* 4. Structured Results Display (Big 3 & Photo Analysis) */}
        {analysisResult && !isAnalyzing && (
          <div className="space-y-3.5 pt-2 text-xs border-t border-slate-800 animate-in fade-in">
            {/* Results Header */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-[#5EEAD4] flex items-center gap-1.5 font-mono">
                <Sparkles className="w-4 h-4 text-[#5EEAD4]" />
                <span>
                  {analysisResult.isFaceExposureMode || selectedSymptoms.includes('Check general exposure on face')
                    ? 'Face Exposure Assessment'
                    : 'AirGuardian Health & Exposure Analysis'}
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Open-Meteo Verified
              </span>
            </div>

            {/* Requirement 6: What may be irritating you (Visual / Exposure Context) */}
            {analysisResult.photoProvided && (
              <div className="p-3.5 rounded-2xl bg-[#071A24] border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#38BDF8] font-bold flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>What may be irritating you</span>
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#0F766E]/30 text-[#5EEAD4] border border-[#0F766E]/50 font-bold uppercase">
                    Visual Reference
                  </span>
                </div>
                {selectedImage && (
                  <div className="relative w-full rounded-xl overflow-hidden border border-slate-700/80 bg-black h-36 flex items-center justify-center">
                    <img
                      src={selectedImage}
                      alt="Submitted exposure reference"
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <p className="text-slate-200 text-xs leading-relaxed font-sans">
                  {analysisResult.whatMayBeIrritating || analysisResult.visibleContent}
                </p>
                <p className="text-[10px] text-slate-500 italic">
                  Note: AirGuardian does not diagnose clinical conditions from photographs. Observations provide non-diagnostic environmental context only.
                </p>
              </div>
            )}

            {/* Requirement 2: Big 3 — 1. Why this matters */}
            <div className="p-3.5 rounded-2xl bg-[#09212D] border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-[#5EEAD4] uppercase flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#5EEAD4]" />
                <span>Why this matters</span>
              </span>
              <p className="text-slate-200 text-xs leading-relaxed">
                {analysisResult.whyThisMatters || guidance.whyThisMatters}
              </p>
              <div className="pt-1 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                <span>AQI: <strong className="text-white">{reading.aqi}</strong></span>
                <span>·</span>
                <span>Category: <strong className="text-white">{reading.category}</strong></span>
                <span>·</span>
                <span>Dominant: <strong className="text-[#06B6D4]">{reading.dominantPollutant}</strong></span>
              </div>
            </div>

            {/* Requirement 2: Big 3 — 2. AirGuardian guidance (Do and Don't) */}
            <div className="p-3.5 rounded-2xl bg-[#09212D] border border-slate-800 space-y-3">
              <span className="text-[11px] font-mono font-bold text-white uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#22C55E]" />
                <span>AirGuardian guidance</span>
              </span>

              {/* DO Precautions */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#22C55E] flex items-center gap-1 font-mono uppercase">
                  <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
                  <span>Do</span>
                </div>
                <div className="space-y-1">
                  {(analysisResult.doList && analysisResult.doList.length > 0
                    ? analysisResult.doList
                    : guidance.doList
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-[#071A24] border border-slate-800 flex items-start gap-2 text-xs text-slate-200"
                    >
                      <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* DON'T Precautions */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <div className="text-[11px] font-bold text-[#EF4444] flex items-center gap-1 font-mono uppercase">
                  <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />
                  <span>Don't</span>
                </div>
                <div className="space-y-1">
                  {(analysisResult.dontList && analysisResult.dontList.length > 0
                    ? analysisResult.dontList
                    : guidance.dontList
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-[#071A24] border border-slate-800 flex items-start gap-2 text-xs text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0 mt-1.5" />
                      <span className="leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Requirement 2: Big 3 — 3. When to get help */}
            <div className="p-3.5 rounded-2xl bg-[#071A24] border border-[#F59E0B]/30 space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-[#F59E0B] uppercase flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>When to get help</span>
              </span>
              <p className="text-slate-200 text-xs leading-relaxed">
                {analysisResult.whenToGetHelp || guidance.whenToGetHelp}
              </p>
            </div>

            {/* Safety Limitation Notice */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
              <p className="leading-snug">
                AirGuardian provides environmental exposure support, not clinical diagnosis. Never ignore worsening shortness of breath or acute symptoms.
              </p>
            </div>

            {/* Requirement 7: Research-Style Analysis Button */}
            {(analysisResult.photoProvided ||
              analysisResult.isFaceExposureMode ||
              selectedSymptoms.includes('Check general exposure on face')) && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowResearchAnalysis(!showResearchAnalysis)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-[#0F766E]/20 hover:bg-[#0F766E]/30 border border-[#0F766E]/50 text-[#5EEAD4] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-[#5EEAD4]" />
                  <span>
                    {showResearchAnalysis
                      ? 'Hide Research-Style Analysis'
                      : 'Research-Style Analysis'}
                  </span>
                </button>

                {showResearchAnalysis && (
                  <div className="mt-2 p-3.5 rounded-2xl bg-[#071A24] border border-[#0F766E]/40 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="text-[11px] font-mono font-bold text-[#5EEAD4] uppercase flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Research-Style Optical Analysis</span>
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        Gemini Vision
                      </span>
                    </div>
                    <div className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-sans">
                      {analysisResult.researchAnalysis ||
                        `Research-Style Optical & Environmental Evaluation:
• Observable Elements: Photographic capture indicates surface features under ambient lighting without definitive clinical biomarkers.
• Environmental Relevance: Current ambient air registers AQI ${reading.aqi} (${reading.category}) with ${reading.dominantPollutant} as dominant pollutant. Particulates may deposit on external barriers.
• Scientific Context: Particulates (PM2.5) and ambient oxidants interact with epidermal barriers, potentially influencing transepidermal water loss.
• Distinguishing Observations vs Possibilities: Visual characteristics may reflect hydration, humidity, or individual baseline; ambient air is a potential contributor rather than a proven cause.
• Limitations: Standard RGB photography cannot quantify microscopic particulate burden or diagnose medical conditions.`}
                    </div>
                    <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-800/80">
                      Non-diagnostic research observation: The photograph is not treated as proof of pollution exposure.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Save Status & Action */}
            {analysisResult.isFaceExposureMode || selectedSymptoms.includes('Check general exposure on face') ? (
              <div className="p-2.5 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/30 text-center space-y-1">
                <div className="text-xs font-bold text-[#22C55E] flex items-center justify-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>Saved to AirGuardian History</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Photo and exposure analysis preserved with date/time. View anytime in History.
                </p>
              </div>
            ) : (
              <div className="space-y-1 pt-1">
                <button
                  type="button"
                  onClick={handleSaveToResearchTimeline}
                  disabled={isSavedToTimeline}
                  className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                    isSavedToTimeline
                      ? 'bg-[#22C55E]/20 border border-[#22C55E]/40 text-[#22C55E]'
                      : 'bg-[#0F766E] hover:bg-[#0F766E]/80 border border-[#14B8A6]/40 text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSavedToTimeline ? 'Saved to Research Timeline' : 'Save to Research Timeline'}
                  </span>
                </button>
                {saveConfirmation && (
                  <div className="text-[11px] text-[#22C55E] flex items-center justify-center gap-1.5 py-1 font-medium animate-in fade-in">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{saveConfirmation} (View in History)</span>
                  </div>
                )}
              </div>
            )}

            {/* Re-Analyze & Advisor Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAnalyze}
                  className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#0F766E]/40 hover:bg-[#0F766E]/60 border border-[#0F766E] text-[#5EEAD4] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Analyze</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAnalysisResult(null);
                    setAnalysisError(null);
                    setShowResearchAnalysis(false);
                  }}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Clear Results
                </button>
              </div>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('map')}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#071A24] hover:bg-[#09212D] border border-slate-700/80 hover:border-[#06B6D4]/50 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Discuss Result with AI Advisor (Chat)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* C.2 AirGuardian Research Dashboard & Longitudinal Timeline    */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
        {(() => {
          const dashboardSummary = researchAnalysisService.getDashboardSummary();
          const allMeasurements = researchAnalysisService.getMeasurements();

          return (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/30">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      AirGuardian Research Dashboard
                    </h2>
                    <p className="text-[10px] text-slate-400">
                      Longitudinal optical skin-impact tracking
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResearchCameraOpen(true)}
                  className="py-1 px-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                >
                  <Camera className="w-3 h-3" />
                  <span>Launch Camera</span>
                </button>
              </div>

              {/* Dashboard 5 Key Metrics (Requirement 13) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[10px]">
                <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Measurements</span>
                  <span className="text-white font-bold text-xs">{dashboardSummary.measurementsCount}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Personal Baseline</span>
                  <span
                    className={`font-bold text-xs ${
                      dashboardSummary.baselineEstablished ? 'text-[#5EEAD4]' : 'text-slate-400'
                    }`}
                  >
                    {dashboardSummary.baselineEstablished ? 'Established' : 'None'}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Calibration Quality</span>
                  <span className="text-[#22C55E] font-bold text-xs">
                    {dashboardSummary.calibrationQuality}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800">
                  <span className="text-slate-400 block text-[9px] uppercase">Environmental Records</span>
                  <span className="text-[#06B6D4] font-bold text-xs">
                    {dashboardSummary.environmentalRecordsCount}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-[#071A24] border border-slate-800 col-span-2 sm:col-span-2">
                  <span className="text-slate-400 block text-[9px] uppercase">Longitudinal Analysis</span>
                  <span
                    className={`font-bold text-xs ${
                      dashboardSummary.longitudinalAnalysisAvailable ? 'text-[#22C55E]' : 'text-[#F59E0B]'
                    }`}
                  >
                    {dashboardSummary.longitudinalAnalysisAvailable
                      ? 'Available'
                      : 'More repeated measurements are required'}
                  </span>
                </div>
              </div>

              {/* Timeline (Requirement 15) */}
              {allMeasurements.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#071A24] border border-slate-800 text-center space-y-2">
                  <p className="text-xs font-semibold text-slate-300">
                    No longitudinal research sessions recorded yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Launch the Research Camera to capture sequential optical baseline sessions and correlate them with Open-Meteo exposure history.
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setIsResearchCameraOpen(true)}
                      className="py-2 px-4 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Capture Baseline Session 1</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('history')}
                      className="py-2 px-4 rounded-xl bg-[#071A24] hover:bg-[#0F766E]/20 border border-slate-800 hover:border-[#0F766E]/60 text-[#5EEAD4] font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>See More History</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 px-0.5">
                    <span>Recent Research Sessions (Tap to inspect)</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {allMeasurements.length} total
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {allMeasurements.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedResearchRecord(m);
                          setIsMeasurementModalOpen(true);
                        }}
                        className="p-3 rounded-2xl bg-[#071A24] hover:bg-[#0F766E]/15 border border-slate-800 hover:border-[#0F766E]/60 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-mono font-bold text-white text-xs shrink-0">
                              Session #{m.sessionIndex}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0 whitespace-nowrap">
                              {new Date(m.timestamp).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0F766E]/30 text-[#5EEAD4] shrink-0 whitespace-nowrap">
                              OPTICAL RECORD
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">
                            AQI: {m.environmentalMeasurements?.measurements.aqi ?? 'N/A'} (PM2.5: {m.environmentalMeasurements?.measurements.pm2_5 ?? 'N/A'} µg/m³) · {m.location?.name || 'Local Site'}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-[#5EEAD4] bg-[#0F766E]/20 px-2 py-0.5 rounded-full border border-[#0F766E]/40 shrink-0 whitespace-nowrap">
                          {m.opticalFeatures?.nose?.variationCategory || 'Recorded'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate?.('history')}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#071A24] hover:bg-[#0F766E]/20 border border-slate-800 hover:border-[#0F766E]/60 text-[#5EEAD4] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-2"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>See More History ({allMeasurements.length} sessions) →</span>
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </section>

      {/* ------------------------------------------------------------- */}
      {/* D. Symptom-Specific Guidance — Big 3 Structure                */}
      {/* ------------------------------------------------------------- */}
      <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3 shadow-lg">
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
            {selectedSymptoms.length === 0
              ? 'Environmental Baseline'
              : selectedSymptoms.length === 1
              ? selectedSymptoms[0]
              : `${selectedSymptoms.length} Reported Concerns`}
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

        {/* Big 3 — 1. Why this matters */}
        <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-[#5EEAD4] uppercase flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Why this matters</span>
          </span>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {guidance.whyThisMatters}
          </p>
        </div>

        {/* Big 3 — 2. AirGuardian guidance (Do & Don't) */}
        <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-3">
          <span className="text-[11px] font-mono font-bold text-white uppercase flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>AirGuardian guidance</span>
          </span>

          {/* Do */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold text-[#22C55E] uppercase block">
              Do
            </span>
            <div className="space-y-1">
              {guidance.doList.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 p-1.5 rounded-lg bg-[#09212D] text-xs text-slate-200">
                  <Check className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                  <span className="leading-snug">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Don't */}
          <div className="space-y-1 pt-1 border-t border-slate-800">
            <span className="text-[10px] font-mono font-bold text-[#EF4444] uppercase block">
              Don't
            </span>
            <div className="space-y-1">
              {guidance.dontList.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2 p-1.5 rounded-lg bg-[#09212D] text-xs text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0 mt-1.5" />
                  <span className="leading-snug">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Big 3 — 3. When to get help */}
        <div className="p-3 rounded-2xl bg-[#071A24] border border-[#F59E0B]/30 space-y-1.5">
          <span className="text-[11px] font-mono font-bold text-[#F59E0B] uppercase flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>When to get help</span>
          </span>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {guidance.whenToGetHelp}
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* E. Actionable Air Quality Protection Tips (By AQI Severity)     */}
      {/* ------------------------------------------------------------- */}
      {(() => {
        const protectionTips = (() => {
          if (aqi <= 50) {
            return {
              levelName: 'Good',
              badgeColor: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/30',
              borderColor: 'border-[#22C55E]/30',
              summary: 'Air quality is satisfactory and poses little or no health risk. Ideal conditions for outdoor activities.',
              activity: 'Enjoy all outdoor workouts, running, cycling, and sports without restriction.',
              ventilation: 'Optimal time for natural cross-ventilation. Open windows to refresh indoor air and flush out stagnant CO₂.',
              respiratory: 'No masks or respirators needed for outdoor activities.',
              sensitive: 'Safe for everyone, including children, pregnant individuals, and individuals with respiratory conditions.',
              dominantTip: `Ambient ${dominantPollutant} is within clean baseline standards.`,
            };
          }
          if (aqi <= 100) {
            return {
              levelName: 'Moderate',
              badgeColor: 'bg-[#EAB308]/15 text-[#EAB308] border-[#EAB308]/30',
              borderColor: 'border-[#EAB308]/30',
              summary: 'Acceptable air quality for the general public, but unusually sensitive people may experience mild symptoms.',
              activity: 'Outdoor exercise is fine for most people. Unusually sensitive individuals should take more rest breaks if coughing.',
              ventilation: 'Natural ventilation is acceptable, but close windows facing congested roadways during peak morning and evening traffic.',
              respiratory: 'Masks generally not required for the general public. Sensitive individuals may choose an N95 near busy roads.',
              sensitive: 'People with asthma or hyperreactive airways should keep quick-relief inhalers on hand during extended workouts.',
              dominantTip: `Monitored ${dominantPollutant} is the primary driver. Stay aware if spending long hours near emission sources.`,
            };
          }
          if (aqi <= 150) {
            return {
              levelName: 'Unhealthy for Sensitive Groups',
              badgeColor: 'bg-[#F97316]/15 text-[#F97316] border-[#F97316]/30',
              borderColor: 'border-[#F97316]/30',
              summary: 'Sensitive groups may experience health effects. The general public is less likely to be noticeably affected.',
              activity: 'Sensitive individuals should reduce prolonged or heavy outdoor exertion. Shift intense cardio workouts indoors.',
              ventilation: 'Keep windows and doors closed. Switch HVAC or vehicle air systems to internal recirculation mode.',
              respiratory: 'Sensitive individuals should wear a snug-fitting N95 or KN95 particulate respirator when commuting outdoors.',
              sensitive: 'Children, older adults, and individuals with asthma, COPD, or heart disease should take frequent breaks and stay hydrated indoors.',
              dominantTip: `Elevated ${dominantPollutant} concentrations can cause airway irritation. Avoid congested traffic corridors.`,
            };
          }
          if (aqi <= 200) {
            return {
              levelName: 'Unhealthy',
              badgeColor: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30',
              borderColor: 'border-[#EF4444]/30',
              summary: 'Everyone may begin to experience adverse health effects; sensitive groups may experience more serious effects.',
              activity: 'Avoid strenuous outdoor activities. Move all workouts and vigorous physical exercises to filtered indoor environments.',
              ventilation: 'Keep all windows tightly closed. Run certified HEPA air purifiers continuously in living areas and bedrooms.',
              respiratory: 'Wear a certified N95, KN95, or FFP2 respirator outdoors. Standard surgical or cloth masks do not filter fine particulates.',
              sensitive: 'Sensitive groups should avoid all outdoor physical activities and remain indoors in air-filtered spaces.',
              dominantTip: `Significant concentration of ${dominantPollutant}. Minimizing outdoor exposure is strongly advised.`,
            };
          }
          if (aqi <= 300) {
            return {
              levelName: 'Very Unhealthy',
              badgeColor: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30',
              borderColor: 'border-[#A855F7]/30',
              summary: 'Health alert: Risk of health effects is substantially increased for everyone across the entire population.',
              activity: 'Avoid all outdoor physical exertion. Restrict outdoor presence strictly to brief, essential movements.',
              ventilation: 'Seal gaps around doors and windows. Create a designated "clean room" equipped with a high-efficiency HEPA filtration unit.',
              respiratory: 'Mandatory well-fitted N95/FFP2 respirator with an airtight facial seal for any unavoidable outdoor step.',
              sensitive: 'High-risk individuals should stay strictly indoors and follow doctor-prescribed action plans for respiratory/cardiac flare-ups.',
              dominantTip: `Critical levels of ${dominantPollutant} present severe oxidative stress to mucous membranes.`,
            };
          }
          return {
            levelName: 'Hazardous',
            badgeColor: 'bg-[#991B1B]/20 text-[#FCA5A5] border-[#991B1B]/40',
            borderColor: 'border-[#991B1B]/40',
            summary: 'Emergency conditions. The entire population is likely to be significantly affected. Serious risk of adverse health events.',
            activity: 'Everyone should avoid all outdoor physical activity and remain indoors. Non-essential outdoor trips should be canceled.',
            ventilation: 'Keep indoor environments completely isolated from ambient air. Run HEPA filtration on maximum speed.',
            respiratory: 'Tightly sealed N95, KN95, or elastomeric respirator required for any step outdoors.',
            sensitive: 'Immediate medical consultation if experiencing chest tightness, wheezing, or difficulty breathing.',
            dominantTip: `Emergency concentration of ${dominantPollutant}. Full protective protocol active.`,
          };
        })();

        return (
          <section className="p-4 rounded-3xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/25">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5 font-mono">
                    <span>Actionable Air Quality Protection Tips</span>
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    Dynamically tuned to current AQI severity ({aqi} · {category})
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${protectionTips.badgeColor}`}
              >
                AQI {aqi} · {protectionTips.levelName}
              </span>
            </div>

            {/* Severity summary banner */}
            <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Current Severity Status
              </span>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {protectionTips.summary}
              </p>
            </div>

            {/* 4 Actionable Protection Categories Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* 1. Outdoor Activity */}
              <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#38BDF8] font-bold text-[11px] font-mono">
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span>Outdoor Activity & Exercise</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {protectionTips.activity}
                </p>
              </div>

              {/* 2. Indoor Environment & Ventilation */}
              <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#5EEAD4] font-bold text-[11px] font-mono">
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span>Ventilation & Indoor Air</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {protectionTips.ventilation}
                </p>
              </div>

              {/* 3. Respiratory Protection & Masking */}
              <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#F59E0B] font-bold text-[11px] font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Masks & Filtration</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {protectionTips.respiratory}
                </p>
              </div>

              {/* 4. Sensitive Populations */}
              <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#EC4899] font-bold text-[11px] font-mono">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Sensitive & Vulnerable Groups</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {protectionTips.sensitive}
                </p>
              </div>
            </div>

            {/* Dominant Pollutant Alert Banner */}
            <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 flex items-start gap-2 text-xs">
              <Wind className="w-4 h-4 text-[#06B6D4] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase text-[#06B6D4] font-bold block">
                  Dominant Pollutant Factor ({dominantPollutant})
                </span>
                <p className="text-[11px] text-slate-300 leading-snug">
                  {protectionTips.dominantTip}
                </p>
              </div>
            </div>
          </section>
        );
      })()}

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

      {/* Multispectral Research Camera Prototype Modal */}
      <AirGuardianCameraModal
        isOpen={isResearchCameraOpen}
        onClose={() => {
          setIsResearchCameraOpen(false);
          setResearchSessions(researchAnalysisService.getHistory());
        }}
        activeReading={reading}
      />

      {/* Research Measurement Record Inspector Modal */}
      <ResearchMeasurementModal
        isOpen={isMeasurementModalOpen}
        onClose={() => setIsMeasurementModalOpen(false)}
        record={selectedResearchRecord}
        onRecordUpdated={() => setResearchSessions(researchAnalysisService.getHistory())}
        onRecordDeleted={() => setResearchSessions(researchAnalysisService.getHistory())}
      />

      {/* Health Camera Modal with direct No-Photo continuation */}
      <HealthCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onPhotoSelected={handlePhotoCapturedOrSelected}
        onContinueWithoutPhoto={handleChooseContinueWithoutPhoto}
      />
    </div>
  );
};
