import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import {
  Users, Search, Loader2, ChevronLeft, ChevronRight,
  Shield, UserX, Eye, Mail, Calendar,
  Crown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface User {
  id: string;
  email: string;
  name?: string | null;
  avatar?: string;
  plan: string | null;
  is_admin: boolean | null;
  created_at?: string;
  updated_at?: string;
  feedback_count?: number;
}

interface DashboardUsersProps {
  onBack: () => void;
}

const DashboardUsers: React.FC<DashboardUsersProps> = ({ onBack }) => {
  const { user: authUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const limit = 15;

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const fetchUsers = async () => {
    if (!authUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const encodedId = btoa(authUser.id);
      const params = new URLSearchParams({
        route: 'users',
        page: page.toString(),
        limit: limit.toString()
      });
      
      const res = await fetch(`/api/dashboard?${params}`, {
        headers: { 'Authorization': `Bearer ${encodedId}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Users fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async (userId: string, is_admin: boolean) => {
    if (!authUser?.id) return;
    setUpdatingId(userId);
    try {
      const encodedId = btoa(authUser.id);
      const res = await fetch('/api/dashboard?route=updateUser', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${encodedId}`
        },
        body: JSON.stringify({ userId, is_admin })
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_admin: data.user?.is_admin } : u));
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_admin: data.user?.is_admin } : null);
        }
      }
    } catch (err) {
      console.error('Update user error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const planColors: Record<string, string> = {
    free: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    pro: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{total.toLocaleString()} total users</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-11 pl-10 pr-4 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
          />
        </div>
      </div>

      {error && (
        <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchUsers} className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">
            Retry
          </button>
        </div>
      )}

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">User</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Plan</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Role</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Joined</th>
                <th className="text-right px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <Users className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                    <p className="text-[var(--text-muted)] text-sm">No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((user, i) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Users className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{user.name || 'Unknown'}</p>
                          <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                        planColors[user.plan || 'free'] || planColors.free
                      )}>
                        {user.plan === 'pro' && <Crown className="w-3 h-3" />}
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                        user.is_admin === true ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      )}>
                        {user.is_admin === true ? 'admin' : 'user'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          disabled={updatingId === user.id}
                          onClick={() => handleUpdateUser(user.id, !user.is_admin)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            user.is_admin === true 
                              ? "bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400"
                          )}
                          title={user.is_admin === true ? 'Remove Admin' : 'Make Admin'}
                        >
                          {updatingId === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            user.is_admin === true ? <UserX className="w-4 h-4" /> : <Shield className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[11000] flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 w-full max-w-md border border-white/10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Users className="w-6 h-6 text-[var(--text-muted)]" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{selectedUser.name || 'Unknown User'}</h3>
                <p className="text-sm text-[var(--text-muted)]">{selectedUser.email}</p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Plan</span>
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                  planColors[selectedUser.plan || 'free'] || planColors.free
                )}>
                  {selectedUser.plan}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Role</span>
                <span className="text-sm text-white">{selectedUser.is_admin === true ? 'admin' : 'user'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Member Since</span>
                <span className="text-sm text-white">
                  {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">User ID</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{selectedUser.id}</span>
              </div>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full py-3 text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardUsers;
