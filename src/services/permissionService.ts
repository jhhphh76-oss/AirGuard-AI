/**
 * AirGuard AI - Centralized Permissions & Notifications Service
 * 
 * Rules:
 * 1. NEVER automatically prompt for permissions on startup.
 * 2. Non-intrusively inspects permissions via navigator.permissions or Notification.permission.
 * 3. Requests permissions ONLY when the user explicitly triggers a feature or toggles the setting.
 * 4. Explains purpose before triggering OS permission dialog.
 * 5. Handles "Not allowed" (denied) gracefully with clear instructions and never loops.
 */

export type SensorPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface PermissionsState {
  location: SensorPermissionStatus;
  camera: SensorPermissionStatus;
  notifications: SensorPermissionStatus;
}

export const permissionService = {
  /**
   * Non-intrusively queries current permission statuses without triggering any OS popups.
   */
  async getPermissionsStatus(): Promise<PermissionsState> {
    const result: PermissionsState = {
      location: 'prompt',
      camera: 'prompt',
      notifications: 'prompt',
    };

    // 1. Query Geolocation permission status
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
        result.location = geoStatus.state as SensorPermissionStatus;
      } catch {
        result.location = 'geolocation' in navigator ? 'prompt' : 'unsupported';
      }
    } else {
      result.location = typeof navigator !== 'undefined' && 'geolocation' in navigator ? 'prompt' : 'unsupported';
    }

    // 2. Query Camera permission status
    const hasCameraApi =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      'getUserMedia' in navigator.mediaDevices;

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const camStatus = await navigator.permissions.query({ name: 'camera' as any });
        result.camera = camStatus.state as SensorPermissionStatus;
      } catch {
        result.camera = hasCameraApi ? 'prompt' : 'unsupported';
      }
    } else {
      result.camera = hasCameraApi ? 'prompt' : 'unsupported';
    }

    // 3. Query Notifications permission status
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        result.notifications = 'granted';
      } else if (Notification.permission === 'denied') {
        result.notifications = 'denied';
      } else {
        result.notifications = 'prompt';
      }
    } else {
      result.notifications = 'unsupported';
    }

    return result;
  },

  /**
   * Explicit user request for Location permission.
   */
  async requestLocationPermission(): Promise<SensorPermissionStatus> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return 'unsupported';
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            resolve('denied');
          } else {
            resolve('prompt');
          }
        },
        { timeout: 8000 }
      );
    });
  },

  /**
   * Explicit user request for Camera permission.
   * Acquires a momentary stream and immediately releases tracks.
   */
  async requestCameraPermission(): Promise<SensorPermissionStatus> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      return 'unsupported';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Immediately stop all tracks to release the hardware
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return 'denied';
      }
      return 'prompt';
    }
  },

  /**
   * Explicit user request for Notification permission.
   */
  async requestNotificationPermission(): Promise<SensorPermissionStatus> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') return 'granted';
      if (res === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'prompt';
    }
  },

  /**
   * Helper to format status for UI presentation: Allowed | Not allowed | Blocked
   */
  formatStatusLabel(status: SensorPermissionStatus): {
    text: 'Allowed' | 'Not allowed' | 'Blocked' | 'Unavailable';
    color: string;
    bg: string;
  } {
    switch (status) {
      case 'granted':
        return { text: 'Allowed', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' };
      case 'denied':
        return { text: 'Blocked', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'prompt':
        return { text: 'Not allowed', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
      case 'unsupported':
      default:
        return { text: 'Unavailable', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.15)' };
    }
  },
};
