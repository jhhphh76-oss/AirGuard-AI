import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { calibrationService } from '../calibrationService';
import { environmentalDataService } from '../environmentalDataService';
import { researchAnalysisService } from '../researchAnalysisService';
import { imageQualityService } from '../imageQualityService';
import {
  ImageQualityMetrics,
  CalibrationState,
  EnvironmentalSnapshot,
  TimeAlignmentInfo,
  FaceRegion,
  RegionalOpticalFeatures,
  ResearchMeasurementRecord,
} from '../types';

describe('Scientific Integrity Validation Tests', () => {
  beforeEach(() => {
    calibrationService.resetCalibration();
    researchAnalysisService.clearAllMeasurements();
  });

  describe('1. Calibration procedure & status validation', () => {
    it('initial state should be "Not calibrated" with isReady false', () => {
      const status = calibrationService.getStatus();
      assert.strictEqual(status.isReady, false);
      assert.strictEqual(status.statusLabel, 'Not calibrated');
    });

    it('capturing a skin photo alone must NOT mark calibration as complete', () => {
      calibrationService.markSkinCaptured(true);
      const status = calibrationService.getStatus();
      assert.strictEqual(status.isReady, false);
      assert.strictEqual(status.statusLabel, 'Calibration incomplete');
    });

    it('normalization without dark and white standards should not mark normalized', () => {
      calibrationService.markSkinCaptured(true);
      const normalizedValue = calibrationService.normalizeSample(128);
      const status = calibrationService.getStatus();
      assert.strictEqual(status.normalized, false);
      assert.strictEqual(status.isReady, false);
      assert.strictEqual(status.statusLabel, 'Calibration incomplete');
      assert.ok(normalizedValue >= 0 && normalizedValue <= 1);
    });

    it('only marks "Calibrated" when dark, white, and skin are all captured and normalized', () => {
      calibrationService.captureDarkReference(4.0);
      calibrationService.captureWhiteReference(245.0);
      calibrationService.markSkinCaptured(true);
      calibrationService.normalizeSample(128);

      const status = calibrationService.getStatus();
      assert.strictEqual(status.isReady, true);
      assert.strictEqual(status.normalized, true);
      assert.strictEqual(status.statusLabel, 'Calibrated');
    });
  });

  describe('2. Time alignment validation', () => {
    const opticalTime = 1700000000000; // fixed test timestamp

    it('returns "Unavailable" when environmental snapshot is null', () => {
      const result = environmentalDataService.computeTimeAlignment(opticalTime, null);
      assert.strictEqual(result.isAligned, false);
      assert.strictEqual(result.alignmentStatus, 'Unavailable');
      assert.strictEqual(result.differenceMinutes, null);
    });

    it('returns "Unavailable" when environmental timestamp is empty string', () => {
      const emptyEnv: EnvironmentalSnapshot = {
        timestamp: '',
        opticalMeasurementTimestamp: opticalTime,
        locationName: 'Test Site',
        coordinates: { latitude: 0, longitude: 0 },
        measurements: {
          aqi: 50,
          pm2_5: 12,
          pm10: 20,
          o3: 30,
          no2: 15,
          so2: 5,
          co: 1,
          uv_index: 3,
        },
        dataSource: 'Test Source',
      };
      const result = environmentalDataService.computeTimeAlignment(opticalTime, emptyEnv);
      assert.strictEqual(result.isAligned, false);
      assert.strictEqual(result.alignmentStatus, 'Unavailable');
      assert.strictEqual(result.differenceMinutes, null);
    });

    it('returns "Unverified" when timestamps differ by more than 90 minutes', () => {
      const pastTime = new Date(opticalTime - 120 * 60 * 1000).toISOString();
      const distantEnv: EnvironmentalSnapshot = {
        timestamp: pastTime,
        opticalMeasurementTimestamp: opticalTime,
        locationName: 'Test Site',
        coordinates: { latitude: 0, longitude: 0 },
        measurements: {
          aqi: 50,
          pm2_5: 12,
          pm10: 20,
          o3: 30,
          no2: 15,
          so2: 5,
          co: 1,
          uv_index: 3,
        },
        dataSource: 'Test Source',
      };

      const result = environmentalDataService.computeTimeAlignment(opticalTime, distantEnv);
      assert.strictEqual(result.isAligned, false);
      assert.strictEqual(result.alignmentStatus, 'Unverified');
      assert.strictEqual(result.differenceMinutes, 120);
    });

    it('returns "Verified" when timestamps are within 90 minutes', () => {
      const closeTime = new Date(opticalTime - 25 * 60 * 1000).toISOString();
      const closeEnv: EnvironmentalSnapshot = {
        timestamp: closeTime,
        opticalMeasurementTimestamp: opticalTime,
        locationName: 'Test Site',
        coordinates: { latitude: 0, longitude: 0 },
        measurements: {
          aqi: 50,
          pm2_5: 12,
          pm10: 20,
          o3: 30,
          no2: 15,
          so2: 5,
          co: 1,
          uv_index: 3,
        },
        dataSource: 'Test Source',
      };

      const result = environmentalDataService.computeTimeAlignment(opticalTime, closeEnv);
      assert.strictEqual(result.isAligned, true);
      assert.strictEqual(result.alignmentStatus, 'Verified');
      assert.strictEqual(result.differenceMinutes, 25);
    });

    it('createSnapshot does not fabricate timestamp when reading has no timestamp', () => {
      const snapshot = environmentalDataService.createSnapshot({
        aqi: 45,
        location: { name: 'Test', latitude: 10, longitude: 20 },
      } as any);

      assert.ok(snapshot !== null);
      assert.strictEqual(snapshot.timestamp, '');
    });
  });

  describe('3. Data Quality Panel validation & camera acquisition', () => {
    const mockImageQuality: ImageQualityMetrics = {
      qualityCategory: 'Good',
      imageSuitability: 'Verified',
      brightnessConsistency: 80,
      exposureQuality: 'Balanced',
      meanLuminance: 120,
      blurSharpnessScore: 22.5,
      isSharp: true,
      faceDetected: true,
      resolution: { width: 640, height: 640 },
      issues: [],
    };

    it('reports "Not calibrated" and "Unavailable" spectralData when uncalibrated phone photo is used', () => {
      const calib = calibrationService.getStatus();
      const unalignedTime: TimeAlignmentInfo = {
        opticalTimestamp: Date.now(),
        environmentalTimestamp: null,
        differenceMinutes: null,
        isAligned: false,
        alignmentStatus: 'Unavailable',
      };

      const panel = researchAnalysisService.computeDataQualityPanel(
        mockImageQuality,
        calib,
        80,
        null,
        unalignedTime,
        1,
        false, // multispectral hardware disconnected
        'live_camera',
        false
      );

      assert.strictEqual(panel.calibration, 'Not calibrated');
      assert.strictEqual(panel.spectralData, 'Unavailable');
      assert.strictEqual(panel.environmentalData, 'Unavailable');
      assert.strictEqual(panel.timeAlignment, 'Unavailable');
      assert.strictEqual(panel.cameraAcquisition, 'Acquired');
    });

    it('reflects actual camera acquisition: Gallery upload when image was selected from gallery', () => {
      const calib = calibrationService.getStatus();
      const unalignedTime: TimeAlignmentInfo = {
        opticalTimestamp: Date.now(),
        environmentalTimestamp: null,
        differenceMinutes: null,
        isAligned: false,
        alignmentStatus: 'Unavailable',
      };

      const panel = researchAnalysisService.computeDataQualityPanel(
        mockImageQuality,
        calib,
        80,
        null,
        unalignedTime,
        1,
        false,
        'gallery_upload',
        false
      );

      assert.strictEqual(panel.cameraAcquisition, 'Gallery upload');
    });

    it('reflects actual camera acquisition: Permission blocked when camera access was denied', () => {
      const calib = calibrationService.getStatus();
      const unalignedTime: TimeAlignmentInfo = {
        opticalTimestamp: Date.now(),
        environmentalTimestamp: null,
        differenceMinutes: null,
        isAligned: false,
        alignmentStatus: 'Unavailable',
      };

      const panel = researchAnalysisService.computeDataQualityPanel(
        mockImageQuality,
        calib,
        80,
        null,
        unalignedTime,
        1,
        false,
        'live_camera',
        true // permission blocked
      );

      assert.strictEqual(panel.cameraAcquisition, 'Permission blocked');
    });

    it('reports "Verified" time alignment when alignment checks pass', () => {
      const calib = calibrationService.getStatus();
      const verifiedTime: TimeAlignmentInfo = {
        opticalTimestamp: Date.now(),
        environmentalTimestamp: new Date().toISOString(),
        differenceMinutes: 10,
        isAligned: true,
        alignmentStatus: 'Verified',
      };

      const panel = researchAnalysisService.computeDataQualityPanel(
        mockImageQuality,
        calib,
        80,
        {
          timestamp: new Date().toISOString(),
          opticalMeasurementTimestamp: Date.now(),
          locationName: 'Test Site',
          coordinates: { latitude: 0, longitude: 0 },
          measurements: { aqi: 45, pm2_5: 10, pm10: 15, o3: 20, no2: 5, so2: 2, co: 0.5, uv_index: 2 },
          dataSource: 'Open-Meteo',
        },
        verifiedTime,
        3,
        false
      );

      assert.strictEqual(panel.timeAlignment, 'Verified');
    });
  });

  describe('4. Personal baseline, longitudinal analysis & data sufficiency', () => {
    it('shows "Not established" when no baseline session was saved', () => {
      const summary = researchAnalysisService.getDashboardSummary();
      assert.strictEqual(summary.personalBaselineStatus, 'Not established');
      assert.strictEqual(summary.baselineEstablished, false);
    });

    it('derives Longitudinal Data Sufficiency as "Not yet assessed" when count is 0', () => {
      const summary = researchAnalysisService.getDashboardSummary();
      assert.strictEqual(summary.longitudinalSufficiency, 'Not yet assessed');
    });

    it('preserves personal baseline without calibration', () => {
      const uncalibratedRecord: ResearchMeasurementRecord = {
        id: 'meas_test_1',
        timestamp: Date.now(),
        sessionIndex: 1,
        acquisitionMode: 'live_camera',
        sourceType: 'Optical Assessment',
        location: { name: 'Test City', latitude: 0, longitude: 0, country: 'India' },
        environmentalDataTimestamp: new Date().toISOString(),
        calibration: {
          darkCaptured: false,
          darkValue: 0,
          whiteCaptured: false,
          whiteValue: 255,
          skinCaptured: true,
          normalized: false,
          isReady: false,
          statusLabel: 'Not calibrated',
          formula: '',
        },
        imageQuality: {
          qualityCategory: 'Good',
          imageSuitability: 'Verified',
          brightnessConsistency: 80,
          exposureQuality: 'Balanced',
          meanLuminance: 120,
          blurSharpnessScore: 25,
          isSharp: true,
          faceDetected: true,
          resolution: { width: 640, height: 640 },
          issues: [],
        },
        detectedFacialRegions: {} as any,
        opticalFeatures: {
          forehead: { region: 'forehead', regionLabel: 'Forehead', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          nose: { region: 'nose', regionLabel: 'Nose', meanReflectance: 0.5, variationScore: 0.06, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          left_cheek: { region: 'left_cheek', regionLabel: 'Left Cheek', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          right_cheek: { region: 'right_cheek', regionLabel: 'Right Cheek', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          chin: { region: 'chin', regionLabel: 'Chin', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        },
        environmentalMeasurements: null,
        analysis: {} as any,
        dataStatus: 'Experimental observation',
        timeAlignment: { opticalTimestamp: Date.now(), environmentalTimestamp: null, differenceMinutes: null, isAligned: false, alignmentStatus: 'Unavailable' },
        baselineComparison: { baselineEstablished: false, baselineTimestamp: null, baselineLocationName: null, variationCategory: 'Baseline comparison unavailable', averageOpticalShift: null, highestShiftRegion: null, comparisonNotes: '' },
        dataQuality: {} as any,
        cubeBandsCount: 6,
      };

      researchAnalysisService.saveMeasurement(uncalibratedRecord);

      const summary = researchAnalysisService.getDashboardSummary();
      // Baseline can exist without calibration!
      assert.strictEqual(summary.baselineEstablished, true);
      assert.strictEqual(summary.personalBaselineStatus, 'Established');
      assert.strictEqual(summary.calibrationQuality, 'Calibration incomplete');
    });

    it('does NOT establish baseline from unverified image or drawing (faceDetected false)', () => {
      const drawingRecord: ResearchMeasurementRecord = {
        id: 'meas_drawing_1',
        timestamp: Date.now(),
        sessionIndex: 1,
        acquisitionMode: 'gallery_upload',
        sourceType: 'Optical Assessment',
        location: null,
        environmentalDataTimestamp: null,
        calibration: {
          darkCaptured: false,
          darkValue: 0,
          whiteCaptured: false,
          whiteValue: 255,
          skinCaptured: false,
          normalized: false,
          isReady: false,
          statusLabel: 'Not calibrated',
          formula: '',
        },
        imageQuality: {
          qualityCategory: 'Needs Improvement',
          imageSuitability: 'Image suitability not verified',
          brightnessConsistency: 30,
          exposureQuality: 'Balanced',
          meanLuminance: 100,
          blurSharpnessScore: 10,
          isSharp: false,
          faceDetected: false, // drawing / unrelated photo
          resolution: { width: 500, height: 500 },
          issues: ['Face target could not be reliably detected.'],
        },
        detectedFacialRegions: {} as any,
        opticalFeatures: {} as any,
        environmentalMeasurements: null,
        analysis: {} as any,
        dataStatus: 'Image captured',
        timeAlignment: { opticalTimestamp: Date.now(), environmentalTimestamp: null, differenceMinutes: null, isAligned: false, alignmentStatus: 'Unavailable' },
        baselineComparison: { baselineEstablished: false, baselineTimestamp: null, baselineLocationName: null, variationCategory: 'Baseline comparison unavailable', averageOpticalShift: null, highestShiftRegion: null, comparisonNotes: '' },
        dataQuality: {} as any,
        cubeBandsCount: 6,
      };

      researchAnalysisService.saveMeasurement(drawingRecord);
      const summary = researchAnalysisService.getDashboardSummary();
      assert.strictEqual(summary.baselineEstablished, false);
      assert.strictEqual(summary.personalBaselineStatus, 'Not established');
    });

    it('labels longitudinal analysis as "Available (Experimental image comparison)" when uncalibrated', () => {
      // Save 2 valid records
      const baseRecord = (idx: number): ResearchMeasurementRecord => ({
        id: `meas_${idx}`,
        timestamp: Date.now() + idx * 1000,
        sessionIndex: idx,
        acquisitionMode: 'live_camera',
        sourceType: 'Optical Assessment',
        location: { name: 'Test City', latitude: 0, longitude: 0, country: 'India' },
        environmentalDataTimestamp: new Date().toISOString(),
        calibration: {
          darkCaptured: false,
          darkValue: 0,
          whiteCaptured: false,
          whiteValue: 255,
          skinCaptured: true,
          normalized: false,
          isReady: false,
          statusLabel: 'Not calibrated',
          formula: '',
        },
        imageQuality: {
          qualityCategory: 'Good',
          imageSuitability: 'Verified',
          brightnessConsistency: 80,
          exposureQuality: 'Balanced',
          meanLuminance: 120,
          blurSharpnessScore: 25,
          isSharp: true,
          faceDetected: true,
          resolution: { width: 640, height: 640 },
          issues: [],
        },
        detectedFacialRegions: {} as any,
        opticalFeatures: {
          forehead: { region: 'forehead', regionLabel: 'Forehead', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          nose: { region: 'nose', regionLabel: 'Nose', meanReflectance: 0.5, variationScore: 0.06, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          left_cheek: { region: 'left_cheek', regionLabel: 'Left Cheek', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          right_cheek: { region: 'right_cheek', regionLabel: 'Right Cheek', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          chin: { region: 'chin', regionLabel: 'Chin', meanReflectance: 0.5, variationScore: 0.05, variationCategory: 'Low variation', relativeSpectralDifferences: { redGreenRatio: 1.1, blueIndex: 0.9, contrastUniformity: 0.8 }, wavelengthReflectances: [], confidence: 80, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        },
        environmentalMeasurements: {
          timestamp: new Date().toISOString(),
          opticalMeasurementTimestamp: Date.now(),
          locationName: 'Test City',
          coordinates: { latitude: 0, longitude: 0 },
          measurements: { aqi: 50, pm2_5: 12, pm10: 20, o3: 30, no2: 15, so2: 5, co: 1, uv_index: 3 },
          dataSource: 'Open-Meteo',
        },
        analysis: {} as any,
        dataStatus: 'Experimental observation',
        timeAlignment: { opticalTimestamp: Date.now(), environmentalTimestamp: new Date().toISOString(), differenceMinutes: 5, isAligned: true, alignmentStatus: 'Verified' },
        baselineComparison: { baselineEstablished: true, baselineTimestamp: Date.now(), baselineLocationName: 'Test City', variationCategory: 'Minimal variation', averageOpticalShift: 0.01, highestShiftRegion: 'Nose', comparisonNotes: '', isExperimentalComparison: true },
        dataQuality: {} as any,
        cubeBandsCount: 6,
      });

      researchAnalysisService.saveMeasurement(baseRecord(1));
      researchAnalysisService.saveMeasurement(baseRecord(2));

      const summary = researchAnalysisService.getDashboardSummary();
      assert.strictEqual(summary.longitudinalAnalysisAvailable, true);
      assert.strictEqual(summary.longitudinalAnalysisLabel, 'Available (Experimental image comparison)');
    });
  });
});
