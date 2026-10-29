/**
 * AirGuard AI - Research Analysis & Longitudinal Association Service
 * 
 * Pipeline step: Statistical Association -> Qualified Interpretation -> Visualization
 * 
 * Five-Stage Analytical Pattern (Requirement 16):
 * 1. DATA (measured timestamps, session count, Open-Meteo telemetry)
 * 2. OBSERVATION (measured optical feature deltas across facial regions)
 * 3. COMPARISON (explicit comparison against personal baseline)
 * 4. ENVIRONMENTAL ASSOCIATION (correlation analysis across overlapping observation periods)
 * 5. LIMITATION (cautious scientific limitation emphasizing correlation vs causation)
 * 
 * Strict Scientific Boundaries:
 * - Never claims pollution caused biological damage.
 * - Never diagnoses medical or dermatological conditions.
 * - Strictly distinguishes CORRELATION from CAUSATION.
 * - Respects patient privacy with full image deletion and data wiping controls.
 */

import {
  FaceRegion,
  LongitudinalRecord,
  QualifiedResearchInterpretation,
  RegionalOpticalFeatures,
  EnvironmentalSnapshot,
  ResearchMeasurementRecord,
  PersonalBaselineRecord,
  PersonalBaselineComparison,
  DataQualityPanelStatus,
  ImageQualityMetrics,
  TimeAlignmentInfo,
  CalibrationState,
  MeasurementDataStatus,
} from './types';

const MEASUREMENTS_STORAGE_KEY = 'airguard_research_measurements_v2';
const LEGACY_STORAGE_KEY = 'airguard_multispectral_research_history';
const BASELINE_STORAGE_KEY = 'airguard_research_personal_baseline';

class ResearchAnalysisService {
  private memoryMeasurements: ResearchMeasurementRecord[] = [];
  private memoryBaseline: PersonalBaselineRecord | null = null;

  /**
   * Retrieve all preserved research measurement records
   */
  public getMeasurements(): ResearchMeasurementRecord[] {
    if (typeof localStorage === 'undefined') {
      return [...this.memoryMeasurements].sort((a, b) => b.timestamp - a.timestamp);
    }
    try {
      const data = localStorage.getItem(MEASUREMENTS_STORAGE_KEY);
      if (data) {
        const records: ResearchMeasurementRecord[] = JSON.parse(data);
        if (Array.isArray(records)) {
          return records.sort((a, b) => b.timestamp - a.timestamp);
        }
      }
    } catch (e) {
      console.warn('Failed to parse research measurements:', e);
    }
    return [...this.memoryMeasurements].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Retrieve single measurement record by ID
   */
  public getMeasurementById(id: string): ResearchMeasurementRecord | null {
    const list = this.getMeasurements();
    return list.find((m) => m.id === id) || null;
  }

  /**
   * Retrieve established Personal Baseline
   */
  public getPersonalBaseline(): PersonalBaselineRecord | null {
    if (typeof localStorage === 'undefined') {
      return this.memoryBaseline;
    }
    try {
      const data = localStorage.getItem(BASELINE_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse personal baseline:', e);
    }
    return this.memoryBaseline;
  }

  /**
   * Set or update Personal Baseline
   */
  public setPersonalBaseline(record: PersonalBaselineRecord): void {
    this.memoryBaseline = record;
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(record));
    } catch (e) {
      console.warn('Failed to store personal baseline:', e);
    }
  }

  /**
   * Clear Personal Baseline
   */
  public clearPersonalBaseline(): void {
    this.memoryBaseline = null;
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(BASELINE_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear personal baseline:', e);
    }
  }

  /**
   * Compare current optical features against the Personal Baseline (Requirement 9)
   * Never compares against an invented "normal human skin" reference.
   */
  public compareWithBaseline(
    currentFeatures: Record<FaceRegion, RegionalOpticalFeatures>
  ): PersonalBaselineComparison {
    const baseline = this.getPersonalBaseline();

    if (!baseline) {
      return {
        baselineEstablished: false,
        baselineTimestamp: null,
        baselineLocationName: null,
        variationCategory: 'Baseline comparison unavailable',
        averageOpticalShift: null,
        highestShiftRegion: null,
        comparisonNotes:
          'Baseline comparison unavailable. This measurement can be established as your personal reference baseline.',
      };
    }

    // Check if segmentation in either record is insufficient
    const hasInsufficientData = Object.values(currentFeatures).some(
      (f) => f.variationCategory === 'Insufficient data'
    );

    if (hasInsufficientData) {
      return {
        baselineEstablished: true,
        baselineTimestamp: baseline.timestamp,
        baselineLocationName: baseline.locationName,
        variationCategory: 'Baseline comparison unavailable',
        averageOpticalShift: null,
        highestShiftRegion: null,
        comparisonNotes:
          'Face segmentation confidence insufficient to perform regional baseline comparison.',
      };
    }

    const regions: FaceRegion[] = ['forehead', 'nose', 'left_cheek', 'right_cheek', 'chin'];
    let totalDelta = 0;
    let maxDelta = 0;
    let highestRegion: FaceRegion = 'nose';
    let validRegionCount = 0;

    regions.forEach((r) => {
      const baseFeat = baseline.regionalFeatures[r];
      const currFeat = currentFeatures[r];
      if (
        baseFeat &&
        currFeat &&
        typeof baseFeat.variationScore === 'number' &&
        typeof currFeat.variationScore === 'number' &&
        baseFeat.variationCategory !== 'Insufficient data' &&
        currFeat.variationCategory !== 'Insufficient data'
      ) {
        const delta = Math.abs(currFeat.variationScore - baseFeat.variationScore);
        totalDelta += delta;
        validRegionCount++;
        if (delta > maxDelta) {
          maxDelta = delta;
          highestRegion = r;
        }
      }
    });

    if (validRegionCount === 0) {
      return {
        baselineEstablished: true,
        baselineTimestamp: baseline.timestamp,
        baselineLocationName: baseline.locationName,
        variationCategory: 'Baseline comparison unavailable',
        averageOpticalShift: null,
        highestShiftRegion: null,
        comparisonNotes: 'Regional optical data insufficient to compute baseline shift.',
      };
    }

    const averageOpticalShift = Math.round((totalDelta / validRegionCount) * 1000) / 1000;

    let variationCategory: 'Minimal variation' | 'Moderate variation' | 'Higher variation' =
      'Minimal variation';
    if (averageOpticalShift >= 0.08) {
      variationCategory = 'Higher variation';
    } else if (averageOpticalShift >= 0.035) {
      variationCategory = 'Moderate variation';
    }

    const regionLabel = currentFeatures[highestRegion]?.regionLabel || highestRegion;

    return {
      baselineEstablished: true,
      baselineTimestamp: baseline.timestamp,
      baselineLocationName: baseline.locationName,
      variationCategory,
      averageOpticalShift,
      highestShiftRegion: regionLabel,
      isExperimentalComparison: true,
      comparisonNotes: `Experimental image comparison (${variationCategory.toLowerCase()}) against personal baseline from ${new Date(
        baseline.timestamp
      ).toLocaleDateString()}. Highest optical shift observed in ${regionLabel} (delta: ${maxDelta.toFixed(
        3
      )}).`,
    };
  }

  /**
   * Save a completed research measurement record (Requirement 2 & 14)
   * Does NOT overwrite previous measurements; persists across sessions.
   */
  public saveMeasurement(record: ResearchMeasurementRecord): ResearchMeasurementRecord {
    const existing = this.getMeasurements();
    // Prepend new record
    const updated = [record, ...existing.filter((r) => r.id !== record.id)];
    this.memoryMeasurements = updated;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save research measurement:', e);
      }
    }

    // Auto-establish first valid skin observation as baseline if no baseline exists yet
    // A baseline can exist without calibration, but must be a genuine skin observation (not an unverified image/drawing)
    const currentBaseline = this.getPersonalBaseline();
    if (
      !currentBaseline &&
      record.dataStatus !== 'INCOMPLETE DATA' &&
      record.imageQuality?.faceDetected &&
      record.imageQuality?.qualityCategory === 'Good'
    ) {
      const newBaseline: PersonalBaselineRecord = {
        id: `baseline_${Date.now()}`,
        measurementId: record.id,
        timestamp: record.timestamp,
        locationName: record.location?.name || 'Local Site',
        regionalFeatures: record.opticalFeatures,
        environmentalSnapshot: record.environmentalMeasurements,
        imageQuality: record.imageQuality,
      };
      this.setPersonalBaseline(newBaseline);
    }

    return record;
  }

  /**
   * Delete an individual measurement record (Requirement 19 - Privacy)
   */
  public deleteMeasurement(id: string): void {
    const existing = this.getMeasurements();
    const filtered = existing.filter((m) => m.id !== id);
    this.memoryMeasurements = filtered;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(filtered));
      } catch (e) {
        console.warn('Failed to delete measurement:', e);
      }
    }

    // If deleted measurement was baseline, clear baseline
    const baseline = this.getPersonalBaseline();
    if (baseline && baseline.measurementId === id) {
      this.clearPersonalBaseline();
    }
  }

  /**
   * Delete sensitive face image dataUrl while preserving numerical research metrics (Privacy)
   */
  public deleteImageForMeasurement(id: string): void {
    const existing = this.getMeasurements();
    const updated = existing.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          imageDataUrl: null,
        };
      }
      return m;
    });
    this.memoryMeasurements = updated;

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(MEASUREMENTS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to delete image for measurement:', e);
      }
    }
  }

  /**
   * Clear all research measurements and history (Requirement 19 - Privacy)
   */
  public clearAllMeasurements(): void {
    this.memoryMeasurements = [];
    this.memoryBaseline = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(MEASUREMENTS_STORAGE_KEY);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        localStorage.removeItem(BASELINE_STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear research measurements:', e);
      }
    }
  }

  /**
   * Evaluate Data Quality Panel Status (Requirement 18)
   */
  public computeDataQualityPanel(
    imageQuality: ImageQualityMetrics,
    calibration: CalibrationState,
    segmentationConfidence: number,
    envSnapshot: EnvironmentalSnapshot | null,
    timeAlignment: TimeAlignmentInfo,
    measurementCount: number,
    multispectralHardwareConnected = false,
    acquisitionMode?: 'live_camera' | 'gallery_upload',
    permissionDenied = false
  ): DataQualityPanelStatus {
    // Camera Acquisition: Reflect actual camera permission and capture result
    let cameraAcq: 'Acquired' | 'Gallery upload' | 'Permission blocked' | 'Limited' = 'Limited';
    if (permissionDenied) {
      cameraAcq = 'Permission blocked';
    } else if (acquisitionMode === 'gallery_upload') {
      cameraAcq = 'Gallery upload';
    } else if (imageQuality.qualityCategory === 'Good' && imageQuality.isSharp) {
      cameraAcq = 'Acquired';
    } else {
      cameraAcq = 'Limited';
    }

    // Calibration Quality: Show "Calibrated" only when a supported calibration procedure has actually completed and passed
    let calibStatus: 'Calibrated' | 'Calibration incomplete' | 'Not calibrated' = 'Not calibrated';
    if (calibration.isReady && calibration.normalized) {
      calibStatus = 'Calibrated';
    } else if (calibration.darkCaptured || calibration.whiteCaptured || calibration.skinCaptured) {
      calibStatus = 'Calibration incomplete';
    } else {
      calibStatus = 'Not calibrated';
    }

    // Face Segmentation: Show "Verified" when skin locus target detected and adequate confidence
    const faceSegStatus: 'Verified' | 'Unverified' =
      imageQuality.faceDetected && segmentationConfidence >= 35 ? 'Verified' : 'Unverified';

    // Spectral Data: Show "Available" only when genuine spectral measurements exist. Ordinary RGB image is not spectral data.
    const spectralStatus: 'Available' | 'Unavailable' = multispectralHardwareConnected
      ? 'Available'
      : 'Unavailable';

    // Time Alignment: Show "Verified" only when actual timestamps and required alignment checks pass
    let timeAlignmentStatus: 'Verified' | 'Unverified' | 'Unavailable' = 'Unavailable';
    if (timeAlignment.isAligned) {
      timeAlignmentStatus = 'Verified';
    } else if (
      timeAlignment.environmentalTimestamp &&
      timeAlignment.environmentalTimestamp.trim() !== ''
    ) {
      timeAlignmentStatus = 'Unverified';
    } else {
      timeAlignmentStatus = 'Unavailable';
    }

    // Longitudinal Data Sufficiency: Derive from actual number and quality of saved observations and documented criteria
    let longitudinalDataStatus: 'Sufficient' | 'Insufficient' | 'Not yet assessed' = 'Not yet assessed';
    if (measurementCount === 0) {
      longitudinalDataStatus = 'Not yet assessed';
    } else if (measurementCount >= 3 && imageQuality.qualityCategory === 'Good' && imageQuality.faceDetected) {
      longitudinalDataStatus = 'Sufficient';
    } else {
      longitudinalDataStatus = 'Insufficient';
    }

    return {
      cameraAcquisition: cameraAcq,
      calibration: calibStatus,
      faceSegmentation: faceSegStatus,
      spectralData: spectralStatus,
      environmentalData:
        envSnapshot && envSnapshot.measurements.aqi !== null ? 'Available' : 'Unavailable',
      timeAlignment: timeAlignmentStatus,
      longitudinalData: longitudinalDataStatus,
    };
  }

  /**
   * Generate 5-stage AI Research Reasoning (Requirement 16)
   * DATA -> OBSERVATION -> COMPARISON -> ENVIRONMENTAL ASSOCIATION -> LIMITATION
   */
  public generateInterpretation(
    currentFeatures: Record<FaceRegion, RegionalOpticalFeatures>,
    currentEnv: EnvironmentalSnapshot | null,
    baselineComparison: PersonalBaselineComparison,
    timeAlignment: TimeAlignmentInfo,
    measurementIndex: number,
    totalHistoryCount: number
  ): QualifiedResearchInterpretation {
    const disclaimer =
      'AirGuardian optical skin research is an experimental prototype. Ordinary RGB camera images cannot establish calibrated spectral measurements, skin damage, or pollution-caused biological effects. It does not diagnose medical conditions or prove that environmental exposure caused an observed biological change.';

    const locationName = currentEnv?.locationName || 'Monitored Site';
    const aqi = currentEnv?.measurements.aqi;
    const pm25 = currentEnv?.measurements.pm2_5;

    // Check segmentation validity
    const hasInsufficientData = Object.values(currentFeatures).some(
      (f) => f.variationCategory === 'Insufficient data'
    );

    if (hasInsufficientData) {
      return {
        data: 'Data acquisition incomplete: Face segmentation confidence below research quality threshold.',
        observation: 'Face segmentation confidence insufficient to extract regional optical features.',
        comparison: 'Baseline comparison unavailable.',
        environmentalAssociation: 'Environmental association unavailable due to incomplete optical data.',
        limitation:
          'Adequate, uniform illumination and forward-facing facial alignment are required to construct valid regional optical feature vectors.',
        hasSufficientLongitudinalData: false,
        disclaimer,
      };
    }

    // 1. DATA
    const envDataStr =
      aqi !== null && aqi !== undefined
        ? `Ambient Open-Meteo AQI is ${aqi} (PM2.5: ${pm25 ?? 'Unavailable'} µg/m³)`
        : 'Environmental sensor telemetry is currently unavailable';
    const alignStr = timeAlignment.isAligned
      ? `time alignment within ${timeAlignment.differenceMinutes ?? 0}m`
      : `${timeAlignment.alignmentStatus}`;

    const dataText = `Measurement #${measurementIndex} recorded in ${locationName}. ${envDataStr}; ${alignStr}.`;

    // 2. OBSERVATION
    const regions: FaceRegion[] = ['forehead', 'nose', 'left_cheek', 'right_cheek', 'chin'];
    const highestRegion = regions.reduce((max, r) =>
      currentFeatures[r].variationScore > currentFeatures[max].variationScore ? r : max
    );
    const highestFeat = currentFeatures[highestRegion];

    const observationText = `Optical feature distribution computed across 5 research regions. Highest regional variation observed in ${
      highestFeat.regionLabel
    } (${highestFeat.variationCategory.toLowerCase()}, score: ${highestFeat.variationScore.toFixed(3)}).`;

    // 3. COMPARISON
    let comparisonText = '';
    if (baselineComparison.baselineEstablished && baselineComparison.averageOpticalShift !== null) {
      comparisonText = `An optical difference (${baselineComparison.variationCategory.toLowerCase()}, average shift: ${baselineComparison.averageOpticalShift.toFixed(
        3
      )}) was observed between the current measurement and the personal baseline.`;
    } else {
      comparisonText =
        'Personal baseline established from this initial reference measurement. Future acquisitions will compare optical shift against this baseline.';
    }

    // 4. ENVIRONMENTAL ASSOCIATION (Requirement 12)
    let associationText = '';
    const hasLongitudinal = totalHistoryCount >= 2;

    if (!hasLongitudinal) {
      associationText =
        'Environmental association unavailable. More repeated measurements are required to assess temporal alignment between air quality and optical variation.';
    } else if (!timeAlignment.isAligned) {
      associationText =
        'Environmental measurement is not sufficiently time-aligned with the optical capture for statistical pairing.';
    } else if (pm25 !== null && pm25 !== undefined && pm25 > 25) {
      associationText =
        'Optical variation and elevated PM2.5 occurred during overlapping observation periods in this dataset.';
    } else {
      associationText =
        'Optical variation remained consistent with moderate ambient particulate levels during this observation period.';
    }

    // 5. LIMITATION (Requirement 12 & 16: Distinguish CORRELATION from CAUSATION)
    const limitationText =
      'This association does not establish that PM2.5 or other air pollutants caused the optical change. Non-environmental variables including room illumination, skin hydration, and camera sensor temperature influence optical reflectance. Ordinary RGB phone or webcam images cannot establish calibrated spectral measurements, skin damage, or pollution-caused biological effects.';

    return {
      data: dataText,
      observation: observationText,
      comparison: comparisonText,
      environmentalAssociation: associationText,
      limitation: limitationText,
      hasSufficientLongitudinalData: hasLongitudinal && timeAlignment.isAligned,
      disclaimer,
    };
  }

  /**
   * Get summary dashboard statistics for Research Dashboard (Requirement 13)
   */
  public getDashboardSummary() {
    const list = this.getMeasurements();
    const baseline = this.getPersonalBaseline();
    const count = list.length;
    const validCalibCount = list.filter((m) => m.calibration?.isReady && m.calibration?.normalized).length;
    const validEnvCount = list.filter(
      (m) => m.environmentalMeasurements && m.environmentalMeasurements.measurements.aqi !== null
    ).length;
    const alignedTimeCount = list.filter((m) => m.timeAlignment?.isAligned).length;

    // Calibration Quality: Show "Calibrated" only when a supported calibration procedure has actually completed and passed.
    // Otherwise show "Calibration incomplete" or "Not calibrated."
    let calibrationQuality: 'Calibrated' | 'Calibration incomplete' | 'Not calibrated' = 'Not calibrated';
    if (count > 0) {
      if (validCalibCount > 0 && validCalibCount === count) {
        calibrationQuality = 'Calibrated';
      } else if (
        validCalibCount > 0 ||
        list.some((m) => m.calibration?.darkCaptured || m.calibration?.whiteCaptured || m.calibration?.skinCaptured)
      ) {
        calibrationQuality = 'Calibration incomplete';
      } else {
        calibrationQuality = 'Not calibrated';
      }
    }

    // Personal Baseline: Show "Established" only when a baseline session was genuinely captured and saved. Otherwise show "Not established."
    const personalBaselineStatus: 'Established' | 'Not established' = baseline ? 'Established' : 'Not established';

    // Spectral Data: Show "Available" only when genuine spectral measurements exist. Ordinary RGB camera image is not spectral data.
    const spectralDataStatus: 'Available' | 'Unavailable' = list.some(
      (m) => m.cubeBandsCount > 0 && m.dataStatus === 'Calibrated measurement'
    )
      ? 'Available'
      : 'Unavailable';

    // Time Alignment: Show "Verified" only when actual timestamps and required alignment checks pass. Otherwise show "Unverified" or "Unavailable."
    let timeAlignmentSummary: 'Verified' | 'Unverified' | 'Unavailable' = 'Unavailable';
    if (count > 0) {
      if (alignedTimeCount === count && count > 0) {
        timeAlignmentSummary = 'Verified';
      } else if (alignedTimeCount > 0 || list.some((m) => m.timeAlignment?.environmentalTimestamp)) {
        timeAlignmentSummary = 'Unverified';
      } else {
        timeAlignmentSummary = 'Unavailable';
      }
    }

    // Longitudinal Data Sufficiency: Derive this status from the actual number and quality of saved observations and documented criteria.
    // Do not automatically display "Sufficient." If criteria are not defined or not assessed, show "Not yet assessed" instead.
    // Documented criteria: Minimum 3 quality sessions with verified face detection and time-aligned environmental data.
    let longitudinalSufficiency: 'Sufficient' | 'Insufficient' | 'Not yet assessed' = 'Not yet assessed';
    if (count === 0) {
      longitudinalSufficiency = 'Not yet assessed';
    } else {
      const qualitySessions = list.filter(
        (m) =>
          m.imageQuality?.qualityCategory === 'Good' &&
          m.imageQuality?.faceDetected &&
          m.timeAlignment?.isAligned
      ).length;
      if (qualitySessions >= 3) {
        longitudinalSufficiency = 'Sufficient';
      } else {
        longitudinalSufficiency = 'Insufficient';
      }
    }

    // Longitudinal Analysis: Allow comparisons of genuine saved observations across sessions, even when calibration is incomplete,
    // but clearly label the results as experimental image comparisons when appropriate.
    let longitudinalAnalysisLabel = 'More repeated observations required';
    if (count >= 2) {
      if (validCalibCount > 0) {
        longitudinalAnalysisLabel = 'Available (Calibrated)';
      } else {
        longitudinalAnalysisLabel = 'Available (Experimental image comparison)';
      }
    }

    return {
      measurementsCount: count,
      baselineEstablished: !!baseline,
      personalBaselineStatus,
      baselineTimestamp: baseline?.timestamp ?? null,
      calibrationQuality,
      spectralDataStatus,
      timeAlignmentSummary,
      environmentalRecordsCount: count > 0 ? `${validEnvCount}/${count}` : '0/0',
      longitudinalAnalysisAvailable: count >= 2,
      longitudinalAnalysisLabel,
      longitudinalSufficiency,
    };
  }

  // --- BACKWARD COMPATIBILITY HELPERS FOR EXISTING CODE ---

  public getHistory(): LongitudinalRecord[] {
    const measurements = this.getMeasurements();
    return measurements.map((m) => ({
      id: m.id,
      sessionIndex: m.sessionIndex,
      timestamp: m.timestamp,
      environmental: m.environmentalMeasurements || {
        timestamp: new Date(m.timestamp).toISOString(),
        opticalMeasurementTimestamp: m.timestamp,
        locationName: m.location?.name || 'Local Site',
        coordinates: {
          latitude: m.location?.latitude || 0,
          longitude: m.location?.longitude || 0,
        },
        measurements: {
          aqi: null,
          pm2_5: null,
          pm10: null,
          o3: null,
          no2: null,
          so2: null,
          co: null,
          uv_index: null,
        },
        dataSource: 'Unavailable',
      },
      regionalFeatures: m.opticalFeatures,
      overallConfidence: m.imageQuality.faceDetectionConfidence ?? 0,
      isSimulated: m.dataStatus !== 'Calibrated measurement',
      notes: m.notes,
      measurementRecord: m,
    }));
  }

  public clearHistory(): void {
    this.clearAllMeasurements();
  }

  public exportResearchMeasurementsAsCSV(): string {
    const records = this.getMeasurements();
    if (records.length === 0) return '';
    const headers = [
      'MeasurementID',
      'SessionIndex',
      'Date',
      'Time',
      'Location',
      'AcquisitionMode',
      'DataStatus',
      'Calibration',
      'ImageQuality',
      'FaceConfidence',
      'ForeheadVariation',
      'NoseVariation',
      'LeftCheekVariation',
      'RightCheekVariation',
      'ChinVariation',
      'AmbientAQI',
      'AmbientPM2.5',
      'AmbientPM10',
      'TimeDifferenceMinutes',
      'BaselineComparison',
    ];

    const rows = records.map((r) => {
      const d = new Date(r.timestamp);
      return [
        r.id,
        r.sessionIndex,
        `"${d.toLocaleDateString()}"`,
        `"${d.toLocaleTimeString()}"`,
        `"${r.location?.name || 'Local Site'}"`,
        `"${r.acquisitionMode}"`,
        `"${r.dataStatus}"`,
        `"${r.calibration.statusLabel}"`,
        `"${r.imageQuality.qualityCategory}"`,
        r.imageQuality.faceDetectionConfidence ?? 'Unavailable',
        `"${r.opticalFeatures.forehead?.variationCategory || 'Unavailable'}"`,
        `"${r.opticalFeatures.nose?.variationCategory || 'Unavailable'}"`,
        `"${r.opticalFeatures.left_cheek?.variationCategory || 'Unavailable'}"`,
        `"${r.opticalFeatures.right_cheek?.variationCategory || 'Unavailable'}"`,
        `"${r.opticalFeatures.chin?.variationCategory || 'Unavailable'}"`,
        r.environmentalMeasurements?.measurements.aqi ?? 'Unavailable',
        r.environmentalMeasurements?.measurements.pm2_5 ?? 'Unavailable',
        r.environmentalMeasurements?.measurements.pm10 ?? 'Unavailable',
        r.timeAlignment.differenceMinutes ?? 'Unavailable',
        `"${r.baselineComparison.variationCategory}"`,
      ];
    });

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

export const researchAnalysisService = new ResearchAnalysisService();
