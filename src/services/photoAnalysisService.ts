/**
 * AirGuard AI - Photo Vision Analysis Client Service
 * Sends captured or uploaded photos directly to the server-side Gemini vision model.
 * Strict health safety and non-diagnostic phrasing enforced.
 */

import { AQIReading } from '../types/airguard';
import { getHealthGuidance, SymptomType } from './healthGuidanceService';

export interface PhotoAnalysisResult {
  photoProvided: boolean;
  visibleContent: string;
  environmentalObservations: string;
  potentialFactors: string;
  precautions: string[];
  selectedConcerns?: string[];
  otherConcernText?: string;
  limitationNotice?: string;
  isNoSymptomMode?: boolean;
  // Big 3 & Face Exposure fields (Requirements 6 & 7)
  whatMayBeIrritating?: string;
  whyThisMatters?: string;
  doList?: string[];
  dontList?: string[];
  whenToGetHelp?: string;
  researchAnalysis?: string;
  isFaceExposureMode?: boolean;
}

export interface ExposureAnalysisParams {
  imageBase64?: string | null;
  symptoms: string[];
  customConcernText?: string;
  reading: AQIReading;
  isFaceExposureMode?: boolean;
}

export const photoAnalysisService = {
  async analyzeExposure({
    imageBase64,
    symptoms,
    customConcernText,
    reading,
    isFaceExposureMode,
  }: ExposureAnalysisParams): Promise<PhotoAnalysisResult> {
    const isNoSymptomMode =
      symptoms.includes('No symptoms / just checking air') ||
      symptoms.includes('No symptoms — check air');
    const isFaceExposure =
      Boolean(isFaceExposureMode) || symptoms.includes('Check general exposure on face');
    const photoProvided = Boolean(imageBase64 && typeof imageBase64 === 'string' && imageBase64.trim().length > 0);

    const payload = {
      imageBase64: photoProvided ? imageBase64 : null,
      context: {
        locationName: reading.location.name,
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
        aqi: reading.aqi,
        category: reading.category,
        dominantPollutant: reading.dominantPollutant,
        pollutants: reading.pollutants,
        symptoms,
        customConcern: customConcernText || '',
        userConcern: symptoms.length > 0 ? symptoms.join(', ') : 'Environmental exposure check',
        photoProvided,
        isNoSymptomMode,
        isFaceExposureMode: isFaceExposure,
      },
    };

    const response = await fetch('/api/gemini/analyze-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.error || "We couldn't analyze the exposure data right now. Please try again."
      );
    }

    const data = await response.json();
    if (!data || !data.result) {
      throw new Error("We couldn't analyze the exposure data right now. Please try again.");
    }

    const result = data.result as PhotoAnalysisResult;
    result.photoProvided = photoProvided;
    result.selectedConcerns = symptoms;
    result.otherConcernText = customConcernText;
    result.isNoSymptomMode = isNoSymptomMode;
    result.isFaceExposureMode = isFaceExposure;
    result.limitationNotice =
      "This analysis uses your reported concerns and available environmental data. It does not diagnose the cause of symptoms.";

    if (!photoProvided) {
      result.visibleContent = 'Photo not provided';
    }

    // Ensure Big 3 fields are always populated even if upstream response missed any
    const localGuidance = getHealthGuidance(symptoms as SymptomType[], reading, customConcernText);
    if (!result.whyThisMatters) {
      result.whyThisMatters = localGuidance.whyThisMatters;
    }
    if (!result.doList || result.doList.length === 0) {
      result.doList = localGuidance.doList;
    }
    if (!result.dontList || result.dontList.length === 0) {
      result.dontList = localGuidance.dontList;
    }
    if (!result.whenToGetHelp) {
      result.whenToGetHelp = localGuidance.whenToGetHelp;
    }
    if (!result.whatMayBeIrritating) {
      result.whatMayBeIrritating = photoProvided
        ? (result.visibleContent || 'Optical observations from submitted image indicate surface appearance under ambient lighting.')
        : `Elevated ${reading.dominantPollutant} or ambient particulate concentrations under current AQI ${reading.aqi} (${reading.category}) conditions.`;
    }

    return result;
  },

  async analyzePhoto(
    imageBase64: string,
    reading: AQIReading,
    userConcern?: string
  ): Promise<PhotoAnalysisResult> {
    return this.analyzeExposure({
      imageBase64,
      symptoms: userConcern ? [userConcern] : [],
      reading,
    });
  },
};
