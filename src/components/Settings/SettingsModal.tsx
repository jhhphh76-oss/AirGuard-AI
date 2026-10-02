import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellOff,
  X,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  Sliders,
  Send,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { NotificationSettings, AQINotification } from '../../types/airguard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    notificationService.getSettings()
  );
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [history, setHistory] = useState<AQINotification[]>([]);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(notificationService.getSettings());
      setHistory(notificationService.getNotificationHistory());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    }
  }, [isOpen]);

  const handleToggle = () => {
    const updated = notificationService.setSettings({ enabled: !settings.enabled });
    setSettings(updated);

    // If turned ON and permission is default, ask for permission
    if (updated.enabled && permission === 'default') {
      handleRequestPermission();
    }
  };

  const handleRequestPermission = async () => {
    const res = await notificationService.requestPermission();
    setPermission(res);
  };

  const handleSendTest = () => {
    notificationService.triggerTestNotification();
    setHistory(notificationService.getNotificationHistory());
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  const handleClearHistory = () => {
    notificationService.clearNotificationHistory();
    setHistory([]);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-[#071A24] border border-[#263238] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#263238] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#0F766E]/25 text-[#5EEAD4] border border-[#0F766E]/40">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-sm font-bold text-white">
                App Settings & Preferences
              </h2>
              <p className="text-[10px] text-slate-400">AQI alerts and telemetry controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close settings"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Main Setting: AQI Notifications [ON / OFF] */}
          <div className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-3 shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    settings.enabled
                      ? 'bg-[#0F766E]/30 text-[#5EEAD4] border border-[#0F766E]/50'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {settings.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">AQI Change Notifications</h3>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Alerts you when the real AQI changes significantly or crosses into a different category.
                  </p>
                </div>
              </div>

              {/* iOS / Mobile Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.enabled ? 'bg-[#06B6D4]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    settings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Status explanation */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Status:</span>
                <span
                  className={`font-semibold font-mono ${
                    settings.enabled ? 'text-[#5EEAD4]' : 'text-slate-400'
                  }`}
                >
                  {settings.enabled ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                </span>
              </div>

              {/* Anti-spam rule explanation */}
              <div className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Shield className="w-3 h-3 text-[#06B6D4]" />
                  <span>Notification Anti-Spam Rules:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1 leading-snug">
                  <li>Small fluctuations (e.g. AQI 72 → 73) do not trigger alerts.</li>
                  <li>Triggers only when AQI changes by ≥ 12 points or category changes.</li>
                  <li>Reopening the app never creates duplicate notifications.</li>
                </ul>
              </div>

              {/* Browser permission prompt if needed */}
              {settings.enabled && permission === 'default' && (
                <div className="p-2.5 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/30 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-300">
                    Enable browser notification dialogs:
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestPermission}
                    className="py-1 px-2.5 rounded-lg bg-[#0F766E] hover:bg-[#0F766E]/80 text-white font-semibold text-[10px] transition-colors"
                  >
                    Enable
                  </button>
                </div>
              )}

              {settings.enabled && permission === 'denied' && (
                <p className="text-[10px] text-[#F59E0B] leading-tight">
                  System notification permission was denied in your browser settings. In-app banner alerts will be displayed while using the app.
                </p>
              )}
            </div>

            {/* Test alert trigger */}
            {settings.enabled && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testSent}
                  className="w-full py-2 px-3 rounded-xl bg-[#071A24] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-[#5EEAD4]" />
                  <span>{testSent ? '✓ Test Alert Sent' : 'Send Test Notification'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Stored Alert Log */}
          <div className="p-4 rounded-2xl bg-[#09212D] border border-[#263238] space-y-2.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                Recent Alert Log ({history.length})
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[10px] text-slate-400 hover:text-[#EF4444] flex items-center gap-1 font-semibold transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Log</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#071A24] text-center text-slate-400 text-xs border border-slate-800">
                No AQI change alerts triggered yet. Notifications will appear here when real Open-Meteo readings shift.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#071A24] border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-white">{item.title}</span>
                      <span className="font-mono text-slate-400">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">{item.message}</p>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-slate-400 pt-0.5">
                      <span>{item.locationName}</span>
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

          {/* Data Source Notice */}
          <div className="p-3 rounded-2xl bg-[#071A24] border border-slate-800 text-[10px] text-slate-400 space-y-1">
            <span className="font-semibold text-slate-300 block">Verified Open-Meteo Feed:</span>
            <p className="leading-relaxed">
              AirGuard uses verified Open-Meteo European and US Air Quality numerical forecasts. Historical records are preserved in your local session.
            </p>
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
