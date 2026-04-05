import React from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, LogOut,
  ChevronLeft
} from 'lucide-react';

interface DashboardSettingsProps {
  onBack: () => void;
  onLogout: () => void;
}

const DashboardSettings: React.FC<DashboardSettingsProps> = ({ onBack, onLogout }) => {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Settings</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Manage your admin account</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 border border-[var(--glass-border)]"
      >
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--glass-border)]">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Admin Account</h2>
            <p className="text-sm text-[var(--text-muted)]">Superuser access to Cyberia</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Role</span>
            </div>
            <span className="px-3 py-1 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest border border-purple-500/30">
              Super Admin
            </span>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-6 border border-[var(--glass-border)]"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Sign Out</h2>
            <p className="text-[10px] text-[var(--text-muted)]">End your admin session</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out of Admin Panel
        </button>
      </motion.div>
    </div>
  );
};

export default DashboardSettings;
