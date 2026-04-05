import React from 'react';
/** CalendarOverlay component provides a temporal view of thoughts */
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CalendarOverlay: React.FC = () => {
  const activeSpaceId = useStore((state) => state.activeSpaceId);
  const spaces = useStore((state) => state.spaces);
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const calDate = useStore((state) => state.calendarViewDate);
  const setCalDate = useStore((state) => state.setCalendarViewDate);
  const setHoveredDate = useStore((state) => state.setHoveredCalDate);
  const clearSelection = useStore((state) => state.clearSelection);
  const isDemo = useStore((state) => state.isDemo);

  if (activeSpace?.mode !== 'calendar') return null;


  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('cal-grid')) {
      clearSelection();
    }
  };

  const handleMouseEnter = (date: string) => {
    // Clear any pending leave timers globally
    if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
    setHoveredDate(date);
  };

  const handleMouseLeave = () => {
    if ((window as any)._calLeaveTimer) clearTimeout((window as any)._calLeaveTimer);
    (window as any)._calLeaveTimer = setTimeout(() => {
      setHoveredDate(null);
    }, 150);
  };

  const changeMonth = (dir: number) => {
    const newDate = new Date(calDate);
    newDate.setMonth(newDate.getMonth() + dir);
    setCalDate(newDate);
  };

  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  const monthTitle = new Date(y, m).toLocaleString('default', { month: 'long', year: 'numeric' });
  const firstDay = new Date(y, m, 1).getDay() || 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = new Date().toLocaleDateString('en-CA');

  const days = [];
  for (let i = 1; i < firstDay; i++) {
    days.push(<div key={`pad-${i}`} className="cal-cell-empty" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(y, m, d);
    const dateStr = dateObj.toLocaleDateString('en-CA');
    const isToday = dateStr === todayStr;
    days.push(
      <div 
        key={d} 
        className={cn(
          "cal-cell border-r border-b border-[var(--glass-border)] relative transition-colors min-h-[100px]",
          isToday && "bg-[var(--accent)]/[0.05]"
        )}
        data-date={dateStr}
        onMouseEnter={() => handleMouseEnter(dateStr)}
        onMouseLeave={handleMouseLeave}
      >
        <span className={cn(
          "cal-date-num absolute top-2 right-2 text-[11px] font-600",
          isToday ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
        )}>
          {d}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "calendar-overlay inset-0 flex flex-col md:flex-row pointer-events-auto p-4 md:p-10 pb-[100px] md:pb-[120px] pt-[64px] md:pt-[96px] gap-4 md:gap-5 opacity-100 transition-opacity duration-400 z-[10] overflow-y-auto md:overflow-hidden",
        isDemo ? "absolute" : "fixed"
      )}
      onClick={handleBackgroundClick}
      onMouseEnter={() => handleMouseLeave()}
    >

      {/* Sidebar */}
      <div 
        className="cal-sidebar w-full md:w-[260px] min-h-[200px] md:min-h-0 glass backdrop-blur-xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto z-[30] relative border border-[var(--glass-border)] shadow-2xl"
        onMouseEnter={() => handleMouseEnter('')}
        onMouseLeave={handleMouseLeave}
      >
        <div className="cal-sidebar-header p-4 md:p-5 border-b border-[var(--glass-border)] text-[9px] md:text-[10px] font-black tracking-[0.2em] uppercase text-[var(--accent)] bg-[var(--glass-bg)] z-[40] sticky top-0 shadow-[var(--shadow-elevation-2)]">
          Unscheduled
        </div>
        <div id="cal-sidebar-content" className="cal-sidebar-content flex-1 overflow-y-auto overflow-x-hidden relative p-4 md:p-5 custom-scroll">
          <div id="cal-sidebar-spacer" style={{ height: '0px' }} />
        </div>
      </div>
      
      {/* Main Grid */}
      <div className="cal-main flex-1 flex flex-col min-h-[400px] md:min-h-0 glass backdrop-blur-xl rounded-2xl overflow-hidden pointer-events-auto z-[5] relative border border-[var(--glass-border)] shadow-xl" onMouseEnter={handleMouseLeave}>
        <div className="cal-header h-[50px] md:h-[60px] flex items-center justify-between px-4 md:px-[30px] border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-[var(--text-primary)]/10 rounded-xl text-[var(--text-muted)] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="cal-title text-sm md:text-base font-bold text-[var(--text-primary)]">{monthTitle}</span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-[var(--text-primary)]/10 rounded-xl text-[var(--text-muted)] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <div 
          className="cal-grid grid grid-cols-7 grid-rows-[30px_repeat(5,1fr)] h-full overflow-y-auto custom-scroll min-w-[300px]"
          onClick={handleBackgroundClick}
        >
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="cal-day-label flex items-center justify-center text-[9px] font-bold text-[var(--text-muted)] uppercase border-b border-[var(--glass-border)]">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    </div>
  );
};

export default CalendarOverlay;
