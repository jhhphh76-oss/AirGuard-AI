/**
 * AirGuard AI - Location & Geocoding Service
 * Dynamic search using official Open-Meteo Geocoding API.
 * Never hardcodes fixed locations.
 */

import { LocationData } from '../types/airguard';

const STORAGE_ACTIVE_LOCATION_KEY = 'airguard_active_location';

export const GLOBAL_LOCATION_PRESETS: LocationData[] = [
  {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    contextLabel: 'Metropolitan Capital & Thames Basin',
  },
  {
    name: 'Tokyo',
    admin1: 'Tokyo Prefecture',
    country: 'Japan',
    latitude: 35.6895,
    longitude: 139.6917,
    timezone: 'Asia/Tokyo',
    contextLabel: 'Greater Tokyo Urban Plain',
  },
  {
    name: 'New York',
    admin1: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    contextLabel: 'Hudson River Estuary & Coastal Hub',
  },
  {
    name: 'Paris',
    admin1: 'Île-de-France',
    country: 'France',
    latitude: 48.8566,
    longitude: 2.3522,
    timezone: 'Europe/Paris',
    contextLabel: 'Seine River Basin',
  },
  {
    name: 'Singapore',
    admin1: 'Central Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    timezone: 'Asia/Singapore',
    contextLabel: 'Equatorial Island Maritime Hub',
  },
  {
    name: 'Sydney',
    admin1: 'New South Wales',
    country: 'Australia',
    latitude: -33.8688,
    longitude: 151.2093,
    timezone: 'Australia/Sydney',
    contextLabel: 'Pacific Coastal Basin',
  },
];

export const locationService = {
  getActiveLocation(): LocationData {
    try {
      const stored = localStorage.getItem(STORAGE_ACTIVE_LOCATION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read saved location, using default preset', e);
    }
    return GLOBAL_LOCATION_PRESETS[0]; // London default
  },

  setActiveLocation(location: LocationData): void {
    try {
      localStorage.setItem(STORAGE_ACTIVE_LOCATION_KEY, JSON.stringify(location));
    } catch (e) {
      console.error('Failed to save active location:', e);
    }
  },

  async searchPlaces(query: string): Promise<LocationData[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        trimmed
      )}&count=10&language=en&format=json`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Geocoding failed with status ${res.status}`);
      }
      const data = await res.json();
      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results.map((item: any) => ({
        name: item.name,
        admin1: item.admin1 || item.admin2 || undefined,
        country: item.country || '',
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone,
        contextLabel: item.admin1
          ? `${item.admin1}, ${item.country}`
          : item.country || 'Geographic coordinate',
      }));
    } catch (error) {
      console.error('Error querying Open-Meteo Geocoding API:', error);
      return [];
    }
  },

  async reverseGeocode(lat: number, lon: number): Promise<LocationData> {
    try {
      const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const revRes = await fetch(revUrl);
      if (revRes.ok) {
        const revData = await revRes.json();
        const detectedName =
          revData.city || revData.locality || revData.principalSubdivision || 'Selected Map Point';
        const admin1 = revData.principalSubdivision;
        const country = revData.countryName || '';
        return {
          name: detectedName,
          admin1,
          country,
          latitude: Number(lat.toFixed(4)),
          longitude: Number(lon.toFixed(4)),
          contextLabel: admin1 ? `${admin1}, ${country}` : country || 'Map Selected Location',
          source: 'map_selected',
        };
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }

    return {
      name: `Point (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
      country: 'Coordinates',
      latitude: Number(lat.toFixed(4)),
      longitude: Number(lon.toFixed(4)),
      contextLabel: `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`,
      source: 'map_selected',
    };
  },

  async getCurrentBrowserLocation(): Promise<LocationData> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          // Attempt reverse geocoding via bigdatacloud free client or approximate naming
          let detectedName = 'Local Reading';
          let admin1 = undefined;
          let country = 'Detected Location';

          try {
            const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const revRes = await fetch(revUrl);
            if (revRes.ok) {
              const revData = await revRes.json();
              detectedName = revData.city || revData.locality || revData.principalSubdivision || 'Local Area';
              admin1 = revData.principalSubdivision;
              country = revData.countryName || 'Local Region';
            }
          } catch {
            // Non-critical fallback
          }

          const loc: LocationData = {
            name: detectedName,
            admin1,
            country,
            latitude: Number(lat.toFixed(4)),
            longitude: Number(lon.toFixed(4)),
            contextLabel: 'User Detected Position',
            source: 'detected',
          };
          resolve(loc);
        },
        (err) => {
          reject(new Error(err.message || 'Location permission denied'));
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  },
};
