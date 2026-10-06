/**
 * AirGuard AI - Centralized Air Quality Data Service
 * 
 * Consumed by: Home, Map, Health, AI Forecast, History
 * 1. Requests official Open-Meteo Air Quality endpoint with dynamic coordinates
 * 2. Strict 60-minute shared cache policy
 * 3. Normalizes official US AQI and pollutant fields
 * 4. Handles API failures cleanly without fallback to demo or fake data
 * 6. Automatically commits valid readings to persistent History
 */

import {
  AQICategory,
  AQIReading,
  HourlyForecastPoint,
  LocationData,
  Pollutants,
  EnvironmentalIndicators,
} from '../types/airguard';
import { historyService } from './historyService';

const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes refresh policy
const CACHE_STORAGE_PREFIX = 'airguard_cache_';

interface CacheEntry {
  reading: AQIReading;
  forecast: HourlyForecastPoint[];
  cachedAt: number; // epoch ms
}

// In-memory cache for ultra-fast tab switching and re-render de-duplication
const memoryCache = new Map<string, CacheEntry>();

export function getAQICategory(aqi: number): {
  category: AQICategory;
  color: string;
  bg: string;
  border: string;
  description: string;
} {
  if (aqi <= 50) {
    return {
      category: 'Good',
      color: '#22C55E', // Leaf Green
      bg: 'rgba(34, 197, 94, 0.12)',
      border: 'rgba(34, 197, 94, 0.3)',
      description: 'Air quality is satisfactory and poses little or no health risk.',
    };
  }
  if (aqi <= 100) {
    return {
      category: 'Moderate',
      color: '#06B6D4', // Clean Cyan / Teal-amber
      bg: 'rgba(6, 182, 212, 0.12)',
      border: 'rgba(6, 182, 212, 0.3)',
      description: 'Air quality is acceptable. Very sensitive individuals may consider reducing prolonged outdoor exertion.',
    };
  }
  if (aqi <= 150) {
    return {
      category: 'Unhealthy for Sensitive Groups',
      color: '#F59E0B', // Warning Amber
      bg: 'rgba(245, 158, 11, 0.12)',
      border: 'rgba(245, 158, 11, 0.3)',
      description: 'Members of sensitive groups may experience health effects. General public is less likely to be affected.',
    };
  }
  if (aqi <= 200) {
    return {
      category: 'Unhealthy',
      color: '#EF4444', // Danger Red
      bg: 'rgba(239, 68, 68, 0.14)',
      border: 'rgba(239, 68, 68, 0.35)',
      description: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
    };
  }
  if (aqi <= 300) {
    return {
      category: 'Very Unhealthy',
      color: '#A855F7', // Deep Purple
      bg: 'rgba(168, 85, 247, 0.14)',
      border: 'rgba(168, 85, 247, 0.35)',
      description: 'Health alert: Risk of health effects is increased for the entire population.',
    };
  }
  return {
    category: 'Hazardous',
    color: '#881337', // Maroon Hazard
    bg: 'rgba(136, 19, 55, 0.2)',
    border: 'rgba(136, 19, 55, 0.4)',
    description: 'Health warning of emergency conditions: Everyone is significantly more likely to be affected.',
  };
}

export function determineDominantPollutant(pollutants: Pollutants): string {
  // Determine primary driving pollutant based on typical standard thresholds
  const candidates: { name: string; score: number }[] = [];
  if (pollutants.pm2_5 !== null) candidates.push({ name: 'PM2.5', score: pollutants.pm2_5 / 35 });
  if (pollutants.pm10 !== null) candidates.push({ name: 'PM10', score: pollutants.pm10 / 50 });
  if (pollutants.o3 !== null) candidates.push({ name: 'O₃', score: pollutants.o3 / 100 });
  if (pollutants.no2 !== null) candidates.push({ name: 'NO₂', score: pollutants.no2 / 40 });
  if (pollutants.so2 !== null) candidates.push({ name: 'SO₂', score: pollutants.so2 / 20 });
  if (pollutants.co !== null) candidates.push({ name: 'CO', score: pollutants.co / 4000 });

  if (candidates.length === 0) return 'PM2.5';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].name;
}

function getCacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)}_${lon.toFixed(3)}`;
}

export const airQualityService = {
  /**
   * Primary data fetcher respecting the 60-minute cache policy.
   * If forceRefresh is false, reuses any valid reading under 60 minutes old.
   */
  async getAirQuality(
    location: LocationData,
    forceRefresh = false
  ): Promise<{ reading: AQIReading; forecast: HourlyForecastPoint[]; fromCache: boolean }> {
    const lat = location.latitude;
    const lon = location.longitude;
    const cacheKey = getCacheKey(lat, lon);
    const now = Date.now();

    // 1. Check in-memory cache
    const memEntry = memoryCache.get(cacheKey);
    if (memEntry && !forceRefresh && now - memEntry.cachedAt < CACHE_TTL_MS) {
      return {
        reading: { ...memEntry.reading, location },
        forecast: memEntry.forecast,
        fromCache: true,
      };
    }

    // 2. Check localStorage cache
    if (!forceRefresh) {
      try {
        const stored = localStorage.getItem(CACHE_STORAGE_PREFIX + cacheKey);
        if (stored) {
          const parsed: CacheEntry = JSON.parse(stored);
          if (parsed && now - parsed.cachedAt < CACHE_TTL_MS) {
            memoryCache.set(cacheKey, parsed);
            return {
              reading: { ...parsed.reading, location },
              forecast: parsed.forecast,
              fromCache: true,
            };
          }
        }
      } catch (err) {
        console.warn('Cache read error:', err);
      }
    }

    // 3. Make real Open-Meteo API Request
    try {
      // Required variables list as specified in AirGuard Phase 1 architecture
      const hourlyVars = [
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'aerosol_optical_depth',
        'dust',
        'uv_index',
        'uv_index_clear_sky',
        'us_aqi',
        'carbon_dioxide',
        'methane',
      ].join(',');

      const currentVars = [
        'us_aqi',
        'pm10',
        'pm2_5',
        'carbon_monoxide',
        'nitrogen_dioxide',
        'sulphur_dioxide',
        'ozone',
        'dust',
        'uv_index',
      ].join(',');

      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=${hourlyVars}&current=${currentVars}&timezone=auto&forecast_days=5`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo responded with HTTP status ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.hourly || !data.hourly.time) {
        throw new Error('Open-Meteo response missing hourly air quality data');
      }

      // Determine current index from hourly or current block
      const hourly = data.hourly;
      const current = data.current || {};

      // Match closest hourly index if needed
      const times: string[] = hourly.time;
      let currentIndex = 0;
      if (current.time) {
        const matchIdx = times.indexOf(current.time);
        if (matchIdx !== -1) currentIndex = matchIdx;
      }

      // Extract official US AQI
      const rawAqi = current.us_aqi ?? hourly.us_aqi?.[currentIndex] ?? 0;
      const aqiValue = Math.round(Number(rawAqi));

      const catInfo = getAQICategory(aqiValue);

      // Pollutants: PM10, PM2.5, CO2, CO, NO2, O3, SO2
      const pollutants: Pollutants = {
        pm10: current.pm10 !== undefined ? roundOneDec(current.pm10) : roundOneDec(hourly.pm10?.[currentIndex]),
        pm2_5: current.pm2_5 !== undefined ? roundOneDec(current.pm2_5) : roundOneDec(hourly.pm2_5?.[currentIndex]),
        co2: hourly.carbon_dioxide?.[currentIndex] !== undefined ? Math.round(hourly.carbon_dioxide[currentIndex]) : null,
        co: current.carbon_monoxide !== undefined ? roundOneDec(current.carbon_monoxide) : roundOneDec(hourly.carbon_monoxide?.[currentIndex]),
        no2: current.nitrogen_dioxide !== undefined ? roundOneDec(current.nitrogen_dioxide) : roundOneDec(hourly.nitrogen_dioxide?.[currentIndex]),
        o3: current.ozone !== undefined ? roundOneDec(current.ozone) : roundOneDec(hourly.ozone?.[currentIndex]),
        so2: current.sulphur_dioxide !== undefined ? roundOneDec(current.sulphur_dioxide) : roundOneDec(hourly.sulphur_dioxide?.[currentIndex]),
      };

      // Environmental Indicators - strictly separated from pollutants
      const indicators: EnvironmentalIndicators = {
        aod: hourly.aerosol_optical_depth?.[currentIndex] !== undefined ? roundTwoDec(hourly.aerosol_optical_depth[currentIndex]) : null,
        dust: current.dust !== undefined ? roundOneDec(current.dust) : roundOneDec(hourly.dust?.[currentIndex]),
        uv_index: current.uv_index !== undefined ? roundOneDec(current.uv_index) : roundOneDec(hourly.uv_index?.[currentIndex]),
        uv_index_clear_sky: hourly.uv_index_clear_sky?.[currentIndex] !== undefined ? roundOneDec(hourly.uv_index_clear_sky[currentIndex]) : null,
        ch4: hourly.methane?.[currentIndex] !== undefined ? roundOneDec(hourly.methane[currentIndex]) : null,
      };

      const dominantPollutant = determineDominantPollutant(pollutants);

      const reading: AQIReading = {
        aqi: aqiValue,
        scale: 'US AQI',
        category: catInfo.category,
        categoryColor: catInfo.color,
        categoryBg: catInfo.bg,
        categoryBorder: catInfo.border,
        categoryDescription: catInfo.description,
        dominantPollutant,
        timestamp: current.time || new Date().toISOString(),
        retrievalTimestamp: now,
        source: 'Open-Meteo Air Quality API',
        pollutants,
        indicators,
        location,
      };

      // Parse Hourly Forecast (up to 7 days / 168 hours)
      const forecast: HourlyForecastPoint[] = [];
      const forecastLen = times.length; // Full returned forecast up to 7 days

      for (let i = 0; i < forecastLen; i++) {
        const pointTime = times[i];
        const dateObj = new Date(pointTime);
        const pointAqi = Math.round(Number(hourly.us_aqi?.[i] ?? 0));
        const pointCat = getAQICategory(pointAqi);

        forecast.push({
          time: pointTime,
          formattedHour: dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
          formattedDay: dateObj.toLocaleDateString(undefined, { weekday: 'short' }),
          aqi: pointAqi,
          category: pointCat.category,
          pm2_5: roundOneDec(hourly.pm2_5?.[i]),
          pm10: roundOneDec(hourly.pm10?.[i]),
          no2: roundOneDec(hourly.nitrogen_dioxide?.[i]),
          o3: roundOneDec(hourly.ozone?.[i]),
          uv_index: roundOneDec(hourly.uv_index?.[i]),
          co: roundOneDec(hourly.carbon_monoxide?.[i]),
          so2: roundOneDec(hourly.sulphur_dioxide?.[i]),
        });
      }

      // Store in memory & localStorage caches
      const newEntry: CacheEntry = {
        reading,
        forecast,
        cachedAt: now,
      };
      memoryCache.set(cacheKey, newEntry);
      try {
        localStorage.setItem(CACHE_STORAGE_PREFIX + cacheKey, JSON.stringify(newEntry));
      } catch (err) {
        console.warn('LocalStorage write failed:', err);
      }

      // Automatically commit valid reading to persistent History
      historyService.addRecord(reading);

      return {
        reading,
        forecast,
        fromCache: false,
      };
    } catch (apiError: any) {
      console.error('AirGuard API Request Failed:', apiError);

      // Requirement 20: If Open-Meteo fails:
      // NEVER show fake data.
      // If a previous valid reading exists:
      // - show the last valid reading
      // - show its actual timestamp
      // - clearly indicate that the latest refresh failed
      // If no previous reading exists:
      // Show a proper unavailable-data state.

      // If explicit manual refresh was requested, throw so the refresh handler detects the failure
      if (forceRefresh) {
        throw new Error(
          apiError?.message || 'Open-Meteo Air Quality request failed. Fresh data could not be retrieved.'
        );
      }

      const lastKnown = memoryCache.get(cacheKey) || getStoredCache(cacheKey);
      if (lastKnown) {
        return {
          reading: {
            ...lastKnown.reading,
            location,
            isStale: true,
            lastAttemptFailed: true,
          },
          forecast: lastKnown.forecast,
          fromCache: true,
        };
      }

      throw apiError; // Throw so caller presents a clean unavailable state
    }
  },

  /**
   * Helper to check remaining cache duration in minutes
   */
  getRemainingCacheMinutes(lat: number, lon: number): number {
    const key = getCacheKey(lat, lon);
    const entry = memoryCache.get(key) || getStoredCache(key);
    if (!entry) return 0;
    const elapsed = Date.now() - entry.cachedAt;
    const remaining = Math.max(0, CACHE_TTL_MS - elapsed);
    return Math.floor(remaining / 60000);
  },
};

function getStoredCache(cacheKey: string): CacheEntry | null {
  try {
    const stored = localStorage.getItem(CACHE_STORAGE_PREFIX + cacheKey);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function roundOneDec(val: any): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.round(Number(val) * 10) / 10;
}

function roundTwoDec(val: any): number | null {
  if (val === null || val === undefined || isNaN(val)) return null;
  return Math.round(Number(val) * 100) / 100;
}
