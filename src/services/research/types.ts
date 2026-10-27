/**
 * AirGuard AI - Multispectral Optical Skin-Impact Research Prototype Types
 * 
 * IMPORTANT SCIENTIFIC DISCLAIMER:
 * Experimental research prototype only. NOT a medical or diagnostic device.
 * Does not diagnose skin disease or establish causation between pollution and biological change.
 * Never fabricate measurements, wavelengths, environmental values, correlations, or scientific conclusions.
 */

import { LocationData } from '../../types/airguard';

export type FaceRegion = 'forehead' | 'nose' | 'left_cheek' | 'right_cheek' | 'chin';

export type VariationCategory =
  | 'Low variation'
  | 'Moderate variation'
  | 'Higher variation'
  | 'Insufficient data';

export type PrototypeStage = 'P0' | 'P1' | 'P2' | 'P3';

export type AcquisitionMode = 'live_camera' | 'gallery_upload';

export type MeasurementDataStatus =
  | 'REAL MEASUREMENT'
  | 'SIMULATED DATA'
  | 'RGB IMAGE ONLY'
  | 'MULTISPECTRAL HARDWARE NOT CONNECTED'
  | 'INCOMPLETE DATA';

export interface WavelengthBand {
  id: string;
  nominalWavelengthNm: number;
  label: string; // e.g., "Band 1", "Band 2" or "Visible Blue (450nm)"
  isSimulated: boolean;
  intensityGrid?: Float32Array; // 2D image plane normalized 0.0 - 1.0
  thumbnailUrl?: string; // Rendered visual band slice preview
}

export interface SpectralCube {
  width: number;
  height: number;
  bands: WavelengthBand[];
  isSimulation: boolean;
  hardwareLabel: string; // e.g., "RGB optical image — multispectral hardware unavailable"
  capturedAt: number;
}

export interface CalibrationState {
  darkCaptured: boolean;
  darkValue: number; // Baseline sensor bias offset (0-255 scale)
  whiteCaptured: boolean;
  whiteValue: number; // Calibration reference standard (99% reflectance)
  skinCaptured: boolean;
  normalized: boolean;
  isReady: boolean;
  statusLabel: 'Ready' | 'Incomplete';
  formula: string; // "Normalized Reflectance = (Sample - Dark) / (Reference - Dark)"
}

export interface RegionalOpticalFeatures {
  region: FaceRegion;
  regionLabel: string;
  meanReflectance: number; // 0.0 - 1.0
  variationScore: number; // standard deviation
  variationCategory: VariationCategory;
  relativeSpectralDifferences: {
    redGreenRatio: number;
    blueIndex: number;
    contrastUniformity: number;
  };
  wavelengthReflectances: { wavelengthNm: number; reflectance: number; bandLabel?: string }[];
  confidence: number; // 0 - 100%
  boundingBox: { x: number; y: number; width: number; height: number };
}

export interface HardwareStatus {
  cameraConnected: boolean;
  multispectralSensorConnected: boolean;
  polarizerConnected: boolean;
  prototypeStage: PrototypeStage;
  polarizerStatusLabel: string; // "Polarization hardware: Not connected"
  polarizerExplanation: string; // "Polarization can help reduce unwanted surface reflection and improve optical measurement consistency."
  hardwareNotice: string; // "MULTISPECTRAL HARDWARE NOT CONNECTED"
}

export interface EnvironmentalSnapshot {
  timestamp: string;
  opticalMeasurementTimestamp: number;
  locationName: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  measurements: {
    aqi: number | null;
    pm2_5: number | null;
    pm10: number | null;
    o3: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    uv_index: number | null;
  };
  dataSource: string; // e.g. "Open-Meteo Air Quality Grid"
}

export interface ImageQualityMetrics {
  qualityCategory: 'Good' | 'Needs Improvement';
  brightnessConsistency: number; // 0 - 100
  exposureQuality: 'Balanced' | 'Underexposed' | 'Overexposed';
  meanLuminance: number; // 0 - 255
  blurSharpnessScore: number; // High-frequency Laplacian gradient variance
  isSharp: boolean;
  faceDetectionConfidence: number; // 0 - 100%
  usableFaceAreaPercent: number; // 0 - 100%
  resolution: { width: number; height: number };
  issues: string[]; // List of honest quality issues
}

export interface TimeAlignmentInfo {
  opticalTimestamp: number;
  environmentalTimestamp: string | null;
  differenceMinutes: number | null;
  isAligned: boolean;
  alignmentStatus:
    | 'Time-aligned'
    | 'Environmental measurement is not sufficiently time-aligned'
    | 'Environmental data unavailable for this measurement';
}

export interface PersonalBaselineComparison {
  baselineEstablished: boolean;
  baselineTimestamp: number | null;
  baselineLocationName: string | null;
  variationCategory:
    | 'Minimal variation'
    | 'Moderate variation'
    | 'Higher variation'
    | 'Baseline comparison unavailable';
  averageOpticalShift: number | null; // delta standard deviation
  highestShiftRegion: string | null;
  comparisonNotes: string;
}

export interface DataQualityPanelStatus {
  cameraAcquisition: 'Good' | 'Limited';
  calibration: 'Valid' | 'Incomplete';
  faceSegmentation: 'Valid' | 'Limited';
  spectralData: 'Available' | 'Unavailable';
  environmentalData: 'Available' | 'Unavailable';
  timeAlignment: 'Valid' | 'Limited';
  longitudinalData: 'Sufficient' | 'Insufficient';
}

export interface QualifiedResearchInterpretation {
  data: string;
  observation: string;
  comparison: string;
  environmentalAssociation: string;
  limitation: string;
  hasSufficientLongitudinalData: boolean;
  disclaimer: string;
}

export interface ResearchMeasurementRecord {
  id: string;
  timestamp: number;
  sessionIndex: number;
  acquisitionMode: AcquisitionMode;
  sourceType: string;
  location: LocationData | null;
  environmentalDataTimestamp: string | null;
  calibration: CalibrationState;
  imageQuality: ImageQualityMetrics;
  detectedFacialRegions: Record<FaceRegion, RegionalOpticalFeatures>;
  opticalFeatures: Record<FaceRegion, RegionalOpticalFeatures>;
  environmentalMeasurements: EnvironmentalSnapshot | null;
  analysis: QualifiedResearchInterpretation;
  dataStatus: MeasurementDataStatus;
  timeAlignment: TimeAlignmentInfo;
  baselineComparison: PersonalBaselineComparison;
  dataQuality: DataQualityPanelStatus;
  imageDataUrl?: string | null; // Sensitive face photo; user can delete via privacy controls
  cubeBandsCount: number;
  notes?: string;
}

export interface PersonalBaselineRecord {
  id: string;
  measurementId: string;
  timestamp: number;
  locationName: string;
  regionalFeatures: Record<FaceRegion, RegionalOpticalFeatures>;
  environmentalSnapshot: EnvironmentalSnapshot | null;
  imageQuality: ImageQualityMetrics;
}

export interface LongitudinalRecord {
  id: string;
  sessionIndex: number; // Measurement 1, 2, 3...
  timestamp: number;
  environmental: EnvironmentalSnapshot;
  regionalFeatures: Record<FaceRegion, RegionalOpticalFeatures>;
  overallConfidence: number;
  isSimulated: boolean;
  notes?: string;
  measurementRecord?: ResearchMeasurementRecord;
}
