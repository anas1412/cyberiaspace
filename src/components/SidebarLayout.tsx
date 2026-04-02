import React, { type ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarLayoutProps {
  header: ReactNode;
  filterBar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({ 
  header, 
  filterBar,
  children,
  className 
}) => {
  return (
    <div className={cn(
      "w-full md:w-[260px] min-h-[200px] md:min-h-0 glass rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl bg-[var(--bg-page)]/60 backdrop-blur-md",
      className
    )}>
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-[var(--glass-border)]">
        {header}
      </div>
      
      {/* Filter Bar (optional) */}
      {filterBar}
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scroll">
        {children}
      </div>
    </div>
  );
};

export default SidebarLayout;