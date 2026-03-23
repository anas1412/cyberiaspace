import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Users, Layers, Lightbulb, MessageSquare,
  TrendingUp, Activity, Clock,
  Loader2, ChevronRight, Shield
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardStats {
  totalUsers: number;
  totalFeedback: number;
  feedbackByStatus: { todo: number; doing: number; done: number };
  feedbackByType: { issue: number; feedback: number; feature: number };
  newUsersThisWeek: number;
  newFeedbackThisWeek: number;
}

interface FeedbackEntry {
  id: string;
  type: 'issue' | 'feedback' | 'feature';
  status?: 'todo' | 'doing' | 'done';
  content: string;
  email?: string;
  metadata?: { email?: string };
  created_at?: string;
}

const getEmail = (item: FeedbackEntry) => item.email || item.metadata?.email || 'Anonymous';
const getTimestamp = (item: FeedbackEntry) => item.created_at ? new Date(item.created_at).getTime() : Date.now();

interface DashboardProps {
  onNavigate: (page: 'overview' | 'users' | 'feedback' | 'settings') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const encodedId = btoa(user.id);
      const res = await fetch('/api/dashboard?route=stats', {
        headers: { 'Authorization': `Bearer ${encodedId}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await res.json();
      setStats(data);
      // Fetch recent feedback separately
      fetchRecentFeedback(encodedId);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentFeedback = async (token: string) => {
    try {
      const res = await fetch('/api/dashboard?route=feedback&limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecentFeedback(data.feedback || []);
      }
    } catch (err) {
      console.error('Recent feedback fetch error:', err);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'blue' },
    { label: 'New This Week', value: stats?.newUsersThisWeek || 0, icon: Layers, color: 'purple' },
    { label: 'Total Feedback', value: stats?.totalFeedback || 0, icon: MessageSquare, color: 'amber' },
    { label: 'Pending Review', value: (stats?.feedbackByStatus?.todo || 0), icon: Lightbulb, color: 'green' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Welcome back, Admin</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          <Activity className="w-3 h-3" />
          Live
        </div>
      </div>

      {error && (
        <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchDashboardData} className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "glass rounded-2xl p-6 border transition-all hover:scale-[1.02]",
                  colorMap[card.color]
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <card.icon className="w-5 h-5 opacity-70" />
                  <TrendingUp className="w-3 h-3 opacity-40" />
                </div>
                <p className="text-3xl font-black text-white mb-1">{card.value.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{card.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 border border-white/5"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-white">Recent Feedback</h2>
                <button
                  onClick={() => onNavigate('feedback')}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  View All
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {recentFeedback.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-8">No feedback yet</p>
              ) : (
                <div className="space-y-3">
                  {recentFeedback.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        item.type === 'issue' ? "bg-red-500/20 text-red-400" :
                        item.type === 'feature' ? "bg-purple-500/20 text-purple-400" :
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{item.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-medium text-[var(--text-muted)]">{getEmail(item)}</span>
                          <span className="text-[9px] font-medium text-[var(--text-muted)]">·</span>
                          <span className="text-[9px] font-medium text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(getTimestamp(item)).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-6 border border-white/5"
            >
              <h2 className="text-sm font-bold text-white mb-6">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onNavigate('users')}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <Users className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Manage Users</span>
                </button>
                <button
                  onClick={() => onNavigate('feedback')}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <MessageSquare className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">View Feedback</span>
                </button>
                <button
                  onClick={() => onNavigate('settings')}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <Shield className="w-6 h-6 text-green-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Settings</span>
                </button>
                <button
                  onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <Layers className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Supabase</span>
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
