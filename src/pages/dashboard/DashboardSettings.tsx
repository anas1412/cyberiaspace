import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Shield, Lock, LogOut,
  ChevronLeft, Key, Save, CheckCircle, AlertCircle,
  Loader2, Eye, EyeOff
} from 'lucide-react';

interface DashboardSettingsProps {
  onBack: () => void;
  onLogout: () => void;
}

const DashboardSettings: React.FC<DashboardSettingsProps> = ({ onBack, onLogout }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/admin/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const data = await res.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch {
      setPasswordError('Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

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
              <Key className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Admin Key</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">••••••••</span>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-primary)]">Role</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono">••••••••</span>
          </div>
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
          <div className="w-10 h-10 rounded-xl bg-[var(--glass-bg)] flex items-center justify-center">
            <Lock className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Change Password</h2>
            <p className="text-[10px] text-[var(--text-muted)]">Update your admin access key</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-11 px-4 pr-12 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 px-4 pr-12 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-11 px-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
              placeholder="Confirm new password"
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">{passwordError}</p>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-xs">Password changed successfully</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isChangingPassword}
            className="w-full h-12 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 rounded-xl text-white font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-2"
          >
            {isChangingPassword ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Change Password
              </>
            )}
          </button>
        </form>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
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
