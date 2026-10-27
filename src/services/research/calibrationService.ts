/**
 * AirGuard AI - Optical Calibration Service
 * 
 * Pipeline step: Dark + Reference Calibration -> Reflectance Normalization
 * 
 * Formula:
 * Normalized Reflectance = (Sample - Dark) / (Reference - Dark)
 * 
 * Manages:
 * - Dark reference target
 * - White / diffuse standard reference target
 * - Skin acquisition
 * - Reflectance normalization
 * - Safe numeric handling without division by zero or negative reflectance
 */

import { CalibrationState } from './types';

class CalibrationService {
  private darkValue = 4.0; // 8-bit dark frame bias baseline (0-255)
  private whiteValue = 245.0; // 8-bit diffuse reflectance standard baseline (0-255)
  private darkCaptured = false;
  private whiteCaptured = false;
  private skinCaptured = false;
  private normalized = false;

  public getStatus(): CalibrationState {
    const isReady = this.darkCaptured && this.whiteCaptured;
    return {
      darkCaptured: this.darkCaptured,
      darkValue: this.darkValue,
      whiteCaptured: this.whiteCaptured,
      whiteValue: this.whiteValue,
      skinCaptured: this.skinCaptured,
      normalized: this.normalized,
      isReady,
      statusLabel: isReady && this.skinCaptured && this.normalized ? 'Ready' : 'Incomplete',
      formula: 'Normalized Reflectance = (Sample - Dark) / (Reference - Dark)',
    };
  }

  /**
   * Capture Dark reference frame (lens covered / zero ambient light)
   */
  public captureDarkReference(measuredBias: number = 4.2): CalibrationState {
    this.darkValue = Math.max(0, Math.min(measuredBias, 50));
    this.darkCaptured = true;
    return this.getStatus();
  }

  /**
   * Capture White reference target (diffuse 99% reflectance standard)
   */
  public captureWhiteReference(measuredStandard: number = 244.0): CalibrationState {
    this.whiteValue = Math.max(this.darkValue + 10, Math.min(measuredStandard, 255));
    this.whiteCaptured = true;
    return this.getStatus();
  }

  /**
   * Mark skin image captured
   */
  public markSkinCaptured(captured = true): CalibrationState {
    this.skinCaptured = captured;
    return this.getStatus();
  }

  /**
   * Mark reflectance normalization completed
   */
  public markNormalized(normalized = true): CalibrationState {
    this.normalized = normalized;
    return this.getStatus();
  }

  /**
   * Reset calibration for new optical session
   */
  public resetCalibration(): CalibrationState {
    this.darkCaptured = false;
    this.whiteCaptured = false;
    this.skinCaptured = false;
    this.normalized = false;
    return this.getStatus();
  }

  /**
   * Apply verified standard calibration references
   * Used for standard reference calibration pipeline
   */
  public applyStandardReferences(): CalibrationState {
    this.darkValue = 4.2;
    this.whiteValue = 244.5;
    this.darkCaptured = true;
    this.whiteCaptured = true;
    return this.getStatus();
  }

  /**
   * Execute Reflectance Normalization
   * Normalized Reflectance = (Sample - Dark) / (Reference - Dark)
   * Safely handles edge cases (e.g. division by zero, saturated pixels)
   */
  public normalizeSample(sampleValue: number): number {
    const denom = this.whiteValue - this.darkValue;
    if (denom <= 0) return 0;
    const normalized = (sampleValue - this.darkValue) / denom;
    this.normalized = true;
    return Math.max(0, Math.min(1.0, Math.round(normalized * 1000) / 1000));
  }
}

export const calibrationService = new CalibrationService();
