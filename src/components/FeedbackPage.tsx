import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, CheckCircle, AlertCircle, ChevronLeft, Loader2, Clock, User, Shield, Lock, Trash2, LogOut } from 'lucide-react';
import { useModalStore } from '../store/useModalStore';
import { useAuthStore } from '../store/useAuthStore';
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
  adminReply?: string;
  created_at?: string;
  timestamp?: number;
}

// Helper to get message (supports both legacy 'message' and DB 'content')
const getMessage = (item: FeedbackEntry) => item.message || item.content || '';

// Helper to get email (supports both legacy 'email' and DB 'metadata.email')
const getEmail = (item: FeedbackEntry) => item.email || item.metadata?.email || '';

// Helper to get admin reply (supports both legacy 'adminReply' and DB 'admin_reply')
const getAdminReply = (item: FeedbackEntry) => item.adminReply || item.admin_reply || '';

// Helper to get timestamp (supports both legacy 'timestamp' and DB 'created_at')
const getTimestamp = (item: FeedbackEntry) => item.timestamp || (item.created_at ? new Date(item.created_at).getTime() : Date.now());

const FeedbackPage: React.FC = () => {
  const [view, setView] = useState<'list' | 'submit' | 'admin'>('list');
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!localStorage.getItem('cyberia_admin_token'));
  
  const { openModal } = useModalStore();
  const { user } = useAuthStore();
  
  // Form State
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [type, setType] = useState<'issue' | 'feedback' | 'feature'>('issue');

  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user, email]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Admin Management State
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [tempReply, setTempReply] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('cyberia_admin_token');
      const res = await fetch('/api/feedback', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.feedback) {
        setFeedbackList(data.feedback);
      }
      if (data.isAdmin) {
        setIsAdminAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEntry = async (id: string, updates: Partial<FeedbackEntry>) => {
    const token = localStorage.getItem('cyberia_admin_token');
    if (!token) return;

    setUpdatingId(id);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, ...updates })
      });
      if (res.ok) {
        setFeedbackList(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
        setEditingReplyId(null);
      }
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('cyberia_admin_token', data.token);
        setIsAdminAuthenticated(true);
        setView('list');
        fetchFeedback();
      } else {
        setLoginError(true);
      }
    } catch {
      setLoginError(true);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('cyberia_admin_token');
    setIsAdminAuthenticated(false);
    setView('list');
    fetchFeedback();
  };

  const handleDeleteFeedback = async (id: string) => {
    const token = localStorage.getItem('cyberia_admin_token');
    if (!token) return;

    openModal({
      title: 'Delete Feedback?',
      description: 'This action will permanently remove this entry from the system.',
      type: 'delete_thought',
      confirmText: 'Delete Entry',
      onConfirm: async () => {
        setDeletingId(id);
        try {
          const res = await fetch(`/api/feedback?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setFeedbackList(prev => prev.filter(item => item.id !== id));
          }
        } catch (error) {
          console.error('Delete failed:', error);
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email, type })
      });

      if (res.ok) {
        setSubmitStatus('success');
        setMessage('');
        setEmail('');
        setTimeout(() => {
          setView('list');
          setSubmitStatus('idle');
          fetchFeedback();
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020408] text-slate-200 font-['Plus_Jakarta_Sans',_sans-serif] selection:bg-[var(--accent)]/30 selection:text-white overflow-x-hidden">
      {/* Background Aura */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 md:mb-20">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <a href="/" className="text-2xl font-black tracking-tighter text-white hover:opacity-70 transition-opacity">CYBERIA</a>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent-secondary)]">Feedback Portal</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">System Reliability & Feedback</h1>
            <p className="text-sm text-slate-500 max-w-md">Help us refine the kinetic workspace. Share your thoughts, report issues, or suggest new workspace protocols.</p>
          </div>
          
          <div className="flex items-center gap-2">
            {isAdminAuthenticated && (
              <button 
                onClick={handleAdminLogout}
                className="h-12 w-12 glass rounded-2xl border border-white/5 shadow-2xl transition-all hover:bg-red-500/10 text-slate-400 hover:text-red-400 flex items-center justify-center group"
                title="Admin Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            {!isAdminAuthenticated && (
              <button 
                onClick={() => setView(view === 'admin' ? 'list' : 'admin')}
                className={cn(
                  "h-12 w-12 glass rounded-2xl border border-white/5 shadow-2xl transition-all flex items-center justify-center group",
                  view === 'admin' ? "bg-purple-500/20 text-purple-400" : "text-slate-500 hover:text-white hover:bg-white/5"
                )}
                title="Admin Login"
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => setView(view === 'list' ? 'submit' : 'list')}
              className="h-12 px-8 glass rounded-2xl border border-white/5 shadow-2xl transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center gap-3 group pointer-events-auto"
            >
              {view === 'list' || view === 'admin' ? (
                <>
                  <MessageSquare className="w-4 h-4 text-[var(--accent-secondary)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Submit Feedback</span>
                </>
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Back to List</span>
                </>
              )}
            </button>
          </div>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {view === 'admin' ? (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto"
              >
                <div className="glass rounded-[2.5rem] p-10 border border-white/10 shadow-2xl">
                  <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 mx-auto mb-6">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white text-center mb-2">Admin Authorization</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center mb-8">Access management protocols</p>
                  
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <input 
                      type="password"
                      autoFocus
                      disabled={isAuthenticating}
                      placeholder="Access Password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none focus:border-purple-500/50 transition-all text-center tracking-[0.5em] disabled:opacity-50"
                    />
                    {loginError && (
                      <p className="text-[9px] font-black uppercase tracking-widest text-red-400 text-center">Invalid Credentials</p>
                    )}
                    <button 
                      type="submit"
                      disabled={isAuthenticating || !adminPassword}
                      className="w-full h-14 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg shadow-purple-500/20 flex items-center justify-center gap-3"
                    >
                      {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Authenticate'}
                    </button>
                  </form>
                </div>
              </motion.div>
            ) : view === 'list' ? (
              <motion.div 
                key="list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Accessing Feedback Stream...</p>
                  </div>
                ) : feedbackList.length === 0 ? (
                  <div className="glass rounded-[2.5rem] p-12 md:p-20 text-center border border-white/5">
                    <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-white mb-2">No Reports Yet</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">The feedback stream is currently empty.</p>
                  </div>
                ) : (
                  feedbackList.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass rounded-[2rem] p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all group relative"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                            item.type === 'issue' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            item.type === 'feature' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}>
                            {item.type}
                          </span>

                          {/* Status Badge */}
                          {(item.status || isAdminAuthenticated) && (
                            <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5 relative min-w-[120px]">
                              {isAdminAuthenticated ? (
                                <>
                                  {(['todo', 'doing', 'done'] as const).map(s => (
                                    <button
                                      key={s}
                                      disabled={updatingId === item.id}
                                      onClick={() => handleUpdateEntry(item.id, { status: s })}
                                      className={cn(
                                        "px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest transition-all",
                                        item.status === s 
                                          ? s === 'done' ? "bg-green-500 text-white" : s === 'doing' ? "bg-blue-500 text-white" : "bg-slate-500 text-white"
                                          : "text-slate-600 hover:text-slate-400"
                                      )}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                  {updatingId === item.id && (
                                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className={cn(
                                  "px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest",
                                  item.status === 'done' ? "text-green-400" : item.status === 'doing' ? "text-blue-400" : "text-slate-400"
                                )}>
                                  Status: {item.status || 'pending'}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">
                              {new Date(getTimestamp(item)).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-slate-600">
                            <User className="w-3 h-3" />
                            <span className={cn(
                              "text-[9px] font-bold uppercase tracking-widest",
                              !isAdminAuthenticated && "truncate max-w-[150px]"
                            )}>
                              {getEmail(item)}
                            </span>
                          </div>

                          {/* Admin Actions Inline */}
                          {isAdminAuthenticated && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button 
                                disabled={updatingId === item.id || deletingId === item.id}
                                onClick={() => {
                                  setEditingReplyId(item.id);
                                  setTempReply(getAdminReply(item));
                                }}
                                className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all"
                                title="Reply"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                disabled={updatingId === item.id || deletingId === item.id}
                                onClick={() => handleDeleteFeedback(item.id)}
                                className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition-all"
                                title="Delete"
                              >
                                {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium mb-6 break-words">
                        {getMessage(item)}
                      </p>

                      {/* Admin Reply Section */}
                      {(getAdminReply(item) || editingReplyId === item.id) && (
                        <div className="mt-6 pt-6 border-t border-white/5">
                          {editingReplyId === item.id ? (
                            <div className="space-y-3">
                              <textarea 
                                autoFocus
                                disabled={updatingId === item.id}
                                value={tempReply}
                                onChange={(e) => setTempReply(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs text-white outline-none focus:border-purple-500/50 transition-all min-h-[80px] resize-none disabled:opacity-50"
                                placeholder="Enter admin response..."
                              />
                              <div className="flex justify-end gap-2">
                                <button 
                                  disabled={updatingId === item.id}
                                  onClick={() => setEditingReplyId(null)}
                                  className="px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all disabled:opacity-30"
                                >
                                  Cancel
                                </button>
                                <button 
                                  disabled={updatingId === item.id}
                                  onClick={() => handleUpdateEntry(item.id, { adminReply: tempReply })}
                                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-[8px] font-black uppercase tracking-widest hover:bg-purple-500 transition-all flex items-center justify-center gap-2 min-w-[80px]"
                                >
                                  {updatingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Reply'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-4">
                              <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                                <Shield className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <p className="text-[8px] font-black uppercase tracking-widest text-[var(--accent-secondary)] mb-1">Cyberia Response</p>
                                <p className="text-xs text-slate-400 leading-relaxed italic">{getAdminReply(item)}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="submit"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass rounded-[2.5rem] p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden"
              >
                {submitStatus === 'success' ? (
                  <div className="py-12 md:py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-500/10 rounded-[2rem] flex items-center justify-center text-green-400 mx-auto border border-green-500/20">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Transmission Successful</h3>
                      <p className="text-xs text-slate-500 uppercase tracking-widest">Your feedback has been logged in the system.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Transmission Type</label>
                          <div className="flex gap-2 p-1.5 bg-black/40 border border-white/5 rounded-2xl">
                            {(['issue', 'feedback', 'feature'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                  type === t 
                                    ? "bg-white/10 text-white shadow-lg border border-white/10" 
                                    : "text-slate-600 hover:text-slate-400 hover:bg-white/[0.02]"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Contact Identity (Optional)</label>
                          <input 
                            type="email" 
                            placeholder="user@cyberia.net"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-6 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Core Message</label>
                        <textarea 
                          required
                          placeholder="Describe the issue or share your thoughts..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full h-48 bg-black/40 border border-white/5 rounded-[2rem] p-6 text-base text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none custom-scroll"
                        />
                      </div>
                    </div>

                    {submitStatus === 'error' && (
                      <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Transmission Failure. Please try again.</span>
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={isSubmitting || !message.trim()}
                      className="w-full h-16 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow-xl shadow-[var(--accent-glow)] transition-all flex items-center justify-center gap-3 group"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          <span className="text-[11px] font-black uppercase tracking-[0.2em]">Initiate Transmission</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default FeedbackPage;
