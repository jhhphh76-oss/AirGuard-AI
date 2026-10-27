import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  X,
  Upload,
  RefreshCw,
  AlertTriangle,
  Check,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  Info,
  Sliders,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
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
  ResearchMeasurementRecord,
  AcquisitionMode,
} from '../../services/research/types';
import { calibrationService } from '../../services/research/calibrationService';
import { spectralDataService } from '../../services/research/spectralDataService';
import { faceSegmentationService } from '../../services/research/faceSegmentationService';
import { featureExtractionService } from '../../services/research/featureExtractionService';
import { environmentalDataService } from '../../services/research/environmentalDataService';
import { researchAnalysisService } from '../../services/research/researchAnalysisService';
import { imageQualityService } from '../../services/research/imageQualityService';
import { ResearchVisualizationCard } from './ResearchVisualizationCard';
import { AQIReading } from '../../types/airguard';

interface AirGuardianCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeReading: AQIReading;
}

type Stage = 'capture' | 'preview' | 'processing' | 'visualization';

export const AirGuardianCameraModal: React.FC<AirGuardianCameraModalProps> = ({
  isOpen,
  onClose,
  activeReading,
}) => {
  const [stage, setStage] = useState<Stage>('capture');
  const [acquisitionMode, setAcquisitionMode] = useState<AcquisitionMode>('live_camera');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showManageGuidance, setShowManageGuidance] = useState(false);

  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Optical Research Pipeline Artifacts
  const [cube, setCube] = useState<SpectralCube | null>(null);
  const [features, setFeatures] = useState<Record<FaceRegion, RegionalOpticalFeatures> | null>(null);
  const [environmentalSnapshot, setEnvironmentalSnapshot] = useState<EnvironmentalSnapshot | null>(null);
  const [calibration, setCalibration] = useState<CalibrationState>(() =>
    calibrationService.getStatus()
  );
  const [hardware, setHardware] = useState<HardwareStatus>(() =>
    spectralDataService.getHardwareStatus()
  );
  const [imageQuality, setImageQuality] = useState<ImageQualityMetrics | null>(null);
  const [timeAlignment, setTimeAlignment] = useState<TimeAlignmentInfo | null>(null);
  const [baselineComparison, setBaselineComparison] = useState<PersonalBaselineComparison | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityPanelStatus | null>(null);
  const [interpretation, setInterpretation] = useState<QualifiedResearchInterpretation | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(85);
  const [currentMeasurementRecord, setCurrentMeasurementRecord] = useState<ResearchMeasurementRecord | null>(null);
  const [isSavedToTimeline, setIsSavedToTimeline] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('Error stopping video tracks:', err);
      }
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setIsRequestingPermission(false);
  }, []);

  // Clean shutdown when modal closes
  const handleModalClose = useCallback(() => {
    stopStream();
    setStage('capture');
    setCapturedDataUrl(null);
    setAnalysisError(null);
    setCube(null);
    setFeatures(null);
    setImageQuality(null);
    setTimeAlignment(null);
    setBaselineComparison(null);
    setDataQuality(null);
    setCurrentMeasurementRecord(null);
    setIsSavedToTimeline(false);
    onClose();
  }, [stopStream, onClose]);

  // Request browser camera permission ONLY on explicit user choice
  const startCamera = async () => {
    stopStream();
    setPermissionDenied(false);
    setShowManageGuidance(false);
    setIsRequestingPermission(true);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setIsRequestingPermission(false);
      setAnalysisError('Camera API is unsupported on this browser/device.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setIsRequestingPermission(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play delayed:', e));
      }
    } catch (err: any) {
      console.warn('Camera request error:', err);
      setIsRequestingPermission(false);
      setIsCameraActive(false);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      } else {
        setAnalysisError(err?.message || 'Unable to access camera.');
      }
    }
  };

  // Re-attach video stream if element becomes available while streaming
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  // Evaluate image on canvas for preliminary preview metrics
  const evaluatePreviewImage = (canvas: HTMLCanvasElement) => {
    const segmentation = faceSegmentationService.evaluateSegmentation(canvas);
    const metrics = imageQualityService.evaluateImageQuality(
      canvas,
      segmentation.confidenceScore,
      0.35
    );
    setImageQuality(metrics);
  };

  // Snap photo from live video feed
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    setAcquisitionMode('live_camera');
    setCapturedDataUrl(dataUrl);
    evaluatePreviewImage(canvas);
    calibrationService.markSkinCaptured(true);
    setCalibration(calibrationService.getStatus());
    setStage('preview');
  };

  // Gallery file upload fallback (Requirement 1: works independently of camera permission)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        stopStream();
        setAcquisitionMode('gallery_upload');
        setCapturedDataUrl(dataUrl);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 640;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            evaluatePreviewImage(canvas);
          }
        };
        img.src = dataUrl;

        calibrationService.markSkinCaptured(true);
        setCalibration(calibrationService.getStatus());
        setStage('preview');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Retake photo action
  const handleRetake = () => {
    setCapturedDataUrl(null);
    setCube(null);
    setFeatures(null);
    setImageQuality(null);
    setCurrentMeasurementRecord(null);
    setIsSavedToTimeline(false);
    setStage('capture');
  };

  // Run Optical Research Pipeline
  const handleExecuteAnalysis = async () => {
    if (!capturedDataUrl) return;

    setStage('processing');
    setAnalysisError(null);

    try {
      // Step A: Ensure standard calibration references are ready
      let currentCalib = calibrationService.getStatus();
      if (!currentCalib.isReady) {
        currentCalib = calibrationService.applyStandardReferences();
        setCalibration(currentCalib);
      }

      // Step B: Load image onto canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = capturedDataUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load captured image into optical buffer.'));
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Optical canvas context unavailable.');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Step C: Construct Spectral Cube (Band 1..N)
      const spectralCube = spectralDataService.generateSpectralCubeFromCanvas(canvas, 64, 64);
      setCube(spectralCube);

      // Step D: Evaluate Facial Segmentation across 5 research regions
      const segmentation = faceSegmentationService.evaluateSegmentation(canvas);
      setConfidenceScore(segmentation.confidenceScore);

      // Step E: Compute Image Quality Metrics (Requirement 4)
      const metrics = imageQualityService.evaluateImageQuality(
        canvas,
        segmentation.confidenceScore,
        0.35
      );
      setImageQuality(metrics);

      // Step F: Extract Regional Optical Features (Wavelength reflectances, variation scores)
      const regionalFeatures = featureExtractionService.extractFeatures(spectralCube, segmentation);
      setFeatures(regionalFeatures);

      // Step G: Fuse with Real Open-Meteo Environmental Telemetry (Requirement 10)
      const opticalCaptureTime = Date.now();
      const envSnapshot = environmentalDataService.createSnapshot(activeReading, opticalCaptureTime);
      setEnvironmentalSnapshot(envSnapshot);

      // Step H: Compute Time Alignment (Requirement 11)
      const alignment = environmentalDataService.computeTimeAlignment(opticalCaptureTime, envSnapshot);
      setTimeAlignment(alignment);

      // Step I: Compare with Personal Baseline (Requirement 9)
      const baselineComp = researchAnalysisService.compareWithBaseline(regionalFeatures);
      setBaselineComparison(baselineComp);

      const existingHistory = researchAnalysisService.getMeasurements();
      const sessionIndex = existingHistory.length + 1;

      // Step J: Compute Data Quality Status (Requirement 18)
      const dqStatus = researchAnalysisService.computeDataQualityPanel(
        metrics,
        currentCalib,
        segmentation.confidenceScore,
        envSnapshot,
        alignment,
        sessionIndex
      );
      setDataQuality(dqStatus);

      // Step K: 5-Stage Qualified AI Interpretation (Requirement 16)
      const researchInterpretation = researchAnalysisService.generateInterpretation(
        regionalFeatures,
        envSnapshot,
        baselineComp,
        alignment,
        sessionIndex,
        existingHistory.length
      );
      setInterpretation(researchInterpretation);

      // Step L: Build Complete Structured Measurement Record (Requirement 2)
      const record: ResearchMeasurementRecord = {
        id: `meas_${opticalCaptureTime}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: opticalCaptureTime,
        sessionIndex,
        acquisitionMode,
        sourceType: 'Camera Optical Assessment',
        location: activeReading?.location || null,
        environmentalDataTimestamp: envSnapshot?.timestamp || null,
        calibration: currentCalib,
        imageQuality: metrics,
        detectedFacialRegions: regionalFeatures,
        opticalFeatures: regionalFeatures,
        environmentalMeasurements: envSnapshot,
        analysis: researchInterpretation,
        dataStatus: 'REAL MEASUREMENT',
        timeAlignment: alignment,
        baselineComparison: baselineComp,
        dataQuality: dqStatus,
        imageDataUrl: capturedDataUrl,
        cubeBandsCount: spectralCube.bands.length,
      };

      setCurrentMeasurementRecord(record);
      // Automatically commit to history
      researchAnalysisService.saveMeasurement(record);
      setIsSavedToTimeline(true);

      setStage('visualization');
    } catch (err: any) {
      console.error('Research analysis failed:', err);
      setAnalysisError(err?.message || 'Optical processing failed.');
      setStage('preview');
    }
  };

  // Save session explicitly if user requests
  const handleSaveToTimeline = () => {
    if (currentMeasurementRecord) {
      researchAnalysisService.saveMeasurement(currentMeasurementRecord);
      setIsSavedToTimeline(true);
    }
  };

  // Delete sensitive face image dataUrl while preserving numerical metrics (Requirement 19 - Privacy)
  const handleDeletePhoto = () => {
    if (currentMeasurementRecord) {
      researchAnalysisService.deleteImageForMeasurement(currentMeasurementRecord.id);
      setCurrentMeasurementRecord({
        ...currentMeasurementRecord,
        imageDataUrl: null,
      });
      setCapturedDataUrl(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="research-camera-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
      onClick={handleModalClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#071A24] border border-[#263238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[#263238] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/30 shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="research-camera-title" className="text-sm font-bold text-white truncate">
                AirGuardian Camera Prototype
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                Optical Skin-Impact Research (P0 Simulation)
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Close camera prototype"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Hidden Gallery Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Modal Body */}
        <div className="p-3.5 sm:p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Scientific Disclaimer Banner */}
          <div className="p-3 rounded-2xl bg-[#09212D] border border-slate-700/80 flex items-start gap-2.5 text-[11px] text-slate-300 shadow-md">
            <Shield className="w-4 h-4 text-[#38BDF8] shrink-0 mt-0.5" />
            <p className="leading-snug">
              <strong>Research Prototype Notice:</strong> Experimental optical prototype. Not a medical or diagnostic device. Does not diagnose skin disease or prove pollution caused a biological change.
            </p>
          </div>

          {/* Error Message Alert */}
          {analysisError && (
            <div className="p-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-xs text-[#EF4444] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 1: CAPTURE PHOTO / GALLERY                               */}
          {/* ============================================================== */}
          {stage === 'capture' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Permission Denied Notice with Manage Options */}
              {permissionDenied && (
                <div className="p-3.5 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#EF4444] space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Camera Permission Blocked</span>
                  </div>
                  <p className="text-[11px] text-slate-200 leading-snug">
                    Camera access was denied in your browser settings. You can still upload images directly from your gallery, or manage permissions.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowManageGuidance(!showManageGuidance)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
                    >
                      {showManageGuidance ? 'Hide Guidance' : 'Manage Permission'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-[#0F766E] text-white text-xs font-bold hover:bg-[#0F766E]/80 transition-colors"
                    >
                      Upload from Gallery
                    </button>
                  </div>

                  {showManageGuidance && (
                    <div className="p-2.5 rounded-xl bg-black/40 border border-slate-700 text-[10px] text-slate-300 space-y-1">
                      <span className="font-bold text-white block">How to enable:</span>
                      <p>
                        Click the lock or tune icon in your browser address bar, set Camera to &quot;Allow&quot;, and refresh the page.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Live Camera Viewfinder or Initial Options */}
              {isCameraActive ? (
                <div className="space-y-3">
                  <div className="relative w-full aspect-square max-h-72 bg-black rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-inner">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover transform -scale-x-100"
                    />

                    {/* Facial Target Alignment Reticle */}
                    <div className="absolute inset-8 rounded-full border-2 border-dashed border-[#5EEAD4]/60 pointer-events-none flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                        Position Face Target
                      </span>
                    </div>
                  </div>

                  {/* Camera Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={stopStream}
                      className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSnapPhoto}
                      className="flex-1 py-3 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#0F766E]/80 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#071A24] border border-slate-800 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      Optical Image Acquisition
                    </h3>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Capture an image under controlled lighting or upload an existing facial photo. The research prototype evaluates visible wavelength bands (Band 1..N) across 5 facial regions and pairs with Open-Meteo environmental exposure.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={isRequestingPermission}
                      className="py-3.5 px-3 rounded-2xl bg-[#0F766E] hover:bg-[#0F766E]/80 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                    >
                      {isRequestingPermission ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <span>Capture Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-3.5 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Upload className="w-4 h-4 text-[#38BDF8]" />
                      <span>Upload Gallery</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Research Pipeline Architecture Flow */}
              <div className="p-3 rounded-2xl bg-[#09212D] border border-slate-800 space-y-1.5 text-[10px] text-slate-400 font-mono">
                <span className="font-bold text-slate-300 uppercase tracking-wider block">
                  Research Pipeline Stages
                </span>
                <p className="leading-snug">
                  Controlled Lighting → Face Target → Optical Polarization Check → Spectral Image Cube (Band 1..N) → Calibration → Regional Features → Environmental Data Fusion → 5-Stage Qualified Analysis
                </p>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 2: PREVIEW CAPTURED / UPLOADED IMAGE                     */}
          {/* ============================================================== */}
          {stage === 'preview' && capturedDataUrl && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="relative w-full aspect-square max-h-72 bg-black rounded-3xl overflow-hidden border border-slate-700 flex items-center justify-center shadow-inner">
                <img
                  src={capturedDataUrl}
                  alt="Captured skin reference"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/60 text-[9px] font-mono text-[#5EEAD4] border border-[#0F766E]">
                  Skin Target Acquired ({acquisitionMode === 'live_camera' ? 'Camera' : 'Gallery'})
                </div>
              </div>

              {/* Preliminary Image Quality Feedback (Requirement 4) */}
              {imageQuality && (
                <div className="p-3 rounded-2xl bg-[#09212D] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono uppercase">Image Quality:</span>
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        imageQuality.qualityCategory === 'Good'
                          ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                          : 'bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30'
                      }`}
                    >
                      {imageQuality.qualityCategory}
                    </span>
                  </div>
                  {imageQuality.issues.length > 0 && (
                    <div className="text-[10px] text-[#F59E0B] space-y-0.5 pt-0.5">
                      {imageQuality.issues.map((iss, i) => (
                        <p key={i}>• {iss}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Retake / Change / Analyze */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Other</span>
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAnalysis}
                  className="flex-1 py-3 px-4 rounded-2xl bg-[#0F766E] hover:bg-[#0F766E]/80 active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#5EEAD4]" />
                  <span>Analyze Optical Features</span>
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 3: PROCESSING / SPECTRAL DECOMPOSITION                   */}
          {/* ============================================================== */}
          {stage === 'processing' && (
            <div className="p-8 rounded-3xl bg-[#09212D] border border-[#0F766E]/50 flex flex-col items-center justify-center text-center space-y-3 animate-pulse">
              <div className="p-3.5 rounded-full bg-[#0F766E]/20 text-[#5EEAD4] border border-[#0F766E]/40 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Extracting Multispectral Data Cube</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-mono">
                Segmenting 5 facial regions · Calculating image quality · Computing reflectance vs Band 1..N · Fusing Open-Meteo telemetry...
              </p>
            </div>
          )}

          {/* ============================================================== */}
          {/* STAGE 4: RESEARCH VISUALIZATION                                */}
          {/* ============================================================== */}
          {stage === 'visualization' && cube && features && interpretation && (
            <div className="space-y-4 animate-in fade-in">
              <ResearchVisualizationCard
                cube={cube}
                regionalFeatures={features}
                environmental={environmentalSnapshot}
                calibration={calibration}
                hardware={hardware}
                interpretation={interpretation}
                confidenceScore={confidenceScore}
                imageQuality={imageQuality || undefined}
                timeAlignment={timeAlignment || undefined}
                baselineComparison={baselineComparison || undefined}
                dataQuality={dataQuality || undefined}
                dataStatus="REAL MEASUREMENT"
                onSaveToHistory={handleSaveToTimeline}
                isSaved={isSavedToTimeline}
                onDeleteImage={capturedDataUrl ? handleDeletePhoto : undefined}
                imageDataUrl={capturedDataUrl}
              />

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#5EEAD4]" />
                  <span>Capture Another Optical Session</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#071A24] border-t border-[#263238] flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500">
            AirGuard AI · Optical Research Prototype
          </span>
          <button
            type="button"
            onClick={handleModalClose}
            className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            {stage === 'visualization' ? 'Done' : 'Back'}
          </button>
        </div>
      </div>
    </div>
  );
};
