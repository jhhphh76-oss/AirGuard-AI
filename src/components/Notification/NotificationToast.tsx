import React, { useEffect, useState } from 'react';
import { AQINotification } from '../../types/airguard';
import { Bell, TrendingUp, TrendingDown, RefreshCw, X } from 'lucide-react';

interface NotificationToastProps {
  notification: AQINotification | null;
  onDismiss: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 300);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [notification, onDismiss]);

  if (!notification || !isVisible) return null;

  const isImprovement = notification.type === 'improve';
  const isIncrease = notification.type === 'increase';

  return (
    <div className="fixed top-16 left-3 right-3 max-w-md mx-auto z-50 animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div
        className={`p-3.5 rounded-2xl shadow-2xl border backdrop-blur-md flex items-start gap-3 transition-all ${
          isImprovement
            ? 'bg-[#064E3B]/90 border-[#10B981]/50 text-white'
            : isIncrease
            ? 'bg-[#450A0A]/90 border-[#EF4444]/50 text-white'
            : 'bg-[#09212D]/95 border-[#06B6D4]/50 text-white'
        }`}
      >
        <div
          className={`p-2 rounded-xl shrink-0 mt-0.5 ${
            isImprovement
              ? 'bg-[#10B981]/30 text-[#6EE7B7]'
              : isIncrease
              ? 'bg-[#EF4444]/30 text-[#FCA5A5]'
              : 'bg-[#06B6D4]/30 text-[#67E8F9]'
          }`}
        >
          {isImprovement ? (
            <TrendingDown className="w-4 h-4" />
          ) : isIncrease ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <Bell className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1">
            <h4 className="text-xs font-bold leading-tight truncate">{notification.title}</h4>
            <span className="text-[9px] font-mono opacity-70 shrink-0">Just now</span>
          </div>
          <p className="text-[11px] mt-0.5 leading-snug opacity-95 break-words">
            {notification.message}
          </p>
        </div>

        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onDismiss, 200);
          }}
          className="p-1 rounded-lg text-white/60 hover:text-white shrink-0 hover:bg-white/10 transition-colors"
          title="Dismiss alert"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
