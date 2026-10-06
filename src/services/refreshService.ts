/**
 * AirGuard AI - Centralized Refresh Service
 * 
 * Manages the refresh state machine:
 * - 'idle' -> 'refreshing' -> 'success' (auto-resets to 'idle' after 2.5s)
 * - 'idle' -> 'refreshing' -> 'failed'  (auto-resets to 'idle' after 3.5s)
 * 
 * Features:
 * 1. Immediate visual feedback
 * 2. Deduplication (prevents repeated clicks while in progress)
 * 3. Exact latency tracking (apiResponseTimeMs)
 * 4. Diagnostics exposure for Developer Tools
 * 5. Honest error and timestamp tracking
 */

export type RefreshStatus = 'idle' | 'refreshing' | 'success' | 'failed';

export interface RefreshDiagnostics {
  status: RefreshStatus;
  lastRefreshStarted: number | null;
  lastRefreshCompleted: number | null;
  lastRefreshError: string | null;
  apiResponseTimeMs: number | null;
  dataTimestamp: string | null;
  selectedCoordinates: { latitude: number; longitude: number } | null;
  dataSource: string;
}

type RefreshStateListener = (diag: RefreshDiagnostics) => void;

class RefreshService {
  private status: RefreshStatus = 'idle';
  private lastRefreshStarted: number | null = null;
  private lastRefreshCompleted: number | null = null;
  private lastRefreshError: string | null = null;
  private apiResponseTimeMs: number | null = null;
  private dataTimestamp: string | null = null;
  private selectedCoordinates: { latitude: number; longitude: number } | null = null;
  private dataSource = 'Open-Meteo Air Quality API (Live)';
  private listeners: Set<RefreshStateListener> = new Set();
  private resetTimer: any = null;

  public getStatus(): RefreshStatus {
    return this.status;
  }

  public getDiagnostics(): RefreshDiagnostics {
    return {
      status: this.status,
      lastRefreshStarted: this.lastRefreshStarted,
      lastRefreshCompleted: this.lastRefreshCompleted,
      lastRefreshError: this.lastRefreshError,
      apiResponseTimeMs: this.apiResponseTimeMs,
      dataTimestamp: this.dataTimestamp,
      selectedCoordinates: this.selectedCoordinates,
      dataSource: this.dataSource,
    };
  }

  /**
   * Called immediately when user taps Refresh
   * Returns true if refresh can start, false if already in progress
   */
  public startRefresh(coords?: { latitude: number; longitude: number }): boolean {
    if (this.status === 'refreshing') {
      // Prevent multiple simultaneous refresh requests from repeated taps
      return false;
    }

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.status = 'refreshing';
    this.lastRefreshStarted = Date.now();
    this.lastRefreshError = null;
    if (coords) {
      this.selectedCoordinates = coords;
    }
    this.broadcast();
    return true;
  }

  /**
   * Called when live Open-Meteo refresh succeeds
   */
  public completeSuccess(dataTimestamp: string, elapsedMs?: number): void {
    this.status = 'success';
    this.lastRefreshCompleted = Date.now();
    this.dataTimestamp = dataTimestamp;
    this.lastRefreshError = null;
    if (elapsedMs !== undefined) {
      this.apiResponseTimeMs = elapsedMs;
    } else if (this.lastRefreshStarted) {
      this.apiResponseTimeMs = Math.round(Date.now() - this.lastRefreshStarted);
    }
    this.broadcast();

    // Auto-reset back to 'idle' after 2.5 seconds
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.status = 'idle';
      this.broadcast();
    }, 2500);
  }

  /**
   * Called when Open-Meteo refresh fails
   */
  public completeFailure(errorMessage: string, elapsedMs?: number): void {
    this.status = 'failed';
    this.lastRefreshCompleted = Date.now();
    this.lastRefreshError = errorMessage;
    if (elapsedMs !== undefined) {
      this.apiResponseTimeMs = elapsedMs;
    } else if (this.lastRefreshStarted) {
      this.apiResponseTimeMs = Math.round(Date.now() - this.lastRefreshStarted);
    }
    this.broadcast();

    // Auto-reset back to 'idle' after 3.5 seconds
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      this.status = 'idle';
      this.broadcast();
    }, 3500);
  }

  /**
   * Subscribe to refresh state changes
   */
  public onStateChange(listener: RefreshStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(): void {
    const diag = this.getDiagnostics();
    this.listeners.forEach((l) => {
      try {
        l(diag);
      } catch (err) {
        console.error('Refresh listener error:', err);
      }
    });
  }
}

export const refreshService = new RefreshService();
