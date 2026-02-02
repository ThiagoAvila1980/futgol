import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface PreloaderProps {
  fullScreen?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  overlay?: boolean;
}

export const Preloader: React.FC<PreloaderProps> = ({ 
  fullScreen = false, 
  className, 
  size = 'lg',
  text,
  overlay = false
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-24 h-24'
  };

  const containerClasses = cn(
    "flex flex-col items-center justify-center",
    fullScreen && "fixed inset-0 z-50 bg-navy-900",
    overlay && !fullScreen && "absolute inset-0 z-40 bg-navy-900/50 backdrop-blur-sm rounded-lg transition-all duration-300 animate-in fade-in",
    className
  );

  return (
    <div className={containerClasses}>
      <style>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 3s linear infinite;
        }
      `}</style>
      <div className="relative flex items-center justify-center">
        {/* Outer Glow Ring */}
        <div className={cn(
          "absolute rounded-full border-4 border-t-green-500 border-r-transparent border-b-green-500/30 border-l-transparent animate-spin",
          size === 'sm' ? 'w-10 h-10' : size === 'md' ? 'w-16 h-16' : 'w-28 h-28'
        )} />
        
        {/* Inner Counter-Rotating Ring */}
        <div className={cn(
          "absolute rounded-full border-2 border-t-transparent border-r-white/20 border-b-transparent border-l-white/20 animate-spin-reverse",
          size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-14 h-14' : 'w-24 h-24'
        )} style={{ animationDuration: '2s', animationDirection: 'reverse' }} />

        {/* Center Soccer Ball Icon */}
        <div className={cn(
          "relative flex items-center justify-center animate-pulse",
          sizeClasses[size]
        )}>
          <svg 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full text-white drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]"
          >
            <path 
              d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM19.46 16.5L16.24 13.97L15.34 18.29L19.46 16.5ZM17.2 7.76L13.88 9.89L15.34 5.71L17.2 7.76ZM5.91 6.83L8.66 5.71L10.12 9.89L6.8 7.76L5.91 6.83ZM4.54 16.5L8.66 18.29L7.76 13.97L4.54 16.5ZM12 13C11.45 13 11 12.55 11 12C11 11.45 11.45 11 12 11C12.55 11 13 11.45 13 12C13 12.55 12.55 13 12 13ZM12 20.08L10.59 15.93L13.41 15.93L12 20.08ZM12 3.92L13.41 8.07L10.59 8.07L12 3.92Z" 
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
      
      {text && (
        <div className="mt-6 text-green-400 font-semibold tracking-wider text-sm uppercase animate-pulse">
          {text}
        </div>
      )}
    </div>
  );
};
