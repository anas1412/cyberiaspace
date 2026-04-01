import React from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useModalStore } from '../store/useModalStore';
import { AlertTriangle, HardDrive, ArrowUpRight } from 'lucide-react';

interface QuotaResolverProps {
  guestSpaces: number;
  cloudSpaces: number;
}

export const QuotaResolver: React.FC<QuotaResolverProps> = ({ guestSpaces, cloudSpaces }) => {
  const { getLimits, migrateGuestSpaces, discardGuestSpaces } = useStore();
  const { closeModal } = useModalStore();
  const { user } = useAuthStore();
  
  const limits = getLimits();
  const limit = limits.MAX_SPACES;
  const total = guestSpaces + cloudSpaces;
  const isExceeded = total > limit;

  const handleMigrate = async () => {
    if (user?.id) {
       await migrateGuestSpaces(user.id);
       closeModal();
    }
  };

  const handleDiscard = async () => {
    await discardGuestSpaces();
    closeModal();
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 p-3 rounded-full bg-indigo-500/10 text-indigo-400">
        {isExceeded ? <AlertTriangle className="w-8 h-8" /> : <HardDrive className="w-8 h-8" />}
      </div>
      
      <h2 className="text-xl font-bold text-white mb-2">
        {isExceeded ? "Space Limit Reached" : "Guest Data Detected"}
      </h2>
      
      <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs leading-relaxed">
        {isExceeded 
          ? `You have ${guestSpaces} guest spaces, but adding them would exceed your limit of ${limit} spaces. Upgrade to Pro to keep everything.`
          : `We found ${guestSpaces} local guest spaces on this device. Would you like to migrate them to your account?`
        }
      </p>

      <div className="flex flex-col w-full gap-3">
        {isExceeded ? (
          // Scenario B: Exceeded Quota
          <>
            <button
              onClick={() => { closeModal(); window.location.href = '/pricing'; }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              Upgrade to Pro
            </button>
            
            <button
              onClick={handleDiscard}
              className="w-full py-3.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors border border-red-500/20"
            >
              Discard Guest Data
            </button>
            
            <button
              onClick={closeModal}
              className="w-full py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-dimmed)] transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          // Scenario A: Within Quota
          <>
            <button
              onClick={handleMigrate}
              className="w-full py-3.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[var(--accent-glow)]"
            >
              Migrate Spaces to Account
            </button>
            
            <button
              onClick={handleDiscard}
              className="w-full py-3.5 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest rounded-xl transition-colors border border-red-500/20"
            >
              Discard Guest Data
            </button>
            
            <button
              onClick={closeModal}
              className="w-full py-2 text-[10px] uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-dimmed)] transition-colors"
            >
              Close (Keep Local)
            </button>
          </>
        )}
      </div>
    </div>
  );
};
