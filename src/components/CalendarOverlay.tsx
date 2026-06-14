import React, { useRef, useMemo } from 'react';
/** CalendarOverlay component provides month, week, and agenda views of thoughts */
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { sanitizeDate } from '../utils/date';
import type { Thought } from '../db';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Get Monday 00:00 of the week containing `date` */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get 7 dates from Monday to Sunday */
function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Format a date string for agenda section headers */
function formatAgendaDateHeader(dateStr: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');

  if (dateStr === todayStr) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Format date string as "Jan 14" */
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format a numeric timestamp as a time string like "2:30 PM" */
function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  // Only show time if it's not midnight (00:00) — assumes all-day events don't set time
  if (d.getHours() === 0 && d.getMinutes() === 0) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

const CalendarOverlay: React.FC = () => {
  const activeSpaceId = useStore((s) => s.activeSpaceId);
  const spaces = useStore((s) => s.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const calDate = useStore((s) => s.calendarViewDate);
  const calViewMode = useStore((s) => s.calendarViewMode);
  const setCalDate = useStore((s) => s.setCalendarViewDate);
  const setCalViewMode = useStore((s) => s.setCalendarViewMode);
  const setHoveredDate = useStore((s) => s.setHoveredCalDate);
  const clearSelection = useStore((s) => s.clearSelection);
  const selectedThoughtId = useStore((s) => s.selectedThoughtId);
  const setSelectedThoughtId = useStore((s) => s.setSelectedThoughtId);
  const setInspectorOpen = useStore((s) => s.setInspectorOpen);
  const isDemo = useStore((s) => s.isDemo);
  const allThoughts = useStore((s) => s.thoughts);

  // Clean timer ref — replaces window._calLeaveTimer
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build date-to-thoughts map for counting/previewing
  const thoughtDateMap = useMemo(() => {
    const map = new Map<string, Thought[]>();
    allThoughts.forEach((t) => {
      if (t.deletedAt) return;
      const dateStr = sanitizeDate(t.startTime);
      if (dateStr) {
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)!.push(t);
      }
    });
    // Sort by layer within each date
    map.forEach((list) => list.sort((a, b) => (a.layer || 0) - (b.layer || 0)));
    return map;
  }, [allThoughts]);

  if (activeSpace?.mode !== 'calendar') return null;

  const todayStr = new Date().toLocaleDateString('en-CA');

  // ─── Event Handlers ────────────────────────────────

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('cal-grid')) {
      clearSelection();
    }
  };

  /** Clean ref-based hover timer — no window globals */
  const handleDateMouseEnter = (date: string) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    setHoveredDate(date);
  };

  const handleDateMouseLeave = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      setHoveredDate(null);
    }, 150);
  };

  const handleNav = (dir: number) => {
    const newDate = new Date(calDate);
    if (calViewMode === 'week') {
      newDate.setDate(newDate.getDate() + dir * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + dir);
    }
    setCalDate(newDate);
  };

  const goToToday = () => {
    setCalDate(new Date());
  };

  // ─── Header ────────────────────────────────────────

  const getHeaderTitle = () => {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    if (calViewMode === 'month' || calViewMode === 'agenda') {
      return new Date(y, m).toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    const weekStart = getWeekStart(calDate);
    return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  // ─── Month Grid ────────────────────────────────────

  const renderMonthView = () => {
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const firstDay = new Date(y, m, 1).getDay() || 7; // Mon=1 … Sun=7
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const cells: React.ReactNode[] = [];

    // Padding cells before the 1st
    for (let i = 1; i < firstDay; i++) {
      cells.push(<div key={`pad-${i}`} className="cal-cell-empty" />);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(y, m, d);
      const dateStr = dateObj.toLocaleDateString('en-CA');
      const isToday = dateStr === todayStr;
      const thoughtsForDate = thoughtDateMap.get(dateStr) || [];
      const MAX_VISIBLE = 3;
      const overflowCount = thoughtsForDate.length > MAX_VISIBLE ? thoughtsForDate.length - MAX_VISIBLE : 0;

      cells.push(
        <div
          key={d}
          className={cn(
            'cal-cell border-r border-b border-[var(--glass-border)] relative transition-colors min-h-[100px] p-2',
            isToday && 'bg-[var(--accent)]/[0.05]'
          )}
          data-date={dateStr}
          onMouseEnter={() => handleDateMouseEnter(dateStr)}
          onMouseLeave={handleDateMouseLeave}
        >
          <span
            className={cn(
              'cal-date-num text-[11px] font-semibold',
              isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            )}
          >
            {d}
          </span>
          {/* Overflow indicator — actual thought nodes are physics-positioned */}
          {overflowCount > 0 && (
            <div className="absolute bottom-1 right-2">
              <button
                className="text-[9px] font-semibold text-[var(--accent)] hover:text-[var(--accent-secondary)] transition-colors"
                onMouseEnter={() => handleDateMouseEnter(dateStr)}
              >
                +{overflowCount}
              </button>
            </div>
          )}
        </div>
      );
    }

    // Fill remaining grid cells to keep the grid even
    const totalCells = cells.length;
    const remainder = totalCells % 7;
    if (remainder > 0) {
      for (let i = 0; i < 7 - remainder; i++) {
        cells.push(<div key={`pad-end-${i}`} className="cal-cell-empty" />);
      }
    }

    return (
      <div
        className="cal-grid grid grid-cols-7 auto-rows-[minmax(100px,1fr)] h-full overflow-y-auto custom-scroll min-w-[300px]"
        onClick={handleBackgroundClick}
      >
        {DAYS_SHORT.map((day) => (
          <div
            key={day}
            className="cal-day-label flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] uppercase border-b border-[var(--glass-border)] h-[30px]"
          >
            {day}
          </div>
        ))}
        {cells}
      </div>
    );
  };

  // ─── Week Columns (kanban-style vertical stacking) ─

  const renderWeekView = () => {
    const weekStart = getWeekStart(calDate);
    const weekDates = getWeekDates(weekStart);

    return (
      <div
        id="cal-week-content"
        className="flex-1 flex relative"
        onClick={handleBackgroundClick}
      >
        {weekDates.map((dateObj) => {
          const dateStr = dateObj.toLocaleDateString('en-CA');
          const isToday = dateStr === todayStr;
          const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
          const dayName = DAYS_SHORT[dayIndex];
          const dayNum = dateObj.getDate();

          return (
            <div
              key={dateStr}
              className={cn(
                'cal-cell flex-1 flex flex-col relative min-h-[200px]',
                'border-r last:border-r-0 border-[var(--glass-border)]',
                isToday && 'bg-[var(--accent)]/[0.05]'
              )}
              data-date={dateStr}
              onMouseEnter={() => handleDateMouseEnter(dateStr)}
              onMouseLeave={handleDateMouseLeave}
            >
              {/* Sticky day column header */}
              <div className="sticky top-0 z-10 bg-[var(--bg-main)]/80 backdrop-blur-sm border-b border-[var(--glass-border)]">
                <div className="text-center py-3">
                  <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase">{dayName}</div>
                  <div
                    className={cn(
                      'text-sm font-bold mt-0.5',
                      isToday ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                    )}
                  >
                    {dayNum}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Spacer provides height reference for physics-positioned cards (absolute, no DOM scroll) */}
        <div id="cal-week-spacer" className="absolute left-0 top-0 pointer-events-none" style={{ width: '1px' }} />
      </div>
    );
  };

  // ─── Agenda List ───────────────────────────────────

  const renderAgendaView = () => {
    // Filter entries to only the month shown in the header
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const monthStart = `${y}-${String(m + 1).padStart(2, '0')}`;

    const entries = Array.from(thoughtDateMap.entries())
      .filter(([dateStr]) => dateStr && dateStr.startsWith(monthStart))
      .sort(([a], [b]) => a.localeCompare(b));

    if (entries.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
          No scheduled thoughts this month
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto custom-scroll p-4 md:p-6 space-y-6">
        {entries.map(([dateStr, thoughts]) => (
          <div key={dateStr}>
            <h3 className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider mb-2 sticky top-0 bg-[var(--bg-page)] py-1 z-10">
              {formatAgendaDateHeader(dateStr)}
            </h3>
            <div className="space-y-1">
              {thoughts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedThoughtId(t.id);
                    setInspectorOpen(true);
                  }}
                  className={cn(
                    'w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl transition-colors',
                    selectedThoughtId === t.id
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'hover:bg-[var(--glass-bg)] text-[var(--text-primary)]'
                  )}
                >
                  <span className="text-[9px] font-bold uppercase text-[var(--text-muted)] min-w-[32px]">
                    {t.type}
                  </span>
                  {t.startTime && formatTime(t.startTime) && (
                    <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap min-w-[54px]">
                      {formatTime(t.startTime)}
                    </span>
                  )}
                  <span className="flex-1 text-[13px] truncate">
                    {t.text || 'Untitled'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                    {formatDateShort(dateStr)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────

  return (
    <div
      className={cn(
        'calendar-overlay inset-0 flex flex-col md:flex-row pointer-events-auto p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5 opacity-100 transition-opacity duration-400 z-[10] overflow-y-auto md:overflow-hidden',
        isDemo ? 'absolute' : 'fixed'
      )}
      onClick={handleBackgroundClick}
      onMouseEnter={handleDateMouseLeave}
    >
      {/* Sidebar — hidden in agenda view (no physics positioning needed) */}
      {calViewMode !== 'agenda' && (
        <div
          className="cal-sidebar w-full md:w-[260px] min-h-[200px] md:min-h-0 rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl"
          style={{ background: 'var(--bg-page)' }}
          onMouseEnter={() => handleDateMouseEnter('')}
          onMouseLeave={handleDateMouseLeave}
        >
          <div className="cal-sidebar-header p-4 md:p-5 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] z-[40] sticky top-0 shadow-[var(--shadow-elevation-2)]">
            Unscheduled
          </div>
          <div
            id="cal-sidebar-content"
            className="cal-sidebar-content flex-1 overflow-y-auto overflow-x-hidden relative p-4 md:p-5 custom-scroll"
          >
            <div id="cal-sidebar-spacer" style={{ height: '0px' }} />
          </div>
        </div>
      )}

      {/* Main panel */}
      <div
        className="cal-main flex-1 flex flex-col min-h-[400px] md:min-h-0 glass backdrop-blur-xl rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl"
        onMouseEnter={handleDateMouseLeave}
      >
        {/* ─── Header bar ────────────────────────────── */}
        <div className="cal-header h-[50px] md:h-[60px] flex items-center justify-between px-4 md:px-[30px] border-b border-[var(--glass-border)] bg-[var(--glass-bg)] gap-2">
          {/* Left: nav + title */}
          <div className="flex items-center gap-1 md:gap-2 min-w-0">
            <button
              onClick={() => handleNav(-1)}
              className="p-2 hover:bg-[var(--text-primary)]/10 rounded-xl text-[var(--text-muted)] transition-colors shrink-0"
              aria-label="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="cal-title text-sm md:text-base font-bold text-[var(--text-primary)] whitespace-nowrap truncate">
              {getHeaderTitle()}
            </span>
            <button
              onClick={() => handleNav(1)}
              className="p-2 hover:bg-[var(--text-primary)]/10 rounded-xl text-[var(--text-muted)] transition-colors shrink-0"
              aria-label="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Today + view pills */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={goToToday}
              className="px-2.5 md:px-3 py-1.5 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 rounded-xl transition-colors"
            >
              Today
            </button>

            {/* View mode pills — matches ViewSwitcher pill pattern */}
            <div className="flex items-center h-[32px] p-0.5 glass rounded-xl border border-[var(--glass-border)]">
              {(['month', 'week', 'agenda'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCalViewMode(mode)}
                  className={cn(
                    'px-2.5 h-full rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200',
                    calViewMode === mode
                      ? 'bg-[var(--bg-page)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Content area ──────────────────────────── */}
        {calViewMode === 'month' && renderMonthView()}
        {calViewMode === 'week' && renderWeekView()}
        {calViewMode === 'agenda' && renderAgendaView()}
      </div>
    </div>
  );
};

export default CalendarOverlay;
