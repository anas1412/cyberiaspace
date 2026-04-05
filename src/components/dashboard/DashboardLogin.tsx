import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, XCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const DashboardLogin: React.FC = () => {
  const { status, user } = useAuthStore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (status !== 'authenticated' || !user) {
        setIsChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/dashboard?action=verify');
        const data = await res.json();
        setIsAdmin(data.isAdmin === true);
      } catch (err) {
        console.error('[Dashboard] Admin check failed:', err);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAdmin();
  }, [status, user]);

  const handleBack = () => {
    window.location.href = '/';
  };

  const handleLogin = () => {
    window.location.href = '/login';
  };

  // Still checking admin status
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-[10002] bg-[var(--bg-page)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <button
            onClick={handleBack}
            className="mb-8 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-semibold tracking-widest">Back to App</span>
          </button>

          <div className="glass p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--accent)]" />
            <p className="text-[12px] text-[var(--text-muted)]">Checking admin access...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // User is authenticated and is admin - redirect to dashboard
  if (status === 'authenticated' && isAdmin === true) {
    window.location.href = '/dashboard';
    return null;
  }

  // User is authenticated but not admin
  if (status === 'authenticated' && user && isAdmin === false) {
    return (
      <div className="fixed inset-0 z-[10002] bg-[var(--bg-page)] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md"
        >
          <button
            onClick={handleBack}
            className="mb-8 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-semibold tracking-widest">Back to App</span>
          </button>

          <div className="glass p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-500/20">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                Access Denied
              </h1>
              <p className="text-[12px] text-[var(--text-muted)]">
                You're logged in as <strong>{user.email}</strong> but you don't have admin privileges.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleBack}
                className="w-full py-3.5 text-sm font-medium tracking-widest
                         bg-white/5 rounded-xl text-[var(--text-primary)]
                         hover:bg-white/10 transition-all"
              >
                Go to App
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Not authenticated - show login
  return (
    <div className="fixed inset-0 z-[10002] bg-[var(--bg-page)] flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'var(--accent)' }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
          style={{ background: 'var(--accent-secondary)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <button
          onClick={handleBack}
          className="mb-8 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-semibold tracking-widest">Back to App</span>
        </button>

        <div className="glass p-8 rounded-2xl border border-[var(--glass-border)] shadow-2xl">
          <div className="text-center mb-8">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'var(--accent)' }}
            >
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              Admin Dashboard
            </h1>
            <p className="text-[12px] text-[var(--text-muted)]">
              Sign in to your Cyberia account to access the admin dashboard
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-4 text-sm font-medium tracking-widest
                     bg-[var(--accent)] text-white rounded-xl
                     hover:bg-[var(--accent-secondary)] transition-all
                     flex items-center justify-center gap-3"
          >
            Sign In
          </button>
        </div>

        <p className="text-center text-[10px] text-[var(--text-muted)] mt-6">
          Only admin users can access the dashboard
        </p>
      </motion.div>
    </div>
  );
};

export default DashboardLogin;
