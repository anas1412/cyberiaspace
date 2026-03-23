import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'default' | 'accent' | 'warning' | 'success';
}

const colorStyles = {
  default: 'from-white/5 to-white/5 border-[var(--glass-border)]',
  accent: 'from-[var(--accent)]/20 to-transparent border-[var(--accent)]/30',
  warning: 'from-amber-500/20 to-transparent border-amber-500/30',
  success: 'from-emerald-500/20 to-transparent border-emerald-500/30',
};

const iconColorStyles = {
  default: 'text-[var(--text-primary)]',
  accent: 'text-[var(--accent)]',
  warning: 'text-amber-400',
  success: 'text-emerald-400',
};

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  trend,
  color = 'default',
}) => {
  return (
    <div
      className={cn(
        'glass rounded-2xl p-5 border bg-gradient-to-br',
        colorStyles[color]
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center bg-white/5',
            iconColorStyles[color]
          )}
        >
          {icon}
        </div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider',
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-[var(--text-primary)]">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </div>
  );
};

export default StatsCard;
