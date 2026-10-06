import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  X,
  Shield,
  Check,
  AlertTriangle,
  Info,
  Sliders,
  Send,
  Trash2,
  MapPin,
  Camera,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  Terminal,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Database,
  Crosshair,
} from 'lucide-react';
import {
  notificationService,
  NotificationDebugState,
  NotificationTestResult,
} from '../../services/notificationService';
import {
  refreshService,
  RefreshDiagnostics,
  RefreshStatus,
} from '../../services/refreshService';
import {
  permissionService,
  PermissionsState,
  SensorPermissionStatus,
} from '../../services/permissionService';
import { NotificationSettings, AQINotification, AQIReading } from '../../types/airguard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeReading?: AQIReading | null;
  onRefreshTelemetry?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeReading,
  onRefreshTelemetry,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    notificationService.getSettings()
  );
  const [history, setHistory] = useState<AQINotification[]>([]);
  const [testResult, setTestResult] = useState<NotificationTestResult | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [toggleErrorMessage, setToggleErrorMessage] = useState<string | null>(null);

  // Centralized Permissions State
  const [permissions, setPermissions] = useState<PermissionsState>({
    location: 'prompt',
    camera: 'prompt',
    notifications: 'prompt',
  });

  // User explanation confirmation state before triggering native permission prompts
  const [requestingType, setRequestingType] = useState<
    'location' | 'camera' | 'notifications' | null
  >(null);

  // Accordion for "Manage" instructions
  const [managingType, setManagingType] = useState<'location' | 'camera' | null>(null);

  // Diagnostics & Developer Tools State
  const [showDebug, setShowDebug] = useState(false);
  const [debugState, setDebugState] = useState<NotificationDebugState>(() =>
    notificationService.getDebugState()
  );
  const [refreshDiagnostics, setRefreshDiagnostics] = useState<RefreshDiagnostics>(() =>
    refreshService.getDiagnostics()
  );

  // Synchronize on open and subscribe to continuous reactive updates
  useEffect(() => {
    if (isOpen) {
      setSettings(notificationService.getSettings());
      setHistory(notificationService.getNotificationHistory());
      setDebugState(notificationService.getDebugState());
      setRefreshDiagnostics(refreshService.getDiagnostics());
      setToggleErrorMessage(null);
      permissionService.getPermissionsStatus().then(setPermissions);

      if (activeReading) {
        notificationService.setLatestReading(activeReading);
      }
    }

    const unsubSettings = notificationService.onSettingsChange((newSettings) => {
      setSettings(newSettings);
      setDebugState(notificationService.getDebugState());
      permissionService.getPermissionsStatus().then(setPermissions);
    });

    const unsubRefresh = refreshService.onStateChange((newDiag) => {
      setRefreshDiagnostics(newDiag);
    });

    return () => {
      unsubSettings();
      unsubRefresh();
    };
  }, [isOpen, activeReading]);

  // Periodic debug time update when modal is open and debug view is visible
  useEffect(() => {
    if (!isOpen || !showDebug) return;
    const interval = setInterval(() => {
      setDebugState(notificationService.getDebugState());
      setRefreshDiagnostics(refreshService.getDiagnostics());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, showDebug]);

  const refreshAllStatuses = async () => {
    const updated = await permissionService.getPermissionsStatus();
    setPermissions(updated);
    setSettings(notificationService.getSettings());
    setDebugState(notificationService.getDebugState());
    setRefreshDiagnostics(refreshService.getDiagnostics());
  };

  // Toggle 1: Master Notifications Switch
  // Requirement 1 & 2:
  // - Repeatedly toggling ON -> OFF -> ON -> OFF works reliably in both directions.
  // - Never shows "ON" if browser permission has not been granted.
  const handleToggleMasterNotifications = async () => {
    setToggleErrorMessage(null);
    const result = await notificationService.toggleNotifications();
    if (!result.success && result.error) {
      setToggleErrorMessage(result.error);
    }
    setSettings(notificationService.getSettings());
    setDebugState(notificationService.getDebugState());
    refreshAllStatuses();
  };

  // Toggle 2: AQI Change Alerts Switch
  const handleToggleAqiAlerts = () => {
    setToggleErrorMessage(null);
    const result = notificationService.toggleAqiAlerts();
    if (!result.success && result.error) {
      setToggleErrorMessage(result.error);
    }
    setSettings(notificationService.getSettings());
    setDebugState(notificationService.getDebugState());
  };

  // Immediate Test Notification (Honest delivery check)
  const handleSendImmediateTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);
    try {
      const res = await notificationService.sendImmediateTestNotification(activeReading);
      setTestResult(res);
      setHistory(notificationService.getNotificationHistory());
      setSettings(notificationService.getSettings());
      setDebugState(notificationService.getDebugState());
      refreshAllStatuses();
    } finally {
      setIsSendingTest(false);
    }
  };

  // 1-Hour Notification Test Scheduling
  const handleScheduleOneHourTest = () => {
    const updated = notificationService.scheduleOneHourTest();
    setSettings(updated);
    setDebugState(notificationService.getDebugState());
  };

  const handleCancelScheduledTest = () => {
    const updated = notificationService.cancelScheduledTest();
    setSettings(updated);
    setDebugState(notificationService.getDebugState());
  };

  const handleTestOverdueTrigger = () => {
    notificationService.scheduleQuickTest(-1);
    notificationService.checkOverdueScheduledNotification(activeReading);
    setSettings(notificationService.getSettings());
    setHistory(notificationService.getNotificationHistory());
    setDebugState(notificationService.getDebugState());
  };

  // Explicit permission request confirm dialog
  const handleConfirmRequest = async () => {
    if (!requestingType) return;
    const type = requestingType;
    setRequestingType(null);

    if (type === 'location') {
      const res = await permissionService.requestLocationPermission();
      setPermissions((prev) => ({ ...prev, location: res }));
    } else if (type === 'camera') {
      const res = await permissionService.requestCameraPermission();
      setPermissions((prev) => ({ ...prev, camera: res }));
    } else if (type === 'notifications') {
      const res = await notificationService.requestPermission();
      setPermissions((prev) => ({
        ...prev,
        notifications: res === 'granted' ? 'granted' : res === 'denied' ? 'denied' : 'prompt',
      }));
    }
    refreshAllStatuses();
  };

  const handleClearHistory = () => {
    notificationService.clearNotificationHistory();
    setHistory([]);
  };

  // Status mapping: Allowed / Not allowed / Blocked
  const getLocationCameraStatus = (
    status: SensorPermissionStatus
  ): {
    label: 'Allowed' | 'Not allowed' | 'Blocked';
    color: string;
    bg: string;
  } => {
    if (status === 'granted') {
      return { label: 'Allowed', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.15)' };
    }
    if (status === 'denied') {
      return { label: 'Blocked', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
    }
    return { label: 'Not allowed', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)' };
  };

  // Effective Notification State
  // Requirement 2: Do NOT show "Notifications ON" if the application has not actually been granted the required permission.
  const isEffectiveOn = notificationService.isEffectiveNotificationsOn();
  const isAqiAlertsOn = notificationService.isEffectiveAqiAlertsOn();
  const browserPerm = notificationService.getPermission();

  if (!isOpen) return null;

  const locStatus = getLocationCameraStatus(permissions.location);
  const camStatus = getLocationCameraStatus(permissions.camera);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-[#071A24] border border-[#263238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#263238] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/25 text-[#5EEAD4] border border-[#0F766E]/40 shrink-0">
              <Sliders className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 id="settings-modal-title" className="text-sm font-bold text-white truncate">
                App Settings & Preferences
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                Permissions, notifications & telemetry diagnostics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Close settings"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-3.5 sm:p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Explanation Dialog before triggering native OS prompt */}
          {requestingType && (
            <div className="p-3.5 rounded-2xl bg-[#0F766E]/20 border border-[#0F766E]/50 text-white space-y-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-bold text-[#5EEAD4]">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  {requestingType === 'location' && 'Why AirGuard needs Location access'}
                  {requestingType === 'camera' && 'Why AirGuard needs Camera access'}
                  {requestingType === 'notifications' && 'Why AirGuard needs Notification access'}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                {requestingType === 'location' &&
                  'Your location is used only when you choose "Use Current Location" or "Locate Me" to fetch real-time Open-Meteo air quality.'}
                {requestingType === 'camera' &&
                  'The camera is used solely when you choose "Capture Photo" in Health to assess atmospheric haze, smoke, or horizon clarity.'}
                {requestingType === 'notifications' &&
                  'Notifications alert you only when air quality shifts significantly (≥ 12 AQI points) or transitions into a new health category.'}
              </p>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRequestingType(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRequest}
                  className="px-3 py-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-[#071A24] font-bold text-xs transition-colors"
                >
                  Continue & Allow
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 1. NOTIFICATIONS SECTION                                        */}
          {/* ============================================================== */}
          <section className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-3.5 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#5EEAD4]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Notifications & AQI Alerts
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold font-mono tracking-tight ${
                  browserPerm === 'granted'
                    ? 'text-[#22C55E] bg-[#22C55E]/15'
                    : browserPerm === 'denied'
                    ? 'text-[#EF4444] bg-[#EF4444]/15'
                    : 'text-[#F59E0B] bg-[#F59E0B]/15'
                }`}
              >
                Browser: {browserPerm === 'granted' ? 'Allowed' : browserPerm === 'denied' ? 'Blocked' : 'Permission Required'}
              </span>
            </div>

            {/* Error / Instruction Warning Banner if toggled while blocked */}
            {toggleErrorMessage && (
              <div className="p-2.5 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/35 text-[11px] text-[#EF4444] flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{toggleErrorMessage}</span>
              </div>
            )}

            {/* Browser Blocked Warning Explanation */}
            {browserPerm === 'denied' && (
              <div className="p-2.5 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/25 text-[10px] text-[#EF4444] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Notifications are blocked in your browser. Open browser site settings from the address bar icon and toggle Notifications to &quot;Allow&quot;.
                </p>
              </div>
            )}

            {/* TOGGLE 1: Master Notifications Switch */}
            <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-white block truncate">
                    Notifications (Master Switch)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    State:{' '}
                    <strong
                      className={`font-mono ${
                        isEffectiveOn ? 'text-[#22C55E]' : 'text-slate-400'
                      }`}
                    >
                      {isEffectiveOn ? 'ACTIVE [ ON ]' : 'INACTIVE [ OFF ]'}
                    </strong>
                  </span>
                </div>

                {/* Accessible Visual Switch with Explicit Text [ ON ] / [ OFF ] */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isEffectiveOn}
                  aria-label={`Master notifications toggle, currently ${isEffectiveOn ? 'ON' : 'OFF'}`}
                  onClick={handleToggleMasterNotifications}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 shadow-md ${
                    isEffectiveOn
                      ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/30'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                  }`}
                >
                  {isEffectiveOn ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>[ ON ]</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>[ OFF ]</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                {browserPerm !== 'granted'
                  ? 'Browser permission is required before notifications can be turned ON.'
                  : 'Master switch for background alerts and air quality shift notifications.'}
              </p>
            </div>

            {/* TOGGLE 2: AQI Change Alerts Switch */}
            <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-white block truncate">
                    AQI Change Alerts
                  </span>
                  <span className="text-[10px] text-slate-400">
                    State:{' '}
                    <strong
                      className={`font-mono ${
                        isAqiAlertsOn ? 'text-[#22C55E]' : 'text-slate-400'
                      }`}
                    >
                      {isAqiAlertsOn ? 'ACTIVE [ ON ]' : 'INACTIVE [ OFF ]'}
                    </strong>
                  </span>
                </div>

                {/* Accessible Visual Switch with Explicit Text [ ON ] / [ OFF ] */}
                <button
                  type="button"
                  role="switch"
                  disabled={!isEffectiveOn}
                  aria-checked={isAqiAlertsOn}
                  aria-label={`AQI change alerts toggle, currently ${isAqiAlertsOn ? 'ON' : 'OFF'}`}
                  onClick={handleToggleAqiAlerts}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-extrabold flex items-center gap-1.5 border transition-all shrink-0 shadow-md ${
                    !isEffectiveOn
                      ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-800 text-slate-500'
                      : isAqiAlertsOn
                      ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/30 cursor-pointer'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 cursor-pointer'
                  }`}
                >
                  {isAqiAlertsOn ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                      <span>[ ON ]</span>
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>[ OFF ]</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                Alerts when real Open-Meteo readings shift by ≥ 12 AQI points or change category.
              </p>
            </div>

            {/* Smart Anti-Spam Rules */}
            <div className="p-2.5 rounded-lg bg-[#071A24] border border-slate-800 text-[10px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">Strict Anti-Spam Policy:</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400 leading-snug pl-0.5">
                <li>Does not notify for tiny changes (e.g. 72 → 73).</li>
                <li>Triggers only for meaningful changes (≥ 12 AQI points).</li>
                <li>Triggers when AQI crosses into a different health category.</li>
                <li>Does not create duplicate notifications when reopening the app.</li>
                <li>Never generates fake AQI values (uses real Open-Meteo telemetry only).</li>
              </ul>
            </div>

            {/* ACTION: Immediate Test Notification */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={handleSendImmediateTest}
                disabled={isSendingTest}
                className="w-full py-2.5 px-3 rounded-xl bg-[#0F766E]/20 hover:bg-[#0F766E]/35 border border-[#0F766E]/50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isSendingTest ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#5EEAD4]" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-[#5EEAD4]" />
                )}
                <span>Send Immediate Test Notification</span>
              </button>

              {/* Honest Test Notification Feedback */}
              {testResult && (
                <div
                  className={`p-2.5 rounded-xl text-[11px] border flex items-start gap-2 animate-in fade-in ${
                    testResult.success
                      ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                      : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#22C55E]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF4444]" />
                  )}
                  <div className="space-y-0.5">
                    <span className="font-bold block">
                      {testResult.success ? 'Notification Sent Successfully' : 'Notification Failed'}
                    </span>
                    <p className="leading-snug">{testResult.message}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ACTION: 1-Hour AQI Notification Test */}
            <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span className="text-xs font-bold text-white">1-Hour Notification Test</span>
                </div>
                {settings.scheduledTestTime ? (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#06B6D4]/15 text-[#06B6D4] font-bold">
                    Scheduled
                  </span>
                ) : (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    Not scheduled
                  </span>
                )}
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                Schedules an air quality check 1 hour from now. Stored persistently across refreshes.
              </p>

              {settings.scheduledTestTime ? (
                <div className="p-2.5 rounded-lg bg-[#09212D] border border-slate-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Scheduled for:</span>
                    <span className="font-mono text-[#5EEAD4] font-bold">
                      {new Date(settings.scheduledTestTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={handleCancelScheduledTest}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      Cancel Scheduled Test
                    </button>
                    <button
                      type="button"
                      onClick={handleTestOverdueTrigger}
                      className="py-1.5 px-3 rounded-lg bg-[#0F766E] hover:bg-[#0F766E]/80 text-white text-[10px] font-semibold transition-colors cursor-pointer"
                      title="Simulate overdue time passing now"
                    >
                      Trigger Overdue Now
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleScheduleOneHourTest}
                    className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Schedule in 1 Hour</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestOverdueTrigger}
                    className="py-2 px-2.5 rounded-lg bg-[#09212D] hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                    title="Simulate overdue time passing now"
                  >
                    Quick Test
                  </button>
                </div>
              )}

              <p className="text-[9px] text-slate-500 leading-snug">
                * Note: In web browsers without active push services, overdue notifications are evaluated and delivered automatically when you reopen or focus the app.
              </p>
            </div>
          </section>

          {/* ============================================================== */}
          {/* 2. SENSOR PERMISSIONS (Location & Camera)                      */}
          {/* ============================================================== */}
          <section className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-3 shadow-md">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
              Device Permissions
            </span>

            {/* Location Item */}
            <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  <span className="text-xs font-bold text-white truncate">Location</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    style={{ color: locStatus.color, backgroundColor: locStatus.bg }}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono tracking-tight"
                  >
                    {locStatus.label}
                  </span>

                  {locStatus.label === 'Not allowed' ? (
                    <button
                      type="button"
                      onClick={() => setRequestingType('location')}
                      className="py-1 px-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-[10px] transition-colors cursor-pointer"
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setManagingType(managingType === 'location' ? null : 'location')
                      }
                      className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] transition-colors cursor-pointer"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                Used only when you choose &quot;Use Current Location&quot; or &quot;Locate Me&quot;. Never requested on app startup.
              </p>

              {managingType === 'location' && (
                <div className="p-2.5 rounded-lg bg-[#09212D] border border-slate-700 text-[10px] text-slate-300 space-y-1 animate-in fade-in">
                  <span className="font-semibold text-white block">
                    Managing Location in your Browser:
                  </span>
                  <p className="leading-relaxed text-slate-300">
                    {locStatus.label === 'Blocked'
                      ? 'Location is blocked in your browser site settings. Click the lock or tune icon in your address bar and toggle Location to "Allow".'
                      : 'To change or revoke location permission, click the lock/settings icon in your browser address bar and modify Site Settings.'}
                  </p>
                </div>
              )}
            </div>

            {/* Camera Item */}
            <div className="p-3 rounded-xl bg-[#071A24] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Camera className="w-3.5 h-3.5 text-[#06B6D4] shrink-0" />
                  <span className="text-xs font-bold text-white truncate">Camera</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    style={{ color: camStatus.color, backgroundColor: camStatus.bg }}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold font-mono tracking-tight"
                  >
                    {camStatus.label}
                  </span>

                  {camStatus.label === 'Not allowed' ? (
                    <button
                      type="button"
                      onClick={() => setRequestingType('camera')}
                      className="py-1 px-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-[10px] transition-colors cursor-pointer"
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setManagingType(managingType === 'camera' ? null : 'camera')}
                      className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[10px] transition-colors cursor-pointer"
                    >
                      Manage
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-snug">
                Requested only when you press &quot;Capture Photo&quot;. Uploading images from gallery never requires camera permission.
              </p>

              {managingType === 'camera' && (
                <div className="p-2.5 rounded-lg bg-[#09212D] border border-slate-700 text-[10px] text-slate-300 space-y-1 animate-in fade-in">
                  <span className="font-semibold text-white block">
                    Managing Camera in your Browser:
                  </span>
                  <p className="leading-relaxed text-slate-300">
                    {camStatus.label === 'Blocked'
                      ? 'Camera is blocked in your browser site settings. Click the lock or tune icon in your address bar and toggle Camera to "Allow". You can also upload photos from your device gallery without camera access.'
                      : 'To change or revoke camera permission, click the lock/settings icon in your browser address bar and modify Site Settings.'}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ============================================================== */}
          {/* 3. RECENT ALERT LOG                                            */}
          {/* ============================================================== */}
          <div className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Recent Alert Log ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[10px] text-slate-400 hover:text-[#EF4444] flex items-center gap-1 font-semibold transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#071A24] text-center text-slate-400 text-xs border border-slate-800">
                No alerts recorded yet. Alerts are saved here when real Open-Meteo readings trigger significant changes.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-white truncate max-w-[240px]">
                        {item.title}
                      </span>
                      <span className="font-mono text-slate-400 shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug break-words">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 pt-0.5">
                      <span className="truncate max-w-[150px]">{item.locationName}</span>
                      <span>·</span>
                      <span>
                        AQI {item.previousAQI} → {item.currentAQI}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* 4. DEVELOPER TOOLS: COMPREHENSIVE DIAGNOSTICS & DEBUG STATE    */}
          {/* ============================================================== */}
          <div className="rounded-2xl bg-[#09212D] border border-slate-800 overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#38BDF8]" />
                <div>
                  <span className="text-xs font-bold text-slate-200 font-mono block">
                    Developer Tools & Diagnostics
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Live inspection for Notifications & Refresh state
                  </span>
                </div>
              </div>
              {showDebug ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showDebug && (
              <div className="p-3.5 pt-0 border-t border-slate-800/80 space-y-3.5 font-mono text-[10px] text-slate-300 animate-in fade-in">
                {/* 4A. NOTIFICATION DIAGNOSTICS */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-1.5 text-[#5EEAD4] font-bold text-[11px]">
                    <Bell className="w-3.5 h-3.5" />
                    <span>NOTIFICATION DIAGNOSTICS</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">App Notification Setting</span>
                      <span className="font-bold text-white">
                        {debugState.appNotificationSetting}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Browser/Device Permission</span>
                      <span
                        className={`font-bold ${
                          debugState.browserDevicePermission === 'Granted'
                            ? 'text-[#22C55E]'
                            : debugState.browserDevicePermission.includes('Denied')
                            ? 'text-[#EF4444]'
                            : 'text-[#F59E0B]'
                        }`}
                      >
                        {debugState.browserDevicePermission}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Scheduling Capability:</span>
                      <span className="text-white text-right max-w-[200px] truncate">
                        {debugState.schedulingCapability.slice(0, 32)}…
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Scheduled Test Time:</span>
                      <span className="text-[#38BDF8]">
                        {debugState.scheduledTestTime
                          ? new Date(debugState.scheduledTestTime).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Notification Attempt:</span>
                      <span className="text-white">
                        {debugState.lastNotificationAttempt
                          ? new Date(debugState.lastNotificationAttempt).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Notification Result:</span>
                      <span
                        className={`truncate max-w-[180px] ${
                          debugState.lastResult?.success ? 'text-[#22C55E]' : 'text-slate-300'
                        }`}
                      >
                        {debugState.lastNotificationResult}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4B. REFRESH DIAGNOSTICS */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[#38BDF8] font-bold text-[11px]">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>REFRESH DIAGNOSTICS</span>
                    </div>
                    {onRefreshTelemetry && (
                      <button
                        type="button"
                        onClick={onRefreshTelemetry}
                        disabled={refreshDiagnostics.status === 'refreshing'}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[#5EEAD4] text-[9px] font-semibold cursor-pointer"
                      >
                        Trigger Refresh
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">Refresh Status</span>
                      <span
                        className={`font-bold uppercase ${
                          refreshDiagnostics.status === 'refreshing'
                            ? 'text-[#06B6D4]'
                            : refreshDiagnostics.status === 'success'
                            ? 'text-[#22C55E]'
                            : refreshDiagnostics.status === 'failed'
                            ? 'text-[#EF4444]'
                            : 'text-slate-300'
                        }`}
                      >
                        {refreshDiagnostics.status}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">API Response Time</span>
                      <span className="font-bold text-white">
                        {refreshDiagnostics.apiResponseTimeMs !== null
                          ? `${refreshDiagnostics.apiResponseTimeMs} ms`
                          : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-[#071A24] border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Refresh Started:</span>
                      <span className="text-white">
                        {refreshDiagnostics.lastRefreshStarted
                          ? new Date(refreshDiagnostics.lastRefreshStarted).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Refresh Completed:</span>
                      <span className="text-white">
                        {refreshDiagnostics.lastRefreshCompleted
                          ? new Date(refreshDiagnostics.lastRefreshCompleted).toLocaleTimeString()
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Refresh Error:</span>
                      <span
                        className={
                          refreshDiagnostics.lastRefreshError ? 'text-[#EF4444]' : 'text-slate-400'
                        }
                      >
                        {refreshDiagnostics.lastRefreshError || 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Data Timestamp:</span>
                      <span className="text-[#38BDF8]">
                        {refreshDiagnostics.dataTimestamp || activeReading?.timestamp || 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Selected Coordinates:</span>
                      <span className="text-white">
                        {activeReading?.location
                          ? `${activeReading.location.latitude.toFixed(4)}°, ${activeReading.location.longitude.toFixed(4)}°`
                          : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Data Source:</span>
                      <span className="text-white">{refreshDiagnostics.dataSource}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#071A24] border-t border-[#263238] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
