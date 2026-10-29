import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { historyService, getLocalDateKey } from '../historyService';
import { getAQICategory } from '../airQualityService';
import { AQIReading } from '../../types/airguard';

describe('AQI History Calendar & Telemetry Integrity Tests', () => {
  beforeEach(() => {
    historyService.clearHistory();
  });

  describe('1. Calendar Date Math & Leap Year Accuracy', () => {
    test('February in a leap year (2024) must have exactly 29 days', () => {
      const daysInFeb2024 = new Date(2024, 2, 0).getDate();
      assert.strictEqual(daysInFeb2024, 29);
    });

    test('February in a common year (2025) must have exactly 28 days', () => {
      const daysInFeb2025 = new Date(2025, 2, 0).getDate();
      assert.strictEqual(daysInFeb2025, 28);
    });

    test('February in century leap year (2000) must have 29 days', () => {
      const daysInFeb2000 = new Date(2000, 2, 0).getDate();
      assert.strictEqual(daysInFeb2000, 29);
    });

    test('February in non-leap century year (1900) must have 28 days', () => {
      const daysInFeb1900 = new Date(1900, 2, 0).getDate();
      assert.strictEqual(daysInFeb1900, 28);
    });

    test('Calculates all 12 month day counts correctly for 2026', () => {
      const expectedDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      for (let m = 0; m < 12; m++) {
        const days = new Date(2026, m + 1, 0).getDate();
        assert.strictEqual(days, expectedDays[m], `Month ${m + 1} day count mismatch`);
      }
    });

    test('First day of month weekday alignment', () => {
      // Oct 1, 2026 is a Thursday (index 4: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4)
      const oct1Weekday = new Date(2026, 9, 1).getDay();
      assert.strictEqual(oct1Weekday, 4);
    });

    test('getLocalDateKey formats YYYY-MM-DD correctly', () => {
      const d = new Date(2026, 9, 29); // Oct 29, 2026
      const key = getLocalDateKey(d);
      assert.strictEqual(key, '2026-10-29');
    });
  });

  describe('2. AQI Data Integrity & Category Mapping', () => {
    test('AQI 0 is a genuine valid reading and maps to Good', () => {
      const cat = getAQICategory(0);
      assert.strictEqual(cat.category, 'Good');
      assert.strictEqual(cat.color, '#22C55E');
    });

    test('AQI category boundaries map accurately', () => {
      assert.strictEqual(getAQICategory(50).category, 'Good');
      assert.strictEqual(getAQICategory(51).category, 'Moderate');
      assert.strictEqual(getAQICategory(100).category, 'Moderate');
      assert.strictEqual(getAQICategory(101).category, 'Unhealthy for Sensitive Groups');
      assert.strictEqual(getAQICategory(150).category, 'Unhealthy for Sensitive Groups');
      assert.strictEqual(getAQICategory(151).category, 'Unhealthy');
      assert.strictEqual(getAQICategory(200).category, 'Unhealthy');
      assert.strictEqual(getAQICategory(201).category, 'Very Unhealthy');
      assert.strictEqual(getAQICategory(300).category, 'Very Unhealthy');
      assert.strictEqual(getAQICategory(301).category, 'Hazardous');
    });
  });

  describe('3. History Service Persistence & De-duplication', () => {
    const mockLocation = {
      name: 'Vijayapura',
      country: 'India',
      latitude: 16.83,
      longitude: 75.71,
      isDefault: true,
    };

    const createMockReading = (overrides: Partial<AQIReading> = {}): AQIReading => ({
      aqi: 78,
      scale: 'US AQI',
      category: 'Moderate',
      categoryColor: '#06B6D4',
      categoryBg: 'rgba(6, 182, 212, 0.12)',
      categoryBorder: 'rgba(6, 182, 212, 0.3)',
      categoryDescription: 'Air quality is acceptable.',
      dominantPollutant: 'PM2.5',
      timestamp: new Date().toISOString(),
      retrievalTimestamp: Date.now(),
      source: 'Open-Meteo Air Quality API',
      pollutants: {
        pm2_5: 24.5,
        pm10: 45.2,
        co2: 412,
        co: 0.8,
        no2: 12.1,
        o3: 38.0,
        so2: 4.2,
      },
      indicators: {
        aod: 0.35,
        dust: 12.0,
        uv_index: 5.5,
        uv_index_clear_sky: 6.0,
        ch4: 1850,
      },
      location: mockLocation,
      ...overrides,
    });

    test('adds valid reading and persists in history', () => {
      const reading = createMockReading();
      const record = historyService.addRecord(reading);
      assert.ok(record);
      assert.strictEqual(record.aqi, 78);
      assert.strictEqual(record.location.name, 'Vijayapura');

      const all = historyService.getHistory();
      assert.strictEqual(all.length, 1);
      assert.strictEqual(all[0].id, record.id);
    });

    test('prevents duplicate save on rapid refresh with identical values within 2 minutes', () => {
      const now = Date.now();
      const reading1 = createMockReading({ retrievalTimestamp: now });
      const record1 = historyService.addRecord(reading1);

      // Rapid refresh 15 seconds later with identical telemetry
      const reading2 = createMockReading({ retrievalTimestamp: now + 15000 });
      const record2 = historyService.addRecord(reading2);

      assert.strictEqual(record1?.id, record2?.id);
      assert.strictEqual(historyService.getHistory().length, 1);
    });

    test('preserves legitimate subsequent observation with different AQI or after refresh window', () => {
      const now = Date.now();
      const reading1 = createMockReading({ retrievalTimestamp: now, aqi: 78 });
      historyService.addRecord(reading1);

      // Subsequent observation with different AQI
      const reading2 = createMockReading({
        retrievalTimestamp: now + 30000,
        aqi: 95,
        pollutants: { ...reading1.pollutants, pm2_5: 33.1 },
      });
      historyService.addRecord(reading2);

      const all = historyService.getHistory();
      assert.strictEqual(all.length, 2);
    });

    test('rejects stale readings with lastAttemptFailed', () => {
      const failedReading = createMockReading({
        isStale: true,
        lastAttemptFailed: true,
      });
      const record = historyService.addRecord(failedReading);
      assert.strictEqual(record, null);
      assert.strictEqual(historyService.getHistory().length, 0);
    });

    test('rejects readings with missing or NaN AQI', () => {
      const invalidReading = createMockReading({ aqi: NaN as any });
      const record = historyService.addRecord(invalidReading);
      assert.strictEqual(record, null);
      assert.strictEqual(historyService.getHistory().length, 0);
    });

    test('getRecordsByDateKey returns records matching date', () => {
      const date1 = new Date(2026, 9, 28, 10, 0, 0);
      const date2 = new Date(2026, 9, 29, 14, 0, 0);

      historyService.addRecord(createMockReading({ retrievalTimestamp: date1.getTime() }));
      historyService.addRecord(createMockReading({ retrievalTimestamp: date2.getTime(), aqi: 92 }));

      const oct28Records = historyService.getRecordsByDateKey('2026-10-28');
      assert.strictEqual(oct28Records.length, 1);
      assert.strictEqual(oct28Records[0].aqi, 78);

      const oct29Records = historyService.getRecordsByDateKey('2026-10-29');
      assert.strictEqual(oct29Records.length, 1);
      assert.strictEqual(oct29Records[0].aqi, 92);

      const emptyRecords = historyService.getRecordsByDateKey('2026-10-01');
      assert.strictEqual(emptyRecords.length, 0);
    });

    test('getRecordsForMonth groups records for specific year and month', () => {
      const d1 = new Date(2026, 9, 15, 9, 0, 0).getTime();
      const d2 = new Date(2026, 9, 15, 16, 0, 0).getTime();
      const d3 = new Date(2026, 10, 5, 12, 0, 0).getTime(); // November

      historyService.addRecord(createMockReading({ retrievalTimestamp: d1, aqi: 55 }));
      historyService.addRecord(
        createMockReading({
          retrievalTimestamp: d2,
          aqi: 70,
          pollutants: { pm2_5: 21, pm10: 40, co2: null, co: null, no2: null, o3: null, so2: null },
        })
      );
      historyService.addRecord(createMockReading({ retrievalTimestamp: d3, aqi: 110 }));

      // Query October 2026 (month 9)
      const octRecords = historyService.getRecordsForMonth(2026, 9);
      assert.ok(octRecords['2026-10-15']);
      assert.strictEqual(octRecords['2026-10-15'].length, 2);
      assert.strictEqual(octRecords['2026-11-05'], undefined); // Not in October
    });
  });

  describe('4. Daily Summary Rule, 3-Digit Values & Contrast', () => {
    const mockLocation = {
      name: 'Vijayapura',
      country: 'India',
      latitude: 16.83,
      longitude: 75.71,
      isDefault: true,
    };

    const createHistoryRecord = (
      id: string,
      time: string,
      aqi: number,
      pm2_5: number,
      pm10: number
    ) => ({
      id,
      date: 'Oct 29, 2026',
      time,
      retrievalTimestamp: Date.now(),
      location: mockLocation,
      latitude: 16.83,
      longitude: 75.71,
      aqi,
      category: getAQICategory(aqi).category,
      pollutants: {
        pm2_5,
        pm10,
        co2: 410,
        co: 0.5,
        no2: 15.0,
        o3: 40.0,
        so2: 3.5,
      },
      indicators: {
        uv_index: 6.0,
        aod: 0.25,
        dust: 10.0,
        uv_index_clear_sky: 6.5,
        ch4: 1800,
      },
      source: 'Open-Meteo Air Quality API',
    });

    test('computeDailySummary returns exact single observation values when count is 1', async () => {
      const { computeDailySummary } = await import('../../components/History/AQIHistoryCalendar');
      const rec = createHistoryRecord('rec_1', '10:30:00', 65, 18.5, 35.0);
      const summary = computeDailySummary([rec]);

      assert.ok(summary);
      assert.strictEqual(summary.primaryAqi, 65);
      assert.strictEqual(summary.category, 'Moderate');
      assert.strictEqual(summary.isSummary, false);
      assert.strictEqual(summary.validCount, 1);
      assert.strictEqual(summary.summaryTypeLabel, 'Single observation');
      assert.strictEqual(summary.timeLabel, 'at 10:30:00');
      assert.strictEqual(summary.avgPm2_5, 18.5);
    });

    test('computeDailySummary calculates arithmetic mean and range for multiple observations', async () => {
      const { computeDailySummary } = await import('../../components/History/AQIHistoryCalendar');
      const rec1 = createHistoryRecord('rec_1', '08:00:00', 60, 15.0, 30.0);
      const rec2 = createHistoryRecord('rec_2', '12:00:00', 75, 25.0, 45.0);
      const rec3 = createHistoryRecord('rec_3', '18:00:00', 84, 29.0, 51.0);

      const summary = computeDailySummary([rec1, rec2, rec3]);

      assert.ok(summary);
      // Arithmetic mean: (60 + 75 + 84) / 3 = 219 / 3 = 73
      assert.strictEqual(summary.primaryAqi, 73);
      assert.strictEqual(summary.category, 'Moderate');
      assert.strictEqual(summary.isSummary, true);
      assert.strictEqual(summary.validCount, 3);
      assert.strictEqual(summary.summaryTypeLabel, 'Daily Mean (3 observations)');
      assert.strictEqual(summary.timeLabel, '08:00:00 – 18:00:00');
      // Average PM2.5: (15.0 + 25.0 + 29.0) / 3 = 69.0 / 3 = 23.0
      assert.strictEqual(summary.avgPm2_5, 23.0);
      // Average PM10: (30.0 + 45.0 + 51.0) / 3 = 126.0 / 3 = 42.0
      assert.strictEqual(summary.avgPm10, 42.0);
    });

    test('supports 3-digit AQI values without distortion or error', async () => {
      const { computeDailySummary } = await import('../../components/History/AQIHistoryCalendar');
      const rec = createHistoryRecord('rec_high', '14:00:00', 168, 88.0, 150.0);
      const summary = computeDailySummary([rec]);

      assert.ok(summary);
      assert.strictEqual(summary.primaryAqi, 168);
      assert.strictEqual(summary.category, 'Unhealthy');
      assert.strictEqual(summary.color, '#EF4444');
    });

    test('Hazardous AQI category uses high-contrast rose color', async () => {
      const { computeDailySummary } = await import('../../components/History/AQIHistoryCalendar');
      const rec = createHistoryRecord('rec_haz', '16:00:00', 325, 280.0, 420.0);
      const summary = computeDailySummary([rec]);

      assert.ok(summary);
      assert.strictEqual(summary.primaryAqi, 325);
      assert.strictEqual(summary.category, 'Hazardous');
      assert.strictEqual(summary.color, '#FB7185'); // High contrast for dark background
    });

    test('returns null when no valid observations exist', async () => {
      const { computeDailySummary } = await import('../../components/History/AQIHistoryCalendar');
      assert.strictEqual(computeDailySummary([]), null);
    });
  });
});
