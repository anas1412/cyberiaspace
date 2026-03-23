import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import {
  MessageSquare, Loader2, ChevronLeft, ChevronRight,
  Trash2, Reply, X, Clock, User, Shield, Send
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FeedbackEntry {
  id: string;
  type: 'issue' | 'feedback' | 'feature';
  status?: 'todo' | 'doing' | 'done';
  content: string;
  message?: string;
  email?: string;
  metadata?: { email?: string };
  admin_reply?: string;
  created_at?: string;
}

interface DashboardFeedbackProps {
  onBack: () => void;
}

const getMessage = (item: FeedbackEntry) => item.message || item.content || '';
const getEmail = (item: FeedbackEntry) => item.email || item.metadata?.email || 'Anonymous';
const getTimestamp = (item: FeedbackEntry) => item.created_at ? new Date(item.created_at).getTime() : Date.now();

const DashboardFeedback: React.FC<DashboardFeedbackProps> = ({ onBack }) => {
  const { user: authUser } = useAuthStore();
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'issue' | 'feedback' | 'feature'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const limit = 15;

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, typeFilter]);

  const fetchFeedback = async () => {
    if (!authUser?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const encodedId = btoa(authUser.id);
      const params = new URLSearchParams({
        route: 'feedback',
        page: page.toString(),
        limit: limit.toString()
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      
      const res = await fetch(`/api/dashboard?${params}`, {
        headers: { 'Authorization': `Bearer ${encodedId}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch feedback');
      }
      
      const data = await res.json();
      setFeedback(data.feedback || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('Feedback fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!authUser?.id) return;
    setUpdatingId(id);
    try {
      const encodedId = btoa(authUser.id);
      const res = await fetch('/api/dashboard?route=feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${encodedId}`
        },
        body: JSON.stringify({ id, status })
      });
      
      if (res.ok) {
        const data = await res.json();
        setFeedback(prev => prev.map(f => f.id === id ? { ...f, ...data.feedback } : f));
        if (selectedFeedback?.id === id) {
          setSelectedFeedback(prev => prev ? { ...prev, ...data.feedback } : null);
        }
      }
    } catch (err) {
      console.error('Update status error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReply = async () => {
    if (!selectedFeedback || !replyText.trim() || !authUser?.id) return;
    
    setIsSubmittingReply(true);
    try {
      const encodedId = btoa(authUser.id);
      const res = await fetch('/api/dashboard?route=feedback', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${encodedId}`
        },
        body: JSON.stringify({ 
          id: selectedFeedback.id, 
          admin_reply: replyText 
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setFeedback(prev => prev.map(f => f.id === selectedFeedback.id ? { ...f, ...data.feedback } : f));
        setSelectedFeedback(prev => prev ? { ...prev, ...data.feedback } : null);
        setReplyText('');
      }
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?') || !authUser?.id) return;
    
    setDeletingId(id);
    try {
      const encodedId = btoa(authUser.id);
      const res = await fetch(`/api/dashboard?route=feedback&id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${encodedId}` }
      });
      
      if (res.ok) {
        setFeedback(prev => prev.filter(f => f.id !== id));
        if (selectedFeedback?.id === id) {
          setSelectedFeedback(null);
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'todo', label: 'Todo' },
    { key: 'doing', label: 'Doing' },
    { key: 'done', label: 'Done' },
  ] as const;

  const typeTabs = [
    { key: 'all', label: 'All Types' },
    { key: 'issue', label: 'Issues' },
    { key: 'feedback', label: 'Feedback' },
    { key: 'feature', label: 'Features' },
  ] as const;

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
          <h1 className="text-2xl font-bold text-white">Feedback Management</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">{total.toLocaleString()} total entries</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                statusFilter === tab.key 
                  ? "bg-white/10 text-white" 
                  : "text-[var(--text-muted)] hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex p-1 bg-white/5 rounded-xl border border-white/5">
          {typeTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setTypeFilter(tab.key);
                setPage(1);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                typeFilter === tab.key 
                  ? "bg-white/10 text-white" 
                  : "text-[var(--text-muted)] hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="glass rounded-2xl p-6 border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchFeedback} className="mt-3 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-300">
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
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Type</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Content</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Status</th>
                <th className="text-left px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Date</th>
                <th className="text-right px-4 py-4 text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto" />
                  </td>
                </tr>
              ) : feedback.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20">
                    <MessageSquare className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
                    <p className="text-[var(--text-muted)] text-sm">No feedback found</p>
                  </td>
                </tr>
              ) : (
                feedback.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm text-white flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {getEmail(item)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        "inline-flex px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                        item.type === 'issue' ? "bg-red-500/20 text-red-400 border-red-500/30" :
                        item.type === 'feature' ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                        "bg-blue-500/20 text-blue-400 border-blue-500/30"
                      )}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 max-w-xs">
                      <p className="text-xs text-[var(--text-muted)] truncate">{getMessage(item)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        {(['todo', 'doing', 'done'] as const).map(s => (
                          <button
                            key={s}
                            disabled={updatingId === item.id}
                            onClick={() => handleUpdateStatus(item.id, s)}
                            className={cn(
                              "px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all",
                              item.status === s 
                                ? s === 'done' ? "bg-green-500 text-white" : 
                                  s === 'doing' ? "bg-blue-500 text-white" : 
                                  "bg-slate-500 text-white"
                                : "text-slate-600 hover:text-slate-400"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(getTimestamp(item)).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedFeedback(item)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all"
                          title="View & Reply"
                        >
                          <Reply className="w-4 h-4" />
                        </button>
                        <button
                          disabled={deletingId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                          title="Delete"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
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

      {selectedFeedback && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[11000] flex items-center justify-center p-4"
          onClick={() => setSelectedFeedback(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto custom-scroll"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  selectedFeedback.type === 'issue' ? "bg-red-500/20 text-red-400" :
                  selectedFeedback.type === 'feature' ? "bg-purple-500/20 text-purple-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">{selectedFeedback.type}</h3>
                  <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {getEmail(selectedFeedback)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFeedback(null)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Message</p>
                <p className="text-sm text-white leading-relaxed bg-white/5 rounded-xl p-4">
                  {getMessage(selectedFeedback)}
                </p>
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2">Status</p>
                <div className="flex gap-2">
                  {(['todo', 'doing', 'done'] as const).map(s => (
                    <button
                      key={s}
                      disabled={updatingId === selectedFeedback.id}
                      onClick={() => handleUpdateStatus(selectedFeedback.id, s)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                        selectedFeedback.status === s 
                          ? s === 'done' ? "bg-green-500 text-white" : 
                            s === 'doing' ? "bg-blue-500 text-white" : 
                            "bg-slate-500 text-white"
                          : "bg-white/5 text-[var(--text-muted)] hover:bg-white/10"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {selectedFeedback.admin_reply && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Admin Reply
                  </p>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed bg-purple-500/10 rounded-xl p-4 border border-purple-500/20 italic">
                    {selectedFeedback.admin_reply}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-2 flex items-center gap-1">
                  <Reply className="w-3 h-3" />
                  {selectedFeedback.admin_reply ? 'Update Reply' : 'Add Reply'}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 h-11 px-4 bg-white/5 border border-white/5 rounded-xl text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  />
                  <button
                    disabled={isSubmittingReply || !replyText.trim()}
                    onClick={handleReply}
                    className="h-11 px-6 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 rounded-xl text-white transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmittingReply ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {new Date(getTimestamp(selectedFeedback)).toLocaleString()}
              </p>
              <button
                disabled={deletingId === selectedFeedback.id}
                onClick={() => handleDelete(selectedFeedback.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default DashboardFeedback;
