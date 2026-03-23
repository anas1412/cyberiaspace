import React from 'react';
import { LayoutDashboard, Users, MessageSquare, Settings } from 'lucide-react';

type DashboardPage = 'overview' | 'users' | 'feedback' | 'settings';

interface NavItem {
  page: DashboardPage;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { page: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-5 h-5" /> },
  { page: 'users', label: 'Users', icon: <Users className="w-5 h-5" /> },
  { page: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-5 h-5" /> },
  { page: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

interface DashboardSidebarProps {
  isCollapsed: boolean;
  currentPage: DashboardPage;
  onNavigate: (page: DashboardPage) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ isCollapsed, currentPage, onNavigate }) => {
  return (
    <nav className="flex-1 py-4 overflow-y-auto custom-scroll">
      <ul className="space-y-1 px-2">
        {navItems.map((item) => {
          const active = currentPage === item.page;
          return (
            <li key={item.page}>
              <button
                onClick={() => onNavigate(item.page)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer
                  ${isCollapsed ? 'justify-center' : ''}
                  ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
                  }
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={`shrink-0 ${active ? 'text-white' : ''}`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
                {active && !isCollapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DashboardSidebar;
