import React, { useState } from 'react';
import officialLogoImg from '../../assets/images/airguard_app_icon_1790841043945.jpg';

interface AirGuardLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
}

export const AirGuardLogo: React.FC<AirGuardLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const dimensionClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      <div
        className={`${dimensionClasses[size]} relative shrink-0 rounded-2xl overflow-hidden shadow-lg shadow-[#06B6D4]/15 bg-[#071A24] border border-[#263238] flex items-center justify-center`}
      >
        {!imageError ? (
          <img
            src={officialLogoImg}
            alt="Official AirGuard Logo"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Exact Vector Reproduction of the Official AirGuard Logo */
          <svg
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <rect width="200" height="200" rx="40" fill="#0A141D" />
            <defs>
              <linearGradient id="shieldBorder" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22C55E" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#0284C7" />
              </linearGradient>
              <linearGradient id="cloudGrad" x1="40" y1="90" x2="160" y2="90" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="35%" stopColor="#E2E8F0" />
                <stop offset="70%" stopColor="#F8FAFC" />
                <stop offset="100%" stopColor="#BAE6FD" />
              </linearGradient>
              <linearGradient id="leafGlow" x1="85" y1="110" x2="115" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#15803D" />
                <stop offset="60%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>
            </defs>

            {/* Glowing Shield Contour */}
            <path
              d="M100 24 C135 24 168 38 168 38 C168 115 100 176 100 176 C100 176 32 115 32 38 C32 38 65 24 100 24 Z"
              stroke="url(#shieldBorder)"
              strokeWidth="7"
              strokeLinejoin="round"
              fill="#061A28"
            />

            {/* Particulate Matter Influx (Grey Dots on Left) */}
            <circle cx="16" cy="85" r="3.5" fill="#64748B" />
            <circle cx="28" cy="74" r="4.5" fill="#475569" />
            <circle cx="24" cy="98" r="4" fill="#64748B" />
            <circle cx="18" cy="110" r="3" fill="#475569" />

            {/* Central Cloud Body */}
            <path
              d="M55 110 C46 110 38 102 38 92 C38 83 45 76 54 75 C56 62 68 52 82 52 C94 52 105 59 110 70 C114 67 120 65 126 65 C139 65 150 75 151 88 C158 89 164 96 164 104 C164 113 157 120 148 120 L55 120 Z"
              fill="url(#cloudGrad)"
            />

            {/* Dark Skyline at base */}
            <path
              d="M50 148 L50 130 L60 130 L60 124 L68 124 L68 138 L76 138 L76 118 L84 118 L84 148 L96 148 L96 122 L102 114 L108 122 L108 148 L120 148 L120 128 L128 128 L128 148 Z"
              fill="#081824"
              opacity="0.95"
            />

            {/* Central Circle with Leaf */}
            <circle cx="100" cy="94" r="22" fill="#071A24" stroke="#0F766E" strokeWidth="3" />
            <path
              d="M100 80 C110 84 114 96 102 106 C92 98 94 86 100 80 Z"
              fill="url(#leafGlow)"
            />
            <path d="M100 82 C100 92 101 101 102 106" stroke="#071A24" strokeWidth="1.5" strokeLinecap="round" />

            {/* Clean Airflow Wind Trails on Right */}
            <path
              d="M136 100 C155 100 170 88 190 92"
              stroke="#38BDF8"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M142 110 C160 110 172 100 192 104"
              stroke="#06B6D4"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M134 120 C150 120 162 112 184 116"
              stroke="#5EEAD4"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`${textSizes[size]} font-bold tracking-tight text-[#F8FAFC]`}>
              Air<span className="text-[#06B6D4]">Guard</span>
            </span>
            <span className="text-[10px] uppercase font-mono font-semibold tracking-wider px-1.5 py-0.5 rounded bg-[#0F766E]/30 text-[#5EEAD4] border border-[#0F766E]/50">
              AI
            </span>
          </div>
          <span className="text-[10px] tracking-wide text-slate-400 font-medium mt-1">
            Intelligent Air Quality Protection
          </span>
        </div>
      )}
    </div>
  );
};
