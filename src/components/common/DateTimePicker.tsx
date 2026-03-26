import React from 'react';
import { Calendar, Clock, Repeat, MapPin, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Dropdown } from './Dropdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DateTimePickerProps {
  startTime: number | null;
  endTime: number | null;
  isAllDay?: boolean;
  onChange: (updates: { startTime?: number | null; endTime?: number | null; isAllDay?: boolean }) => void;
  disabled?: boolean;
  showReminder?: boolean;
  showRepeat?: boolean;
  showLocation?: boolean;
  reminder?: any[];
  recurrenceRule?: string | null;
  location?: string | null;
  onReminderChange?: (reminders: any[]) => void;
  onRecurrenceChange?: (rule: string | null) => void;
  onLocationChange?: (location: string) => void;
  onDone?: () => void;
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const reminderOptions = [
  { label: 'At time', value: '0' },
  { label: '5 min before', value: '5' },
  { label: '15 min before', value: '15' },
  { label: '30 min before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '1 day before', value: '1440' },
  { label: '1 week before', value: '10080' },
];

const repeatOptions = [
  { label: 'Does not repeat', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly', value: 'FREQ=YEARLY' },
];

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  startTime,
  endTime,
  isAllDay = true,
  onChange,
  disabled,
  showReminder = false,
  showRepeat = false,
  showLocation = false,
  reminder = [],
  recurrenceRule = null,
  location = null,
  onReminderChange,
  onRecurrenceChange,
  onLocationChange,
  onDone,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(() => startTime ? new Date(startTime) : new Date());
  
  const hasAdvancedData = Boolean(
    (location && location.trim().length > 0) || 
    (recurrenceRule && recurrenceRule.trim().length > 0) || 
    (reminder && reminder.length > 0)
  );
  
  const [showAdvanced, setShowAdvanced] = React.useState(hasAdvancedData);
  const [localLocation, setLocalLocation] = React.useState(location || '');
  const [localReminder, setLocalReminder] = React.useState(reminder);
  const [localRepeat, setLocalRepeat] = React.useState(recurrenceRule || '');
  const [hasChanges, setHasChanges] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const pendingRef = React.useRef<{
    startTime?: number | null;
    endTime?: number | null;
    isAllDay?: boolean;
  }>({});

  React.useEffect(() => {
    if (startTime) setViewDate(new Date(startTime));
  }, [startTime]);

  React.useEffect(() => {
    setLocalLocation(location || '');
    setLocalReminder(reminder);
    setLocalRepeat(recurrenceRule || '');
    setHasChanges(false);
    pendingRef.current = {};
    
    if (isOpen) {
      const currentlyHasData = Boolean(
        (location && location.trim().length > 0) || 
        (recurrenceRule && recurrenceRule.trim().length > 0) || 
        (reminder && reminder.length > 0)
      );
      if (currentlyHasData) setShowAdvanced(true);
    }
  }, [isOpen, location, reminder, recurrenceRule]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));

  const selectDate = (day: number, preserveTime = false) => {
    const baseDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, 12, 0, 0, 0);
    if (preserveTime && startTime) {
      const existingDate = new Date(startTime);
      baseDate.setHours(existingDate.getHours(), existingDate.getMinutes());
    }
    const newStartTime = baseDate.getTime();
    pendingRef.current = { ...pendingRef.current, startTime: newStartTime, endTime: newStartTime };
    setHasChanges(true);
    onChange({ startTime: newStartTime, endTime: newStartTime });
  };

  const handleTimeChange = (type: 'start' | 'end', hours: number, minutes: number) => {
    const baseTime = type === 'start' ? startTime : endTime;
    const baseDate = baseTime ? new Date(baseTime) : new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate(), 12, 0, 0, 0);
    baseDate.setHours(hours, minutes, 0, 0);
    if (type === 'start') {
      pendingRef.current = { ...pendingRef.current, startTime: baseDate.getTime(), endTime: startTime || baseDate.getTime() };
      onChange({ startTime: baseDate.getTime(), endTime: startTime || baseDate.getTime() });
    } else {
      pendingRef.current = { ...pendingRef.current, endTime: baseDate.getTime(), startTime: startTime || baseDate.getTime() };
      onChange({ endTime: baseDate.getTime(), startTime: startTime || baseDate.getTime() });
    }
    setHasChanges(true);
  };

  const handleToggleAllDay = () => {
    const newIsAllDay = !isAllDay;
    pendingRef.current = { ...pendingRef.current, isAllDay: newIsAllDay };
    setHasChanges(true);
    onChange({ isAllDay: newIsAllDay });
  };

  const handleLocationChange = (value: string) => {
    setLocalLocation(value);
    setHasChanges(true);
  };

  const handleLocationBlur = () => {
    if (onLocationChange) onLocationChange(localLocation);
  };

  const handleReminderChange = (value: string) => {
    setLocalReminder(value === '0' ? [] : [{ type: 'popup', time: parseInt(value) }]);
    setHasChanges(true);
  };

  const handleRepeatChange = (newValue: string) => {
    setLocalRepeat(newValue);
    setHasChanges(true);
  };

  const handleClear = () => {
    pendingRef.current = { startTime: null, endTime: null };
    setHasChanges(true);
    onChange({ startTime: null, endTime: null });
    setLocalLocation('');
    setLocalReminder([]);
    setLocalRepeat('');
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0); 
    setViewDate(today);
    const newStartTime = today.getTime();
    pendingRef.current = { ...pendingRef.current, startTime: newStartTime, endTime: newStartTime };
    setHasChanges(true);
    onChange({ startTime: newStartTime, endTime: newStartTime });
  };

  const handleDone = () => {
    if (hasChanges) {
      if (onLocationChange && localLocation !== (location || '')) onLocationChange(localLocation);
      if (onReminderChange) onReminderChange(localReminder);
      if (onRecurrenceChange && localRepeat !== (recurrenceRule || '')) onRecurrenceChange(localRepeat === '' ? null : localRepeat);
    }
    if (onDone) onDone();
    setIsOpen(false);
  };

  const isSelected = (day: number) => {
    if (!startTime) return false;
    const d = new Date(startTime);
    return d.getDate() === day && d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
  };

  const formatDisplayValue = () => {
    if (!startTime) return "Set Date";
    const d = new Date(startTime);
    if (isAllDay) return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
    return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return { hours: 12, minutes: 0 };
    const d = new Date(timestamp);
    return { hours: d.getHours(), minutes: d.getMinutes() };
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-xl p-3 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)] font-mono uppercase flex items-center justify-between group transition-all",
          disabled && "opacity-50 cursor-default",
          hasChanges && "ring-1 ring-[var(--accent)]/50"
        )}
      >
        <span className="flex-1 text-center truncate">{formatDisplayValue()}</span>
        <Calendar className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors flex-shrink-0 ml-2" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 right-0 z-[100] glass border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl overflow-y-auto max-h-[480px] custom-scroll"
          >
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="p-1.5 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">
                  {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
                </h4>
                <button onClick={handleNextMonth} className="p-1.5 hover:bg-[var(--glass-border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {weekDays.map(d => (
                  <div key={d} className="text-center text-[8px] font-black uppercase text-[var(--text-muted)] py-1">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
                  const day = i + 1;
                  return (
                    <button
                      key={day}
                      onClick={() => selectDate(day)}
                      className={cn(
                        "w-full aspect-square rounded-lg text-[9px] font-bold transition-all flex items-center justify-center border",
                        isSelected(day)
                          ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_10px_var(--accent-glow)]"
                          : isToday(day)
                            ? "bg-[var(--glass-border)] border-white/20 text-[var(--text-primary)]"
                            : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--glass-border)] hover:text-[var(--text-primary)]"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {!isAllDay && (
              <div className="mt-4 pt-3 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Time</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1 bg-[var(--bg-page)]/20 rounded-lg px-2 py-1.5 border border-[var(--glass-border)]">
                    <span className="text-[7px] font-bold text-[var(--text-muted)] uppercase">From</span>
                    <input
                      type="time"
                      value={`${String(formatTime(startTime).hours).padStart(2, '0')}:${String(formatTime(startTime).minutes).padStart(2, '0')}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number);
                        handleTimeChange('start', h, m);
                      }}
                      className="bg-transparent text-[10px] font-mono text-[var(--text-primary)] outline-none w-full"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-[var(--bg-page)]/20 rounded-lg px-2 py-1.5 border border-[var(--glass-border)]">
                    <span className="text-[7px] font-bold text-[var(--text-muted)] uppercase">To</span>
                    <input
                      type="time"
                      value={`${String(formatTime(endTime).hours).padStart(2, '0')}:${String(formatTime(endTime).minutes).padStart(2, '0')}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(':').map(Number);
                        handleTimeChange('end', h, m);
                      }}
                      className="bg-transparent text-[10px] font-mono text-[var(--text-primary)] outline-none w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-[var(--glass-border)] space-y-3">
              <button
                onClick={handleToggleAllDay}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all",
                  isAllDay
                    ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-secondary)]"
                    : "bg-[var(--bg-page)]/10 border-[var(--glass-border)] text-slate-400 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold uppercase tracking-wider">All Day</span>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full transition-all relative",
                  isAllDay ? "bg-[var(--accent)]" : "bg-[var(--glass-border)]"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                    isAllDay ? "left-4" : "left-0.5"
                  )} />
                </div>
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-3 py-2 bg-[var(--bg-page)]/10 border border-[var(--glass-border)] rounded-lg text-slate-400 hover:text-white transition-all"
              >
                <span className="text-[9px] font-bold uppercase tracking-wider">Advanced</span>
                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-90")} />
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                    exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                    className="space-y-3"
                  >
                    {showLocation && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Location</span>
                        </div>
                        <input
                          type="text"
                          value={localLocation}
                          onChange={(e) => handleLocationChange(e.target.value)}
                          onBlur={handleLocationBlur}
                          placeholder="Add location..."
                          className="w-full bg-[var(--bg-page)]/20 border border-[var(--glass-border)] rounded-lg px-3 py-2 text-[10px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
                        />
                      </div>
                    )}
                    {showRepeat && (
                      <Dropdown value={localRepeat} options={repeatOptions} onChange={handleRepeatChange} label="Repeat" icon={<Repeat className="w-3 h-3" />} />
                    )}
                    {showReminder && (
                      <Dropdown value={localReminder.length > 0 ? String(localReminder[0]?.time || '0') : '0'} options={reminderOptions} onChange={handleReminderChange} label="Reminder" icon={<Bell className="w-3 h-3" />} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={handleClear} className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-red-300 transition-all mt-3">
                Clear Date
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--glass-border)] flex gap-2">
              <button onClick={handleToday} className="flex-1 py-2 bg-[var(--accent)]/20 hover:bg-[var(--accent)]/30 text-[var(--accent-secondary)] rounded-lg text-[8px] font-black uppercase tracking-widest transition-all">
                Today
              </button>
              <button
                onClick={handleDone}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                  hasChanges
                    ? "bg-[var(--accent)] text-[var(--bg-main)] shadow-[0_0_15px_var(--accent-glow)]"
                    : "bg-[var(--glass-border)]/50 text-[var(--text-muted)]"
                )}
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateTimePicker;