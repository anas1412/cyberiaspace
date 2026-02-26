import React from 'react';
import { Maximize2, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UnifiedMediaCardProps {
  children: React.ReactNode;
  typeLabel: string;
  overlayIcon?: React.ReactNode;
  isSyncing?: boolean;
  dataTrigger?: string;
  className?: string;
}

export const UnifiedMediaCard: React.FC<UnifiedMediaCardProps> = ({
  children,
  typeLabel,
  overlayIcon,
  isSyncing,
  dataTrigger = "media",
  className
}) => {
  return (
    <div 
      data-trigger={dataTrigger} 
      className={cn(
        "mt-2 relative group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/50 aspect-video flex items-center justify-center",
        className
      )}
    >
      {children}

      {overlayIcon && !isSyncing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
            {overlayIcon}
          </div>
        </div>
      )}

      {isSyncing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-blue-500/5 backdrop-blur-[2px]">
          <div className="relative">
            <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
            <div className="absolute inset-0 bg-blue-400/20 blur-md rounded-full animate-pulse" />
          </div>
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-400/80">Securing to Cloud</span>
        </div>
      )}

      <div className={cn(
        "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition-opacity",
        (!isSyncing) ? "opacity-0 group-hover:opacity-100" : "opacity-0"
      )}>
        <Maximize2 className="w-6 h-6 text-white" />
        <span className="text-[8px] font-black uppercase tracking-widest text-white/80">View Asset</span>
      </div>
      
      {/* Type Badge */}
      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[7px] font-black text-white/60 uppercase tracking-widest">
        {typeLabel}
      </div>
    </div>
  );
};
