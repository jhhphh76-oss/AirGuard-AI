/**
 * AirGuard AI - Real Healthcare Facilities Service
 * Connects to real OpenStreetMap / Nominatim provider registry data
 * around the exact coordinates selected by the user.
 * 
 * NO fabricated records, NO fake 555 phone numbers.
 */

import { HealthcarePoint } from '../types/airguard';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
const CACHE_PREFIX = 'airguard_healthcare_';

// In-memory cache for fast tab navigation
const memoryCache = new Map<string, { facilities: HealthcarePoint[]; cachedAt: number }>();

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export const healthcareService = {
  async getNearbyHealthcare(
    lat: number,
    lon: number,
    initialRadiusKm = 10,
    forceRefresh = false
  ): Promise<HealthcarePoint[]> {
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const now = Date.now();

    // 1. Check in-memory cache
    const mem = memoryCache.get(cacheKey);
    if (mem && !forceRefresh && now - mem.cachedAt < CACHE_TTL_MS) {
      return mem.facilities;
    }

    // 2. Check localStorage cache
    if (!forceRefresh) {
      try {
        const stored = localStorage.getItem(CACHE_PREFIX + cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && now - parsed.cachedAt < CACHE_TTL_MS) {
            memoryCache.set(cacheKey, parsed);
            return parsed.facilities;
          }
        }
      } catch (e) {
        console.warn('Healthcare cache read error:', e);
      }
    }

    // 3. Fetch from server endpoint first, fallback to direct Nominatim query
    let facilities: HealthcarePoint[] = [];
    try {
      facilities = await this.fetchFromServer(lat, lon, initialRadiusKm);
    } catch {
      // Fallback directly to OSM Nominatim
      try {
        facilities = await this.fetchFromOSM(lat, lon, initialRadiusKm);
      } catch (osmErr) {
        console.warn('OSM healthcare fetch error:', osmErr);
        facilities = [];
      }
    }

    // If fewer than 2 results found at initial radius, attempt expanded radius (up to 25km)
    if (facilities.length < 2 && initialRadiusKm < 25) {
      try {
        const expanded = await this.fetchFromOSM(lat, lon, 25);
        if (expanded.length > facilities.length) {
          facilities = expanded;
        }
      } catch {
        // Keep initial results if expansion fails
      }
    }

    // Sort by calculated distance ascending
    facilities.sort((a, b) => a.distanceKm - b.distanceKm);

    // Save to cache
    const entry = { facilities, cachedAt: now };
    memoryCache.set(cacheKey, entry);
    try {
      localStorage.setItem(CACHE_PREFIX + cacheKey, JSON.stringify(entry));
    } catch {
      // Ignore quota error
    }

    return facilities;
  },

  async fetchFromServer(lat: number, lon: number, radiusKm: number): Promise<HealthcarePoint[]> {
    const res = await fetch(`/api/healthcare?lat=${lat}&lon=${lon}&radius=${radiusKm}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.facilities)) {
      throw new Error('Invalid server healthcare format');
    }
    return data.facilities;
  },

  async fetchFromOSM(lat: number, lon: number, radiusKm: number): Promise<HealthcarePoint[]> {
    // Degree delta approximation: 1 deg lat ~ 111 km, 1 deg lon ~ 111 km * cos(lat)
    const latDelta = radiusKm / 111;
    const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);

    const left = lon - lonDelta;
    const bottom = lat - latDelta;
    const right = lon + lonDelta;
    const top = lat + latDelta;

    const queryUrl = `https://nominatim.openstreetmap.org/search?q=hospital&format=json&viewbox=${left.toFixed(
      4
    )},${top.toFixed(4)},${right.toFixed(4)},${bottom.toFixed(
      4
    )}&bounded=1&limit=25&addressdetails=1&extratags=1`;

    const res = await fetch(queryUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Nominatim query failed: ${res.status}`);
    }

    const items: any[] = await res.json();
    if (!Array.isArray(items)) return [];

    const facilities: HealthcarePoint[] = [];

    for (const item of items) {
      const itemLat = parseFloat(item.lat);
      const itemLon = parseFloat(item.lon);
      if (isNaN(itemLat) || isNaN(itemLon)) continue;

      if (item.class === 'highway' || item.type === 'bus_stop') continue;

      const name = item.name || item.display_name?.split(',')[0]?.trim();
      if (!name || name.length < 2 || name.toLowerCase() === 'hospital') continue;

      const distanceKm = calculateHaversineDistance(lat, lon, itemLat, itemLon);
      const typeLower = (item.type || item.class || '').toLowerCase();
      const nameLower = name.toLowerCase();

      // Classify type
      let facilityType: HealthcarePoint['type'] = 'hospital';
      if (nameLower.includes('urgent') || typeLower.includes('urgent')) {
        facilityType = 'urgent_care';
      } else if (nameLower.includes('pulmon') || nameLower.includes('respirat') || nameLower.includes('chest')) {
        facilityType = 'respiratory_clinic';
      } else if (typeLower.includes('clinic') || nameLower.includes('clinic') || nameLower.includes('dispensary')) {
        facilityType = 'respiratory_clinic';
      } else if (nameLower.includes('health') || nameLower.includes('medical center')) {
        facilityType = 'medical_center';
      }

      // Check emergency availability
      const isEmergency =
        facilityType === 'hospital' ||
        item.extratags?.emergency === 'yes' ||
        nameLower.includes('emergency') ||
        nameLower.includes('trauma');

      // Real phone number if available from OSM extratags
      const realPhone = item.extratags?.phone || item.extratags?.['contact:phone'] || undefined;
      // Real website if available
      const realWebsite = item.extratags?.website || item.extratags?.['contact:website'] || undefined;

      // Clean address string
      const addrObj = item.address || {};
      const road = addrObj.road || addrObj.suburb || addrObj.neighbourhood || '';
      const city = addrObj.city || addrObj.town || addrObj.county || addrObj.state || '';
      const address = [road, city].filter(Boolean).join(', ') || item.display_name;

      facilities.push({
        id: `osm_${item.place_id || item.osm_id}`,
        name,
        type: facilityType,
        distanceKm,
        address,
        latitude: itemLat,
        longitude: itemLon,
        emergencyAvailable: isEmergency,
        contactNumber: realPhone,
        website: realWebsite,
        specialty: isEmergency
          ? 'Emergency Services & Acute Inpatient Care'
          : 'Outpatient Care & Consultation',
      });
    }

    return facilities;
  },
};
