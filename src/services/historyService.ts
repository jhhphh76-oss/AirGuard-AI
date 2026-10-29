/**
 * AirGuard AI - Persistent History Service
 * Stores actual collected readings locally so closing/reopening the app retains valid history.
 * Supports date-based calendar querying, duplicate protection on rapid refreshes,
 * and memory fallbacks for testing and SSR environments.
 */

import { AQIReading, HistoryRecord } from '../types/airguard';

const STORAGE_KEY = 'airguard_history_records';
const MAX_HISTORY_ITEMS = 300;

// In-memory fallback for test environments or SSR where localStorage is undefined
let memoryHistory: HistoryRecord[] = [];

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * Returns a standardized local date string formatted as 'YYYY-MM-DD'.
 */
export function getLocalDateKey(dateOrTimestamp: Date | number): string {
  const d = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const historyService = {
  getHistory(): HistoryRecord[] {
    try {
      if (isLocalStorageAvailable()) {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
          const parsed: HistoryRecord[] = JSON.parse(data);
          if (Array.isArray(parsed)) {
            memoryHistory = parsed;
            return parsed.sort((a, b) => b.retrievalTimestamp - a.retrievalTimestamp);
          }
        }
      }
      return [...memoryHistory].sort((a, b) => b.retrievalTimestamp - a.retrievalTimestamp);
    } catch (e) {
      console.error('Failed to load AirGuard history:', e);
      return [...memoryHistory].sort((a, b) => b.retrievalTimestamp - a.retrievalTimestamp);
    }
  },

  /**
   * Retrieves all saved records matching a local date key 'YYYY-MM-DD'.
   */
  getRecordsByDateKey(dateKey: string): HistoryRecord[] {
    const all = this.getHistory();
    return all
      .filter((r) => getLocalDateKey(r.retrievalTimestamp) === dateKey)
      .sort((a, b) => a.retrievalTimestamp - b.retrievalTimestamp);
  },

  /**
   * Retrieves a dictionary mapping 'YYYY-MM-DD' to HistoryRecord[] for a specific year & month (0-indexed).
   */
  getRecordsForMonth(year: number, monthIndex: number): Record<string, HistoryRecord[]> {
    const all = this.getHistory();
    const result: Record<string, HistoryRecord[]> = {};

    for (const rec of all) {
      const d = new Date(rec.retrievalTimestamp);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const key = getLocalDateKey(d);
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(rec);
      }
    }

    // Sort observations chronologically within each day
    for (const key of Object.keys(result)) {
      result[key].sort((a, b) => a.retrievalTimestamp - b.retrievalTimestamp);
    }

    return result;
  },

  addRecord(reading: AQIReading): HistoryRecord | null {
    try {
      // Do not store invalid or error readings
      if (reading.isStale && reading.lastAttemptFailed) {
        return null;
      }

      // Do not store missing, NaN, or non-numeric AQI
      if (reading.aqi === null || reading.aqi === undefined || isNaN(reading.aqi)) {
        return null;
      }

      const existing = this.getHistory();

      // Prevent duplicate saves on rapid refreshes (within 2 minutes) if location and readings are identical
      const recentDuplicate = existing.find((r) => {
        const sameLocation =
          r.location.name === reading.location.name &&
          Math.abs(r.location.latitude - reading.location.latitude) < 0.001 &&
          Math.abs(r.location.longitude - reading.location.longitude) < 0.001;

        if (!sameLocation) return false;

        // Exact timestamp match
        if (r.retrievalTimestamp === reading.retrievalTimestamp) return true;

        // Rapid refresh within 2 minutes with unchanged AQI and PM2.5
        const timeDiff = Math.abs(r.retrievalTimestamp - reading.retrievalTimestamp);
        const rapidRefresh = timeDiff < 2 * 60 * 1000;
        const identicalValues =
          r.aqi === reading.aqi &&
          r.pollutants.pm2_5 === reading.pollutants.pm2_5;

        return rapidRefresh && identicalValues;
      });

      if (recentDuplicate) {
        return recentDuplicate;
      }

      const recordDate = new Date(reading.retrievalTimestamp);
      const newRecord: HistoryRecord = {
        id: `rec_${reading.retrievalTimestamp}_${Math.random().toString(36).substring(2, 7)}`,
        date: recordDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        time: recordDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        retrievalTimestamp: reading.retrievalTimestamp,
        location: reading.location,
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
        aqi: reading.aqi,
        category: reading.category,
        pollutants: reading.pollutants,
        indicators: reading.indicators,
        source: reading.source,
      };

      const updated = [newRecord, ...existing].slice(0, MAX_HISTORY_ITEMS);
      memoryHistory = updated;

      if (isLocalStorageAvailable()) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (storageErr) {
          console.warn('LocalStorage save failed:', storageErr);
        }
      }

      return newRecord;
    } catch (e) {
      console.error('Failed to save history record:', e);
      return null;
    }
  },

  addPhotoAnalysisRecord({
    reading,
    imageDataUrl,
    analysis,
  }: {
    reading: AQIReading;
    imageDataUrl?: string | null;
    analysis: any;
  }): HistoryRecord | null {
    try {
      const existing = this.getHistory();
      const timestamp = Date.now();
      const recordDate = new Date(timestamp);

      const newRecord: HistoryRecord = {
        id: `photo_analysis_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
        date: recordDate.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        time: recordDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        retrievalTimestamp: timestamp,
        location: reading.location,
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
        aqi: reading.aqi,
        category: reading.category,
        pollutants: reading.pollutants,
        indicators: reading.indicators,
        source: 'AirGuard Photo Exposure Analysis',
        recordType: 'photo_analysis',
        imageDataUrl: imageDataUrl || null,
        photoAnalysis: {
          whatMayBeIrritating: analysis?.whatMayBeIrritating || analysis?.visibleContent,
          whyThisMatters: analysis?.whyThisMatters || analysis?.environmentalObservations,
          doList: analysis?.doList || analysis?.precautions?.slice(0, 2),
          dontList: analysis?.dontList,
          whenToGetHelp: analysis?.whenToGetHelp,
          researchAnalysis: analysis?.researchAnalysis,
          symptoms: analysis?.selectedConcerns,
          precautions: analysis?.precautions,
          potentialFactors: analysis?.potentialFactors,
          visibleContent: analysis?.visibleContent,
        },
      };

      const updated = [newRecord, ...existing].slice(0, MAX_HISTORY_ITEMS);
      memoryHistory = updated;

      if (isLocalStorageAvailable()) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (storageErr) {
          console.warn('LocalStorage save failed:', storageErr);
        }
      }

      return newRecord;
    } catch (e) {
      console.error('Failed to save photo analysis to history:', e);
      return null;
    }
  },

  deleteRecord(id: string): void {
    try {
      const existing = this.getHistory();
      const filtered = existing.filter((r) => r.id !== id);
      memoryHistory = filtered;
      if (isLocalStorageAvailable()) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      }
    } catch (e) {
      console.error('Failed to delete history record:', e);
    }
  },

  clearHistory(): void {
    try {
      memoryHistory = [];
      if (isLocalStorageAvailable()) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  },

  exportHistoryAsJSON(): string {
    const records = this.getHistory();
    return JSON.stringify(records, null, 2);
  },

  exportHistoryAsCSV(): string {
    const records = this.getHistory();
    if (records.length === 0) return '';
    const headers = [
      'ID',
      'Date',
      'Time',
      'Location',
      'Latitude',
      'Longitude',
      'US AQI',
      'Category',
      'PM2.5 (ug/m3)',
      'PM10 (ug/m3)',
      'CO (ug/m3)',
      'CO2 (ppm)',
      'NO2 (ug/m3)',
      'O3 (ug/m3)',
      'SO2 (ug/m3)',
      'Source',
    ];

    const rows = records.map((r) => [
      r.id,
      `"${r.date}"`,
      `"${r.time}"`,
      `"${r.location.name}, ${r.location.country}"`,
      r.location.latitude,
      r.location.longitude,
      r.aqi,
      `"${r.category}"`,
      r.pollutants.pm2_5 ?? 'N/A',
      r.pollutants.pm10 ?? 'N/A',
      r.pollutants.co ?? 'N/A',
      r.pollutants.co2 ?? 'N/A',
      r.pollutants.no2 ?? 'N/A',
      r.pollutants.o3 ?? 'N/A',
      r.pollutants.so2 ?? 'N/A',
      `"${r.source}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  },
};
