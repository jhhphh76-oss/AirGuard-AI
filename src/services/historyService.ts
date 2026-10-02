/**
 * AirGuard AI - Persistent History Service
 * Stores actual collected readings locally so closing/reopening the app retains valid history.
 */

import { AQIReading, HistoryRecord } from '../types/airguard';

const STORAGE_KEY = 'airguard_history_records';
const MAX_HISTORY_ITEMS = 150;

export const historyService = {
  getHistory(): HistoryRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      const parsed: HistoryRecord[] = JSON.parse(data);
      return Array.isArray(parsed)
        ? parsed.sort((a, b) => b.retrievalTimestamp - a.retrievalTimestamp)
        : [];
    } catch (e) {
      console.error('Failed to load AirGuard history:', e);
      return [];
    }
  },

  addRecord(reading: AQIReading): HistoryRecord | null {
    try {
      // Do not store invalid or error readings
      if (reading.isStale && reading.lastAttemptFailed) {
        return null;
      }

      const existing = this.getHistory();
      
      // Avoid duplicate records within 15 minutes for the exact same location
      const recentDuplicate = existing.find(
        (r) =>
          r.location.name === reading.location.name &&
          Math.abs(r.retrievalTimestamp - reading.retrievalTimestamp) < 15 * 60 * 1000
      );
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return newRecord;
    } catch (e) {
      console.error('Failed to save history record:', e);
      return null;
    }
  },

  deleteRecord(id: string): void {
    try {
      const existing = this.getHistory();
      const filtered = existing.filter((r) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete history record:', e);
    }
  },

  clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
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
