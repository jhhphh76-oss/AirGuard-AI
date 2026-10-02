/**
 * AirGuard AI - Real AQI Change Notification Service
 * Evaluates real Open-Meteo AQI readings, filters out small fluctuations (e.g. 72 -> 73),
 * prevents spam on duplicate readings/re-opening the app, and alerts on significant shifts
 * or category changes.
 */

import { AQIReading, AQINotification, NotificationSettings, AQICategory } from '../types/airguard';

const SETTINGS_KEY = 'airguard_notification_settings';
const LAST_READING_KEY = 'airguard_last_notified_reading';
const NOTIFICATION_HISTORY_KEY = 'airguard_notification_history';
const MAX_NOTIF_HISTORY = 30;

// Listeners for in-app reactive toast alerts
type NotificationListener = (notification: AQINotification) => void;
type SettingsListener = (settings: NotificationSettings) => void;

interface StoredReadingBaseline {
  aqi: number;
  category: AQICategory;
  timestamp: number;
  locationName: string;
}

class NotificationService {
  private notifListeners: Set<NotificationListener> = new Set();
  private settingsListeners: Set<SettingsListener> = new Set();

  /**
   * Get user notification preferences
   */
  public getSettings(): NotificationSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load notification settings:', e);
    }
    // Default: Notifications ON, threshold: 12 AQI points
    return {
      enabled: true,
      minDeltaThreshold: 12,
      notifyOnCategoryChange: true,
    };
  }

  /**
   * Update notification preferences
   */
  public setSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    const current = this.getSettings();
    const updated: NotificationSettings = {
      ...current,
      ...partial,
    };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notification settings:', e);
    }
    this.settingsListeners.forEach((l) => l(updated));
    return updated;
  }

  /**
   * Retrieve the stored baseline reading used to calculate delta
   */
  public getLastEvaluatedReading(): StoredReadingBaseline | null {
    try {
      const data = localStorage.getItem(LAST_READING_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to parse last evaluated reading:', e);
    }
    return null;
  }

  /**
   * Save the current baseline reading
   */
  private setLastEvaluatedReading(reading: AQIReading): void {
    const baseline: StoredReadingBaseline = {
      aqi: reading.aqi,
      category: reading.category,
      timestamp: reading.retrievalTimestamp,
      locationName: reading.location.name,
    };
    try {
      localStorage.setItem(LAST_READING_KEY, JSON.stringify(baseline));
    } catch (e) {
      console.warn('Failed to store last evaluated reading:', e);
    }
  }

  /**
   * Get historical notifications for the settings/alerts list
   */
  public getNotificationHistory(): AQINotification[] {
    try {
      const data = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to load notification history:', e);
    }
    return [];
  }

  /**
   * Clear notification history log
   */
  public clearNotificationHistory(): void {
    try {
      localStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch (e) {
      console.warn('Failed to clear notification history:', e);
    }
  }

  /**
   * Request native browser permission for system notifications
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Notification permission request error:', err);
      return 'denied';
    }
  }

  /**
   * Evaluate a real Open-Meteo AQI reading.
   * Returns an AQINotification if conditions are met, or null if filtered.
   */
  public evaluateReading(reading: AQIReading): AQINotification | null {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return null;
    }

    // Do not notify on error or stale readings
    if (reading.isStale && reading.lastAttemptFailed) {
      return null;
    }

    const last = this.getLastEvaluatedReading();

    // 1. Initial baseline: if no previous reading is stored, record it silently
    // and do not spam merely because the app was opened
    if (!last) {
      this.setLastEvaluatedReading(reading);
      return null;
    }

    // 2. Avoid spam on exact same reading, same timestamp, or identical telemetry
    if (
      last.timestamp === reading.retrievalTimestamp ||
      (last.locationName === reading.location.name &&
        last.aqi === reading.aqi &&
        last.category === reading.category)
    ) {
      return null;
    }

    // 3. If user changed location, update baseline silently without false delta alert
    if (last.locationName !== reading.location.name) {
      this.setLastEvaluatedReading(reading);
      return null;
    }

    // 4. Calculate actual delta & category changes
    const prevAqi = last.aqi;
    const currAqi = reading.aqi;
    const delta = currAqi - prevAqi;
    const isCategoryChange = last.category !== reading.category;
    const isSignificantDelta = Math.abs(delta) >= settings.minDeltaThreshold;

    // RULE: Do NOT send a notification for tiny changes (e.g. 72 -> 73)
    // Only notify when AQI changes significantly (>= 12) OR category changes
    if (!isSignificantDelta && !isCategoryChange) {
      return null;
    }

    // 5. Construct notification message using actual values and categories
    let message = '';
    let title = 'AirGuard: Air Quality Alert';
    let type: 'increase' | 'improve' | 'category' = 'category';

    if (delta > 0 && isCategoryChange) {
      // AQI increased and category worsened
      title = 'AirGuard: Air Quality Worsened';
      message = `AirGuard: AQI has increased from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'increase';
    } else if (delta < 0 && isCategoryChange) {
      // AQI improved and category changed
      title = 'AirGuard: Air Quality Improved';
      message = `AirGuard: AQI has improved from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'improve';
    } else if (isCategoryChange) {
      // Category changed
      title = 'AirGuard: Category Shift';
      message = `AirGuard: Air quality has changed from ${last.category} to ${reading.category}. Current AQI: ${currAqi}.`;
      type = 'category';
    } else if (delta > 0) {
      // Significant numeric increase within same category
      title = 'AirGuard: AQI Increase';
      message = `AirGuard: AQI has increased from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'increase';
    } else {
      // Significant numeric improvement within same category
      title = 'AirGuard: AQI Improved';
      message = `AirGuard: AQI has improved from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'improve';
    }

    const notification: AQINotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title,
      message,
      timestamp: Date.now(),
      previousAQI: prevAqi,
      currentAQI: currAqi,
      previousCategory: last.category,
      currentCategory: reading.category,
      locationName: reading.location.name,
      type,
      read: false,
    };

    // Update baseline so subsequent comparisons measure from this verified state
    this.setLastEvaluatedReading(reading);

    // Save to notification history
    try {
      const history = this.getNotificationHistory();
      const updated = [notification, ...history].slice(0, MAX_NOTIF_HISTORY);
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notification record:', e);
    }

    // Trigger platform Web Notification if permitted
    this.dispatchBrowserNotification(notification);

    // Notify in-app reactive listeners
    this.notifListeners.forEach((l) => l(notification));

    return notification;
  }

  /**
   * Dispatch native browser notification
   */
  private dispatchBrowserNotification(notif: AQINotification): void {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(notif.title, {
          body: notif.message,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  }

  /**
   * Generate a manual test notification for settings verification
   */
  public triggerTestNotification(): AQINotification {
    const testNotif: AQINotification = {
      id: `test_${Date.now()}`,
      title: 'AirGuard: Notification Active',
      message: 'AirGuard: Notifications are active. You will be alerted when AQI shifts significantly or category changes.',
      timestamp: Date.now(),
      previousAQI: 65,
      currentAQI: 82,
      previousCategory: 'Moderate',
      currentCategory: 'Moderate',
      locationName: 'Active Location',
      type: 'increase',
      read: false,
    };

    this.dispatchBrowserNotification(testNotif);
    this.notifListeners.forEach((l) => l(testNotif));
    return testNotif;
  }

  /**
   * Subscribe to in-app notification toasts
   */
  public onNotification(listener: NotificationListener): () => void {
    this.notifListeners.add(listener);
    return () => {
      this.notifListeners.delete(listener);
    };
  }

  /**
   * Subscribe to settings changes
   */
  public onSettingsChange(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }
}

export const notificationService = new NotificationService();
