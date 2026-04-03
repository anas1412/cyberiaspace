import React from 'react';
import { useStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BotMessageSquare, ChevronRight } from 'lucide-react';
import { PLAN_CONFIG } from '../../constants';

export const AIToggleButton: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isChatOpen = useStore((state) => state.isChatOpen);
  const setChatOpen = useStore((state) => state.setChatOpen);
  
  const limits = PLAN_CONFIG[user?.plan || 'free'];

  const handleToggle = () => {
    if (!user) {
      window.history.pushState({}, '', '/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    if (!limits.AI_ENABLED) {
      window.location.href = '/pricing';
      return;
    }
    setChatOpen(!isChatOpen);
  };

  // Don't render when chat is open - the close button is attached to ChatOverlay
  if (isChatOpen) return null;

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[9999] pointer-events-none">
      <button
        onClick={handleToggle}
        className="
          group relative h-[56px] w-[42px] rounded-r-2xl flex items-center justify-center 
          transition-all duration-300 pointer-events-auto
          bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)]
          hover:text-[var(--text-primary)] hover:w-[46px]
          shadow-lg shadow-[var(--glass-border)]
        "
      >
        {/* Icon */}
        <BotMessageSquare className="w-4 h-4 transition-all duration-300" />
        
        {/* Arrow indicator - hidden until hover */}
        <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0" />

        {/* Tooltip */}
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none whitespace-nowrap z-[10001]">
          <div className="glass px-3 py-1.5 rounded-xl border border-[var(--glass-border)] flex items-center gap-2 shadow-2xl bg-[var(--bg-main)]/90 backdrop-blur-xl">
            <span className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]/90">
              Open Oracle AI
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default AIToggleButton;
