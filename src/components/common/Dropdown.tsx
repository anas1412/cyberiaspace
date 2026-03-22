import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DropdownOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  icon?: React.ReactNode;
}

export const Dropdown: React.FC<DropdownProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled,
  label,
  icon,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <div className="flex items-center gap-1.5 mb-1.5">
          {icon && <span className="text-slate-500">{icon}</span>}
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</span>
        </div>
      )}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border transition-all text-left",
          "bg-[var(--bg-page)]/20 border-[var(--glass-border)]",
          "hover:border-[var(--accent)]/50 hover:bg-[var(--bg-page)]/30",
          "focus:border-[var(--accent)] focus:outline-none",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && <span className="text-slate-500 flex-shrink-0">{icon}</span>}
          <span className={cn(
            "text-[10px] font-medium truncate",
            selectedOption ? "text-[var(--text-primary)]" : "text-slate-500"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-[120] glass border border-[var(--glass-border)] rounded-xl shadow-xl overflow-hidden"
          >
            <div className="max-h-[150px] overflow-y-auto custom-scroll py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                    "hover:bg-[var(--accent)]/10",
                    option.value === value && "bg-[var(--accent)]/5"
                  )}
                >
                  {option.icon && <span className="text-slate-500">{option.icon}</span>}
                  <span className={cn(
                    "text-[10px] font-medium flex-1",
                    option.value === value ? "text-[var(--text-primary)]" : "text-slate-400"
                  )}>
                    {option.label}
                  </span>
                  {option.value === value && (
                    <Check className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dropdown;
