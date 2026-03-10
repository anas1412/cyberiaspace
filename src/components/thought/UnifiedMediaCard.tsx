import React from 'react';
import { Maximize2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UnifiedMediaCardProps {
  children: React.ReactNode;
  typeLabel: string;
  overlayIcon?: React.ReactNode;
  dataTrigger?: string;
  className?: string;
}

export const UnifiedMediaCard: React.FC<UnifiedMediaCardProps> = ({
  children,
  typeLabel,
  overlayIcon,
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

      {overlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-xl bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
            {overlayIcon}
          </div>
        </div>
      )}

      <div className={cn(
        "absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 transition-opacity",
        "opacity-0 group-hover:opacity-100"
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
