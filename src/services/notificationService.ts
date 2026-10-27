/**
 * AirGuard AI - Single Source of Truth Notification Service
 * 
 * Rules:
 * 1. Independent toggles: Notifications ON/OFF & AQI Alerts ON/OFF (fully repeatable switching).
 * 2. Never show "Notifications ON" if permission has not actually been granted.
 * 3. Real browser permission handling (granted / denied / default / unsupported).
 * 4. Immediate test notification with honest delivery feedback (never claims success if delivery failed).
 * 5. Persistent 1-hour scheduled test with overdue detection upon app reopen/focus.
 * 6. Grounded 100% in real Open-Meteo AQI telemetry (zero fake data).
 * 7. Comprehensive diagnostic information for Developer Tools.
 */

import { AQIReading, AQINotification, NotificationSettings, AQICategory } from '../types/airguard';

const SETTINGS_KEY = 'airguard_notification_settings_v4';
const LAST_READING_KEY = 'airguard_last_notified_reading';
const NOTIFICATION_HISTORY_KEY = 'airguard_notification_history';
const MAX_NOTIF_HISTORY = 30;

export interface StoredReadingBaseline {
  aqi: number;
  category: AQICategory;
  timestamp: number;
  locationName: string;
}

export interface NotificationTestResult {
  success: boolean;
  message: string;
  timestamp: number;
  status?: 'granted' | 'denied' | 'default' | 'unsupported' | 'error';
}

export interface NotificationDebugState {
  appNotificationSetting: 'Enabled (ON)' | 'Disabled (OFF)';
  browserDevicePermission: 'Granted' | 'Denied (Blocked)' | 'Default (Not requested)' | 'Unsupported';
  effectiveState: 'Active (ON)' | 'Inactive (OFF)';
  schedulingCapability: string;
  scheduledTestTime: number | null;
  currentTime: number;
  lastNotificationAttempt: number | null;
  lastNotificationResult: string;
  lastAlertCondition: string | null;
  lastResult: NotificationTestResult | null;
}

type NotificationListener = (notification: AQINotification) => void;
type SettingsListener = (settings: NotificationSettings) => void;

class NotificationService {
  private notifListeners: Set<NotificationListener> = new Set();
  private settingsListeners: Set<SettingsListener> = new Set();
  private overdueCheckTimer: any = null;
  private cachedLatestReading: AQIReading | null = null;

  constructor() {
    // Start background overdue check interval
    if (typeof window !== 'undefined') {
      this.overdueCheckTimer = setInterval(() => {
        this.checkOverdueScheduledNotification();
      }, 10000);

      // Check overdue when window/tab regains focus or visibility
      window.addEventListener('focus', () => {
        this.checkOverdueScheduledNotification();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkOverdueScheduledNotification();
        }
      });
    }
  }

  /**
   * Check browser Notification API support
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser permission state
   */
  public getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Evaluates if notifications are effectively active.
   * Requirement 2: Do NOT show "Notifications ON" if the application has not actually been granted the required permission.
   */
  public isEffectiveNotificationsOn(): boolean {
    const settings = this.getSettings();
    const perm = this.getPermission();
    return settings.notificationsEnabled && perm === 'granted';
  }

  /**
   * Evaluates if AQI alerts are effectively active.
   */
  public isEffectiveAqiAlertsOn(): boolean {
    const settings = this.getSettings();
    return this.isEffectiveNotificationsOn() && settings.aqiAlertsEnabled;
  }

  /**
   * Cache latest evaluated reading for scheduled test notifications
   */
  public setLatestReading(reading: AQIReading): void {
    this.cachedLatestReading = reading;
  }

  /**
   * Get current notification settings (single source of truth)
   */
  public getSettings(): NotificationSettings {
    const defaults: NotificationSettings = {
      notificationsEnabled: false, // Default false until explicitly allowed and permitted
      aqiAlertsEnabled: true,
      minDeltaThreshold: 12,
      notifyOnCategoryChange: true,
      scheduledTestTime: null,
      lastNotificationTime: null,
      lastAlertCondition: null,
      lastResult: null,
      enabled: false,
    };

    if (typeof window === 'undefined') return defaults;

    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const perm = this.getPermission();

        // If permission is not granted, notificationsEnabled cannot be effectively true
        const parsedEnabled =
          typeof parsed.notificationsEnabled === 'boolean'
            ? parsed.notificationsEnabled
            : typeof parsed.enabled === 'boolean'
            ? parsed.enabled
            : false;

        const effectiveEnabled = perm === 'granted' ? parsedEnabled : false;

        return {
          ...defaults,
          ...parsed,
          notificationsEnabled: effectiveEnabled,
          aqiAlertsEnabled:
            typeof parsed.aqiAlertsEnabled === 'boolean' ? parsed.aqiAlertsEnabled : true,
          enabled: effectiveEnabled,
        };
      }
    } catch (e) {
      console.warn('Failed to load notification settings:', e);
    }

    return defaults;
  }

  /**
   * Update notification settings and broadcast to all subscribers
   */
  public setSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    const current = this.getSettings();
    const updated: NotificationSettings = {
      ...current,
      ...partial,
    };

    // Synchronize legacy enabled property
    if (partial.notificationsEnabled !== undefined) {
      updated.enabled = partial.notificationsEnabled;
    } else if (partial.enabled !== undefined) {
      updated.notificationsEnabled = partial.enabled;
    }

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save notification settings:', e);
    }

    // Broadcast to all reactive UI listeners
    this.broadcastCurrentSettings(updated);

    return updated;
  }

  /**
   * Toggle Notifications Master Switch ON/OFF
   * Reliable in both directions: ON -> OFF -> ON -> OFF
   * Honors browser permission: will not turn ON if permission is denied.
   */
  public async toggleNotifications(): Promise<{
    success: boolean;
    newState: boolean;
    error?: string;
  }> {
    if (!this.isSupported()) {
      return {
        success: false,
        newState: false,
        error: 'Notifications are unsupported on this browser.',
      };
    }

    const perm = this.getPermission();

    // If permission is denied in browser, it cannot be enabled
    if (perm === 'denied') {
      this.setSettings({ notificationsEnabled: false, enabled: false });
      return {
        success: false,
        newState: false,
        error:
          'Notifications are blocked in your browser site settings. Open browser settings to allow them.',
      };
    }

    // If currently effectively ON, user wants to turn it OFF
    if (this.isEffectiveNotificationsOn()) {
      this.setSettings({ notificationsEnabled: false, enabled: false });
      return { success: true, newState: false };
    }

    // If currently OFF and permission is 'default', request permission explicitly now
    if (perm === 'default') {
      const requested = await this.requestPermission();
      if (requested === 'granted') {
        this.setSettings({ notificationsEnabled: true, enabled: true });
        return { success: true, newState: true };
      } else {
        this.setSettings({ notificationsEnabled: false, enabled: false });
        return {
          success: false,
          newState: false,
          error:
            requested === 'denied'
              ? 'Notifications are blocked in your browser site settings.'
              : 'Notification permission was not granted.',
        };
      }
    }

    // Permission is already granted! Toggle ON
    this.setSettings({ notificationsEnabled: true, enabled: true });
    return { success: true, newState: true };
  }

  /**
   * Toggle AQI Alerts ON/OFF
   * Works reliably in both directions: ON -> OFF -> ON -> OFF
   */
  public toggleAqiAlerts(): { success: boolean; newState: boolean; error?: string } {
    if (!this.isEffectiveNotificationsOn()) {
      return {
        success: false,
        newState: false,
        error: 'Master notifications must be permitted and enabled first.',
      };
    }

    const current = this.getSettings().aqiAlertsEnabled;
    const next = !current;
    this.setSettings({ aqiAlertsEnabled: next });
    return { success: true, newState: next };
  }

  /**
   * Explicitly request native browser permission for system notifications
   */
  public async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) {
      return 'unsupported';
    }
    try {
      const res = await Notification.requestPermission();
      // Notify listeners of state change
      this.setSettings({});
      return res;
    } catch (err) {
      console.warn('Notification permission request error:', err);
      return 'denied';
    }
  }

  /**
   * Retrieve baseline reading used to calculate delta
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
   * Save current baseline reading
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
   * Get notification history log
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
   * Record a notification in persistent history
   */
  private recordNotification(notif: AQINotification): void {
    try {
      const history = this.getNotificationHistory();
      const updated = [notif, ...history].slice(0, MAX_NOTIF_HISTORY);
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to record notification in history:', e);
    }
  }

  /**
   * Dispatch native browser notification with delivery status tracking
   */
  private dispatchBrowserNotification(notif: AQINotification): { delivered: boolean; error?: string } {
    if (!this.isSupported()) {
      return { delivered: false, error: 'Notification API not supported by browser.' };
    }

    if (Notification.permission !== 'granted') {
      return {
        delivered: false,
        error:
          Notification.permission === 'denied'
            ? 'Notifications are blocked in your browser site settings.'
            : 'Notification permission has not yet been granted.',
      };
    }

    try {
      new Notification(notif.title, {
        body: notif.message,
        icon: '/favicon.ico',
      });
      return { delivered: true };
    } catch (err: any) {
      console.warn('Browser Notification constructor failed:', err);
      return { delivered: false, error: err?.message || 'Failed to dispatch browser notification.' };
    }
  }

  /**
   * Immediate Test Notification
   * Honest delivery check: never displays success if delivery failed or was blocked.
   */
  public async sendImmediateTestNotification(
    activeReading?: AQIReading | null
  ): Promise<NotificationTestResult> {
    const reading = activeReading || this.cachedLatestReading;
    if (!reading) {
      const result: NotificationTestResult = {
        success: false,
        message: 'No live AirGuardian air quality data loaded yet. Check air quality first.',
        timestamp: Date.now(),
        status: 'error',
      };
      this.setSettings({ lastResult: result });
      return result;
    }

    const locationName = reading.location.name;
    const currentAqi = reading.aqi;
    const currentCategory = reading.category;

    // 1. Check browser support
    if (!this.isSupported()) {
      const result: NotificationTestResult = {
        success: false,
        message: 'Notification API is unsupported on this browser/device.',
        timestamp: Date.now(),
        status: 'unsupported',
      };
      this.setSettings({ lastResult: result });
      return result;
    }

    // 2. Check permission; request if default
    let currentPerm = Notification.permission;
    if (currentPerm === 'default') {
      currentPerm = await this.requestPermission() as NotificationPermission;
    }

    if (currentPerm !== 'granted') {
      const result: NotificationTestResult = {
        success: false,
        message:
          currentPerm === 'denied'
            ? 'Notification permission is blocked in browser settings. Notifications cannot be sent.'
            : 'Notification permission was not granted by the user.',
        timestamp: Date.now(),
        status: currentPerm === 'denied' ? 'denied' : 'default',
      };
      this.setSettings({ lastResult: result });
      return result;
    }

    // 3. Dispatch native browser notification
    const testNotif: AQINotification = {
      id: `test_${Date.now()}`,
      title: 'AirGuard: Test Notification',
      message: `Notifications are active for ${locationName}. Measured AQI: ${currentAqi} (${currentCategory}).`,
      timestamp: Date.now(),
      previousAQI: currentAqi,
      currentAQI: currentAqi,
      previousCategory: currentCategory,
      currentCategory: currentCategory,
      locationName,
      type: 'category',
      read: false,
    };

    const dispatchRes = this.dispatchBrowserNotification(testNotif);

    if (dispatchRes.delivered) {
      // Record in history & in-app toast
      this.recordNotification(testNotif);
      this.notifListeners.forEach((l) => l(testNotif));

      const result: NotificationTestResult = {
        success: true,
        message: 'Test notification was successfully sent to your system tray.',
        timestamp: Date.now(),
        status: 'granted',
      };

      this.setSettings({
        lastResult: result,
        lastNotificationTime: Date.now(),
        lastAlertCondition: `Test Notification (${locationName}, AQI ${currentAqi})`,
      });

      return result;
    } else {
      const result: NotificationTestResult = {
        success: false,
        message: dispatchRes.error || 'Failed to deliver notification to system tray.',
        timestamp: Date.now(),
        status: 'error',
      };
      this.setSettings({ lastResult: result });
      return result;
    }
  }

  /**
   * Schedule a 1-Hour AQI Notification Test
   */
  public scheduleOneHourTest(): NotificationSettings {
    const scheduledTime = Date.now() + 60 * 60 * 1000; // Exactly 1 hour from now
    return this.setSettings({
      scheduledTestTime: scheduledTime,
      lastAlertCondition: '1-Hour Notification Test Scheduled',
    });
  }

  /**
   * Schedule a short-duration test for quick verification of scheduled/overdue behavior
   */
  public scheduleQuickTest(seconds: number = 5): NotificationSettings {
    const scheduledTime = Date.now() + seconds * 1000;
    return this.setSettings({
      scheduledTestTime: scheduledTime,
      lastAlertCondition: `Quick Notification Test Scheduled (${seconds}s)`,
    });
  }

  /**
   * Cancel any scheduled notification test
   */
  public cancelScheduledTest(): NotificationSettings {
    return this.setSettings({
      scheduledTestTime: null,
      lastAlertCondition: 'Scheduled Test Cancelled',
    });
  }

  /**
   * Check for overdue scheduled notifications (called periodically and on app focus/reopen)
   */
  public checkOverdueScheduledNotification(activeReading?: AQIReading | null): boolean {
    const settings = this.getSettings();
    if (!this.isEffectiveNotificationsOn() || !settings.scheduledTestTime) {
      return false;
    }

    const now = Date.now();
    if (now >= settings.scheduledTestTime) {
      // Overdue! Clear scheduled time immediately to prevent duplicate alerts
      this.setSettings({
        scheduledTestTime: null,
        lastNotificationTime: now,
        lastAlertCondition: '1-Hour Scheduled Alert Delivered',
      });

      const reading = activeReading || this.cachedLatestReading;
      if (!reading) {
        return false;
      }
      const locationName = reading.location.name;
      const aqi = reading.aqi;
      const category = reading.category;

      const scheduledNotif: AQINotification = {
        id: `scheduled_${now}`,
        title: 'AirGuard: 1-Hour Scheduled AQI Update',
        message: `Scheduled air check for ${locationName}: Current AQI is ${aqi} (${category}).`,
        timestamp: now,
        previousAQI: aqi,
        currentAQI: aqi,
        previousCategory: category,
        currentCategory: category,
        locationName,
        type: 'category',
        read: false,
      };

      // Record in history & dispatch
      this.recordNotification(scheduledNotif);
      this.dispatchBrowserNotification(scheduledNotif);
      this.notifListeners.forEach((l) => l(scheduledNotif));

      return true;
    }

    return false;
  }

  /**
   * Evaluate a real Open-Meteo AQI reading.
   * Returns an AQINotification if conditions are met, or null if filtered.
   */
  public evaluateReading(reading: AQIReading): AQINotification | null {
    this.cachedLatestReading = reading;

    // Check if notifications are effectively active AND aqi alerts are enabled
    if (!this.isEffectiveNotificationsOn() || !this.isEffectiveAqiAlertsOn()) {
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
    const settings = this.getSettings();
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
      title = 'AirGuard: Air Quality Worsened';
      message = `AirGuard: AQI in ${reading.location.name} increased from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'increase';
    } else if (delta < 0 && isCategoryChange) {
      title = 'AirGuard: Air Quality Improved';
      message = `AirGuard: AQI in ${reading.location.name} improved from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'improve';
    } else if (isCategoryChange) {
      title = 'AirGuard: Category Shift';
      message = `AirGuard: Air quality in ${reading.location.name} changed from ${last.category} to ${reading.category}. Current AQI: ${currAqi}.`;
      type = 'category';
    } else if (delta > 0) {
      title = 'AirGuard: AQI Increase';
      message = `AirGuard: AQI in ${reading.location.name} increased from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
      type = 'increase';
    } else {
      title = 'AirGuard: AQI Improved';
      message = `AirGuard: AQI in ${reading.location.name} improved from ${prevAqi} to ${currAqi}. Air quality is now ${reading.category}.`;
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
    this.recordNotification(notification);

    // Trigger platform Web Notification if permitted
    this.dispatchBrowserNotification(notification);

    // Update last condition and time
    this.setSettings({
      lastNotificationTime: Date.now(),
      lastAlertCondition: `${title}: ${reading.location.name} (${prevAqi} → ${currAqi})`,
    });

    // Notify in-app reactive listeners
    this.notifListeners.forEach((l) => l(notification));

    return notification;
  }

  /**
   * Get Diagnostic / Debug State for Developer Tools
   */
  public getDebugState(): NotificationDebugState {
    const settings = this.getSettings();
    const perm = this.getPermission();
    const isEffectiveOn = this.isEffectiveNotificationsOn();

    let permLabel: 'Granted' | 'Denied (Blocked)' | 'Default (Not requested)' | 'Unsupported' =
      'Unsupported';
    if (perm === 'granted') permLabel = 'Granted';
    else if (perm === 'denied') permLabel = 'Denied (Blocked)';
    else if (perm === 'default') permLabel = 'Default (Not requested)';

    return {
      appNotificationSetting: settings.notificationsEnabled ? 'Enabled (ON)' : 'Disabled (OFF)',
      browserDevicePermission: permLabel,
      effectiveState: isEffectiveOn ? 'Active (ON)' : 'Inactive (OFF)',
      schedulingCapability:
        'Supported when app is open/reopened (overdue auto-dispatch); background push unavailable in closed browser tab',
      scheduledTestTime: settings.scheduledTestTime,
      currentTime: Date.now(),
      lastNotificationAttempt: settings.lastNotificationTime,
      lastNotificationResult: settings.lastResult?.message || 'None',
      lastAlertCondition: settings.lastAlertCondition,
      lastResult: settings.lastResult || null,
    };
  }

  /**
   * Broadcast current settings to subscribers
   */
  private broadcastCurrentSettings(updated?: NotificationSettings): void {
    const s = updated || this.getSettings();
    this.settingsListeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('Broadcast error:', err);
      }
    });
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
