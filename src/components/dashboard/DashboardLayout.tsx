import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { DashboardSidebar } from './DashboardSidebar';
import { useAuthStore } from '../../store/useAuthStore';
import Dashboard from '../../pages/dashboard/Dashboard';
import DashboardUsers from '../../pages/dashboard/DashboardUsers';
import DashboardFeedback from '../../pages/dashboard/DashboardFeedback';
import DashboardSettings from '../../pages/dashboard/DashboardSettings';

type DashboardPage = 'overview' | 'users' | 'feedback' | 'settings';

const DashboardLayout: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<DashboardPage>('overview');
  
  const { user } = useAuthStore();
  const adminEmail = user?.email;

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/dashboard/users')) {
        setCurrentPage('users');
      } else if (path.startsWith('/dashboard/feedback')) {
        setCurrentPage('feedback');
      } else if (path.startsWith('/dashboard/settings')) {
        setCurrentPage('settings');
      } else {
        setCurrentPage('overview');
      }
    };
    
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLogout = () => {
    window.location.href = '/';
  };

  const navigateTo = (page: DashboardPage) => {
    setCurrentPage(page);
    const pathMap: Record<DashboardPage, string> = {
      overview: '/dashboard',
      users: '/dashboard/users',
      feedback: '/dashboard/feedback',
      settings: '/dashboard/settings'
    };
    window.history.pushState({}, '', pathMap[page]);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (!user) {
    return null;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'users':
        return <DashboardUsers onBack={() => navigateTo('overview')} />;
      case 'feedback':
        return <DashboardFeedback onBack={() => navigateTo('overview')} />;
      case 'settings':
        return <DashboardSettings onBack={() => navigateTo('overview')} onLogout={handleLogout} />;
      default:
        return <Dashboard onNavigate={navigateTo} />;
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-page)]">
      <AnimatePresence mode="wait">
        <motion.aside
          initial={{ width: 280, opacity: 0 }}
          animate={{ width: isCollapsed ? 72 : 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="fixed left-0 top-0 h-full z-50"
        >
          <div 
            className="h-full glass border-r border-[var(--glass-border)] flex flex-col"
            style={{ width: isCollapsed ? 72 : 280 }}
          >
            <div className="p-4 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent)' }}
                >
                  <LayoutDashboard className="w-5 h-5 text-white" />
                </div>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col"
                  >
                    <h1 className="text-sm font-bold text-[var(--text-primary)]">Cyberia Admin</h1>
                    <p className="text-[10px] text-[var(--text-muted)]">Dashboard</p>
                  </motion.div>
                )}
              </div>
            </div>

            <DashboardSidebar isCollapsed={isCollapsed} currentPage={currentPage} onNavigate={navigateTo} />

            <div className="mt-auto border-t border-[var(--glass-border)] p-4">
              {!isCollapsed && adminEmail && (
                <div className="mb-3 px-2">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Signed in as</p>
                  <p className="text-xs text-[var(--text-primary)] truncate">{adminEmail}</p>
                </div>
              )}
              <button
                onClick={handleLogout}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  bg-[var(--glass-bg)] hover:bg-[var(--bg-page)] text-[var(--text-muted)] hover:text-[var(--text-primary)]
                  transition-all text-sm font-medium
                  ${isCollapsed ? 'justify-center' : ''}
                `}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Sign Out</span>}
              </button>
            </div>
          </div>
        </motion.aside>
      </AnimatePresence>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`
          fixed top-1/2 -translate-y-1/2 z-[60]
          w-6 h-12 glass rounded-r-xl border border-[var(--glass-border)]
          flex items-center justify-center
          hover:bg-[var(--bg-page)] transition-colors
          text-[var(--text-muted)] hover:text-[var(--text-primary)]
          ${isCollapsed ? 'left-[72px]' : 'left-[280px]'}
        `}
        style={{ transition: 'left 0.2s ease-in-out' }}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      <main 
        className="flex-1 overflow-auto"
        style={{ marginLeft: isCollapsed ? 72 : 280 }}
      >
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
