/**
 * AirGuard AI - Mobile Smartphone Application
 * Real Data Integration Architecture:
 * LOCATION -> COORDINATES -> OPEN-METEO -> REAL AIR QUALITY -> HOME / MAP / HEALTH / FORECAST / HISTORY
 * LOCATION -> REAL HEALTHCARE SEARCH -> NEARBY HOSPITALS & CLINICS -> MAP MARKERS & HEALTH CARDS
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  PrimaryNavTab,
  LocationData,
  AQIReading,
  HourlyForecastPoint,
  HealthcarePoint,
  AQINotification,
} from './types/airguard';
import { locationService } from './services/locationService';
import { airQualityService } from './services/airQualityService';
import { healthcareService } from './services/healthcareService';
import { notificationService } from './services/notificationService';
import { MobileHeader } from './components/Navigation/MobileHeader';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { LocationSearchModal } from './components/Location/LocationSearchModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { NotificationToast } from './components/Notification/NotificationToast';
import { HomeView } from './components/Home/HomeView';
import { MapView } from './components/Map/MapView';
import { HealthView } from './components/Health/HealthView';
import { ForecastView } from './components/Forecast/ForecastView';
import { HistoryView } from './components/History/HistoryView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<PrimaryNavTab>('home');
  const [activeLocation, setActiveLocation] = useState<LocationData>(() =>
    locationService.getActiveLocation()
  );
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<AQINotification | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => notificationService.getSettings().enabled
  );

  // Centralized Real Air Quality Data State
  const [reading, setReading] = useState<AQIReading | null>(null);
  const [forecast, setForecast] = useState<HourlyForecastPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheMinutesRemaining, setCacheMinutesRemaining] = useState(60);

  // Real Healthcare Facilities State
  const [healthcareFacilities, setHealthcareFacilities] = useState<HealthcarePoint[]>([]);

  // Subscribe to reactive in-app notifications and settings changes
  useEffect(() => {
    const unsubNotif = notificationService.onNotification((notif) => {
      setActiveNotification(notif);
    });
    const unsubSettings = notificationService.onSettingsChange((s) => {
      setNotificationsEnabled(s.enabled);
    });
    return () => {
      unsubNotif();
      unsubSettings();
    };
  }, []);

  const loadAirQualityAndHealthcare = useCallback(
    async (loc: LocationData, force = false) => {
      if (force) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setFetchError(null);

      // 1. Fetch Open-Meteo Air Quality
      try {
        const result = await airQualityService.getAirQuality(loc, force);
        setReading(result.reading);
        setForecast(result.forecast);
        setCacheMinutesRemaining(
          airQualityService.getRemainingCacheMinutes(loc.latitude, loc.longitude)
        );

        // Evaluate real Open-Meteo AQI reading for significant changes/category shifts
        notificationService.evaluateReading(result.reading);
      } catch (err: any) {
        console.error('Failed to load air quality:', err);
        setFetchError(
          err.message || 'Unable to reach Open-Meteo Air Quality API.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }

      // 2. Fetch Real Nearby Healthcare Facilities around exact coordinates
      try {
        const facilities = await healthcareService.getNearbyHealthcare(
          loc.latitude,
          loc.longitude,
          10,
          force
        );
        setHealthcareFacilities(facilities);
      } catch (hErr) {
        console.warn('Real healthcare search error:', hErr);
        setHealthcareFacilities([]);
      }
    },
    []
  );

  useEffect(() => {
    loadAirQualityAndHealthcare(activeLocation, false);
  }, [activeLocation, loadAirQualityAndHealthcare]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheMinutesRemaining(
        airQualityService.getRemainingCacheMinutes(
          activeLocation.latitude,
          activeLocation.longitude
        )
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [activeLocation]);

  const handleSelectLocation = (loc: LocationData) => {
    setActiveLocation(loc);
    locationService.setActiveLocation(loc);
  };

  const handleManualRefresh = () => {
    loadAirQualityAndHealthcare(activeLocation, true);
  };

  return (
    <div className="h-screen h-[100dvh] bg-[#030A0F] flex justify-center text-[#F8FAFC] antialiased overflow-hidden">
      {/* Mobile App Device Frame */}
      <div className="w-full max-w-[440px] h-full bg-[#071A24] border-x border-[#263238]/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col relative overflow-hidden">
        {/* 1. App Header */}
        <MobileHeader
          activeLocation={activeLocation}
          onOpenLocationSearch={() => setIsLocationModalOpen(true)}
          onRefresh={handleManualRefresh}
          isRefreshing={isRefreshing}
          cacheMinutesRemaining={cacheMinutesRemaining}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          notificationsEnabled={notificationsEnabled}
        />

        {/* Real-time In-App Notification Toast */}
        <NotificationToast
          notification={activeNotification}
          onDismiss={() => setActiveNotification(null)}
        />

        {/* 2. Primary Navigation — Always accessible directly below header */}
        <MobileBottomNav
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
        />

        {/* 3. Scrollable Page Content — Scrolls independently without pushing navigation */}
        <main className="flex-1 w-full overflow-y-auto overscroll-contain">
          {currentTab === 'home' && (
            <HomeView
              reading={reading}
              isLoading={isLoading}
              error={fetchError}
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenLocationSearch={() => setIsLocationModalOpen(true)}
              onRefresh={handleManualRefresh}
            />
          )}

          {currentTab === 'map' && reading && (
            <MapView
              reading={reading}
              healthcareFacilities={healthcareFacilities}
              onOpenLocationSearch={() => setIsLocationModalOpen(true)}
              onSelectLocation={handleSelectLocation}
            />
          )}

          {currentTab === 'health' && reading && (
            <HealthView
              reading={reading}
              facilities={healthcareFacilities}
            />
          )}

          {currentTab === 'forecast' && reading && (
            <ForecastView reading={reading} forecast={forecast} />
          )}

          {currentTab === 'history' && (
            <HistoryView
              onNavigate={(tab) => setCurrentTab(tab)}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
            />
          )}
        </main>

        {/* Settings & Notifications Preferences Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />

        {/* Mobile Location Selector Bottom Sheet */}
        <LocationSearchModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          onSelectLocation={handleSelectLocation}
          currentLocation={activeLocation}
        />
      </div>
    </div>
  );
}
