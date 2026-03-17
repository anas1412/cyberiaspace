import React, { useState, useEffect } from 'react';

export const Clock: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000); // Update every second for precision

    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  }).toUpperCase();

  return (
    <div className="h-[48px] px-5 glass rounded-2xl border border-white/5 flex items-center justify-center pointer-events-auto">
      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">
        {timeString}
      </span>
    </div>
  );
};

export const DatePill: React.FC = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000 * 60 * 60); // Update hourly
    return () => clearInterval(timer);
  }, []);

  const dateString = now.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: '2-digit' 
  }).toUpperCase();

  return (
    <div className="h-[48px] px-5 glass rounded-2xl border border-white/5 flex items-center justify-center pointer-events-auto">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {dateString}
      </span>
    </div>
  );
};
