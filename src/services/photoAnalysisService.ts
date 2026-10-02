/**
 * AirGuard AI - Photo Vision Analysis Client Service
 * Sends captured or uploaded photos directly to the server-side Gemini vision model.
 * Strict health safety and non-diagnostic phrasing enforced.
 */

import { AQIReading } from '../types/airguard';

export interface PhotoAnalysisResult {
  visibleContent: string;
  environmentalObservations: string;
  potentialFactors: string;
  precautions: string[];
}

export const photoAnalysisService = {
  async analyzePhoto(
    imageBase64: string,
    reading: AQIReading,
    userConcern?: string
  ): Promise<PhotoAnalysisResult> {
    const payload = {
      imageBase64,
      context: {
        locationName: reading.location.name,
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
        aqi: reading.aqi,
        category: reading.category,
        dominantPollutant: reading.dominantPollutant,
        pollutants: reading.pollutants,
        userConcern: userConcern || 'Visual reference assessment',
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
        errData.error || "We couldn't analyze this image. Please try another photo."
      );
    }

    const data = await response.json();
    if (!data || !data.result) {
      throw new Error("We couldn't analyze this image. Please try another photo.");
    }

    return data.result as PhotoAnalysisResult;
  },
};
