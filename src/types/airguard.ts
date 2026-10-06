/**
 * AirGuard AI - Type Definitions
 * Phase 1 & Real Data Architecture
 */

export type PrimaryNavTab = 'home' | 'map' | 'health' | 'forecast' | 'history';

export interface LocationData {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  contextLabel?: string;
  source?: 'detected' | 'searched' | 'map_selected' | 'preset';
}

export type AQICategory = 
  | 'Good' 
  | 'Moderate' 
  | 'Unhealthy for Sensitive Groups' 
  | 'Unhealthy' 
  | 'Very Unhealthy' 
  | 'Hazardous';

export interface Pollutants {
  pm10: number | null;
  pm2_5: number | null;
  co2: number | null;
  co: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
}

export interface EnvironmentalIndicators {
  aod: number | null; // Aerosol Optical Depth
  dust: number | null; // µg/m³
  uv_index: number | null;
  uv_index_clear_sky: number | null;
  ch4: number | null; // Methane µg/m³
}

export interface AQIReading {
  aqi: number;
  scale: 'US AQI';
  category: AQICategory;
  categoryColor: string;
  categoryBg: string;
  categoryBorder: string;
  categoryDescription: string;
  dominantPollutant: string;
  timestamp: string; // ISO string or formatted time string from API
  retrievalTimestamp: number; // epoch ms
  source: string; // "Open-Meteo Air Quality API"
  isStale?: boolean;
  lastAttemptFailed?: boolean;
  pollutants: Pollutants;
  indicators: EnvironmentalIndicators;
  location: LocationData;
}

export interface HourlyForecastPoint {
  time: string; // ISO string
  formattedHour: string; // e.g. "14:00"
  formattedDay: string; // e.g. "Mon"
  aqi: number;
  category: AQICategory;
  pm2_5: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  uv_index: number | null;
  co?: number | null;
  so2?: number | null;
}

export interface HistoryRecord {
  id: string;
  date: string;
  time: string;
  retrievalTimestamp: number;
  location: LocationData;
  latitude: number;
  longitude: number;
  aqi: number;
  category: AQICategory;
  pollutants: Pollutants;
  indicators?: EnvironmentalIndicators;
  source: string;
  // Photo analysis record fields (Requirements 7 & 8)
  recordType?: 'telemetry' | 'photo_analysis';
  imageDataUrl?: string | null;
  photoAnalysis?: {
    whatMayBeIrritating?: string;
    whyThisMatters?: string;
    doList?: string[];
    dontList?: string[];
    whenToGetHelp?: string;
    researchAnalysis?: string;
    symptoms?: string[];
    precautions?: string[];
    potentialFactors?: string;
    visibleContent?: string;
  };
}

export interface SaferLocationPoint {
  id: string;
  name: string;
  type: 'park' | 'nature_reserve' | 'elevated_suburb' | 'coastal_corridor';
  latitude: number;
  longitude: number;
  distanceKm: number;
  estimatedAQI: number;
  aqiDelta: number; // e.g. -24 (cleaner)
  description: string;
}

export interface HealthcarePoint {
  id: string;
  name: string;
  type: 'hospital' | 'respiratory_clinic' | 'urgent_care' | 'medical_center';
  distanceKm: number;
  address: string;
  latitude?: number;
  longitude?: number;
  emergencyAvailable?: boolean;
  contactNumber?: string;
  specialty?: string;
  website?: string;
}

export interface AIAdvisorResponse {
  answer: string;
  source: string;
  warning?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  source?: string;
  isError?: boolean;
}

export interface AQINotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  previousAQI: number;
  currentAQI: number;
  previousCategory: AQICategory;
  currentCategory: AQICategory;
  locationName: string;
  type: 'increase' | 'improve' | 'category';
  read?: boolean;
}

export interface NotificationSettings {
  notificationsEnabled: boolean; // Master Notifications ON / OFF switch
  aqiAlertsEnabled: boolean; // AQI Change Alerts ON / OFF switch
  minDeltaThreshold: number; // e.g. 12 points
  notifyOnCategoryChange: boolean;
  scheduledTestTime: number | null; // Epoch ms for 1-hour scheduled test
  lastNotificationTime: number | null; // Epoch ms
  lastAlertCondition: string | null; // Summary of last alert condition
  lastResult?: {
    success: boolean;
    message: string;
    timestamp: number;
    status?: 'granted' | 'denied' | 'default' | 'unsupported' | 'error';
  } | null;
  enabled: boolean; // Synchronized with notificationsEnabled for compatibility
}
