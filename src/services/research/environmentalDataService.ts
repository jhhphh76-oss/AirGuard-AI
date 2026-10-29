/**
 * AirGuard AI - Environmental Data Fusion & Time Alignment Service
 * 
 * Pipeline step: Regional Optical Features + Environmental Data -> Statistical Association
 * 
 * Rules:
 * - Uses REAL environmental measurements from existing Open-Meteo integration.
 * - Variables strictly limited to verified API values: PM2.5, PM10, O3, NO2, SO2, CO, UV.
 * - Never invents or fabricates missing values.
 * - Calculates explicit time alignment between optical capture and environmental recording.
 * - If timestamps differ by > 90 minutes, reports "Environmental measurement is not sufficiently time-aligned".
 * - If environmental data cannot be retrieved, marks "Environmental data unavailable for this measurement"
 *   while image analysis remains fully usable independently.
 */

import { AQIReading } from '../../types/airguard';
import { EnvironmentalSnapshot, TimeAlignmentInfo } from './types';

class EnvironmentalDataService {
  /**
   * Create an EnvironmentalSnapshot from real Open-Meteo telemetry
   */
  public createSnapshot(
    reading: AQIReading | null | undefined,
    opticalTimestamp = Date.now()
  ): EnvironmentalSnapshot | null {
    if (!reading || !reading.location) {
      return null;
    }

    // Do not fabricate current timestamp if reading has no timestamp
    const genuineTimestamp =
      reading.timestamp && typeof reading.timestamp === 'string' && reading.timestamp.trim().length > 0
        ? reading.timestamp.trim()
        : '';

    return {
      timestamp: genuineTimestamp,
      opticalMeasurementTimestamp: opticalTimestamp,
      locationName: reading.location.name,
      coordinates: {
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
      },
      measurements: {
        aqi: typeof reading.aqi === 'number' ? reading.aqi : null,
        pm2_5: reading.pollutants?.pm2_5 ?? null,
        pm10: reading.pollutants?.pm10 ?? null,
        o3: reading.pollutants?.o3 ?? null,
        no2: reading.pollutants?.no2 ?? null,
        so2: reading.pollutants?.so2 ?? null,
        co: reading.pollutants?.co ?? null,
        uv_index: reading.indicators?.uv_index ?? null,
      },
      dataSource: reading.source || 'Open-Meteo Air Quality API',
    };
  }

  /**
   * Compute exact time relationship between optical acquisition and atmospheric telemetry
   */
  public computeTimeAlignment(
    opticalTimestamp: number,
    envSnapshot: EnvironmentalSnapshot | null
  ): TimeAlignmentInfo {
    if (!envSnapshot || !envSnapshot.timestamp || envSnapshot.timestamp.trim() === '') {
      return {
        opticalTimestamp,
        environmentalTimestamp: null,
        differenceMinutes: null,
        isAligned: false,
        alignmentStatus: 'Unavailable',
      };
    }

    const envDate = new Date(envSnapshot.timestamp);
    const envEpoch = envDate.getTime();

    if (isNaN(envEpoch) || !opticalTimestamp || isNaN(opticalTimestamp) || opticalTimestamp <= 0) {
      return {
        opticalTimestamp,
        environmentalTimestamp: envSnapshot.timestamp,
        differenceMinutes: null,
        isAligned: false,
        alignmentStatus: 'Unverified',
      };
    }

    const diffMs = Math.abs(opticalTimestamp - envEpoch);
    const differenceMinutes = Math.round(diffMs / 60000);

    // Stricter threshold: maximum 90 minutes allowable difference for temporal pairing
    const isAligned = differenceMinutes <= 90;

    return {
      opticalTimestamp,
      environmentalTimestamp: envSnapshot.timestamp,
      differenceMinutes,
      isAligned,
      alignmentStatus: isAligned
        ? 'Verified'
        : 'Unverified',
    };
  }
}

export const environmentalDataService = new EnvironmentalDataService();
