import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, CheckCircle, AlertCircle, Loader2, Clock, Users, List } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FeedbackEntry {
  id: string;
  type: 'issue' | 'feedback' | 'feature';
  status?: 'none' | 'todo' | 'doing' | 'done';
  content: string;
  message?: string;
  metadata?: { email?: string; name?: string; isContact?: boolean };
  admin_reply?: string;
  user_email?: string;
  user_name?: string;
  created_at?: string;
}

// Helper to get message (supports both legacy 'message' and DB 'content')
const getMessage = (item: FeedbackEntry) => item.message || item.content || '';

// Helper to get admin reply
const getAdminReply = (item: FeedbackEntry) => item.admin_reply || '';

// Helper to get timestamp
const getTimestamp = (item: FeedbackEntry) => item.created_at ? new Date(item.created_at).getTime() : Date.now();

// Helper to get user display
const getUserDisplay = (item: FeedbackEntry) => {
  if (item.user_email) return item.user_email;
  if (item.metadata?.email) return item.metadata.email;
  return 'Anonymous';
};

const FeedbackPage: React.FC = () => {
  const [view, setView] = useState<'submit' | 'my' | 'all'>('submit');
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
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

  // Fetch feedback when switching views
  useEffect(() => {
    if (view === 'my' && user?.id) {
      fetchMyFeedback();
    } else if (view === 'all') {
      fetchAllFeedback();
    }
  }, [view, user?.id]);

  const fetchMyFeedback = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/feedback?userId=${user.id}`);
      const data = await res.json();
      if (data.feedback) {
        setFeedbackList(data.feedback);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllFeedback = async () => {
    setIsLoading(true);
    try {
      // Fetch all feedback (no auth required)
      const res = await fetch('/api/feedback?action=listAll&limit=100');
      const data = await res.json();
      if (data.feedback) {
        setFeedbackList(data.feedback);
      }
    } catch (error) {
      console.error('Failed to fetch all feedback:', error);
    } finally {
      setIsLoading(false);
    }
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
        body: JSON.stringify({ 
          message, 
          email: email || undefined, 
          type,
          userId: user?.id || undefined
        })
      });

      if (res.ok) {
        setSubmitStatus('success');
        setMessage('');
        setTimeout(() => {
          setSubmitStatus('idle');
        }, 2000);
      } else {
        setSubmitStatus('error');
      }
    } catch {
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
            <p className="text-sm text-[var(--text-muted)] max-w-md">Help us refine the kinetic space. Share your thoughts, report issues, or suggest new protocols.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* My Feedback Button */}
            <button 
              onClick={() => setView('my')}
              className={cn(
                "h-11 w-34 px-4 rounded-xl border transition-all flex items-center justify-center gap-2",
                view === 'my' 
                  ? "bg-white/10 border-white/20 text-white" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Users className="w-4 h-4" />
              <span className="text-[10px] font-bold">My Feedback</span>
            </button>
            
            {/* All Feedback Button */}
            <button 
              onClick={() => setView('all')}
              className={cn(
                "h-11 w-34 px-4 rounded-xl border transition-all flex items-center justify-center gap-2",
                view === 'all' 
                  ? "bg-white/10 border-white/20 text-white" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <List className="w-4 h-4" />
              <span className="text-[10px] font-bold">All Feedback</span>
            </button>
            
            {/* Submit Button */}
            <button 
              onClick={() => setView('submit')}
              className={cn(
                "h-11 w-34 px-5 rounded-xl border transition-all flex items-center justify-center gap-2",
                view === 'submit' 
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px] font-bold">Submit</span>
            </button>
          </div>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {view === 'my' ? (
              <motion.div 
                key="my"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">My Feedback</h2>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
                  </div>
                ) : !user ? (
                  <div className="glass rounded-2xl p-12 md:p-20 text-center border border-white/5">
                    <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-white mb-2">Sign In Required</h3>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-6">Sign in to see your submitted feedback.</p>
                    <button
                      onClick={() => setView('submit')}
                      className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Submit Feedback
                    </button>
                  </div>
                ) : feedbackList.length === 0 ? (
                  <div className="glass rounded-2xl p-12 md:p-20 text-center border border-white/5">
                    <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-white mb-2">No Feedback Yet</h3>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest mb-6">You haven't submitted any feedback yet.</p>
                    <button
                      onClick={() => setView('submit')}
                      className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Submit Feedback
                    </button>
                  </div>
                ) : (
                  feedbackList.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          item.type === 'issue' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          item.type === 'feature' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                          "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                          {item.type}
                        </span>

                        {/* Status Badge */}
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          item.status === 'done' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          item.status === 'doing' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          item.status === 'todo' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        )}>
                          {item.status || 'none'}
                        </span>

                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <Clock className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            {new Date(getTimestamp(item)).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium mb-6 break-words">
                        {getMessage(item)}
                      </p>

                      {/* Admin Reply Section */}
                      {getAdminReply(item) && (
                        <div className="mt-6 pt-6 border-t border-white/5">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--accent-secondary)] mb-1">Cyberia Response</p>
                              <p className="text-xs text-slate-400 leading-relaxed">{getAdminReply(item)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : view === 'all' ? (
              <motion.div 
                key="all"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <h2 className="text-lg font-bold text-white mb-6">All Feedback</h2>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Loading...</p>
                  </div>
                ) : feedbackList.length === 0 ? (
                  <div className="glass rounded-2xl p-12 md:p-20 text-center border border-white/5">
                    <MessageSquare className="w-12 h-12 text-slate-800 mx-auto mb-6" />
                    <h3 className="text-lg font-bold text-white mb-2">No Feedback Yet</h3>
                    <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Be the first to submit feedback!</p>
                  </div>
                ) : (
                  feedbackList.map((item) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-white/10 transition-all"
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          item.type === 'issue' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                          item.type === 'feature' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                          "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        )}>
                          {item.type}
                        </span>

                        {/* Status Badge */}
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          item.status === 'done' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                          item.status === 'doing' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          item.status === 'todo' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                          "bg-slate-500/10 text-slate-400 border-slate-500/20"
                        )}>
                          {item.status || 'none'}
                        </span>

                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <Clock className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            {new Date(getTimestamp(item)).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[var(--text-muted)] ml-auto">
                          <span className="text-[9px] font-bold uppercase tracking-widest">
                            {getUserDisplay(item)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium mb-4 break-words">
                        {getMessage(item)}
                      </p>

                      {/* Admin Reply Section */}
                      {getAdminReply(item) && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-[8px] font-black uppercase tracking-widest text-[var(--accent-secondary)] mb-1">Cyberia Response</p>
                              <p className="text-xs text-slate-400 leading-relaxed">{getAdminReply(item)}</p>
                            </div>
                          </div>
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
                className="glass rounded-2xl p-8 md:p-12 border border-white/10 shadow-2xl relative overflow-hidden"
              >
                {submitStatus === 'success' ? (
                  <div className="py-12 md:py-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 mx-auto border border-green-500/20">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Sent!</h3>
                      <p className="text-xs text-[var(--text-muted)] uppercase tracking-widest">Your feedback has been logged in the system.</p>
                    </div>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => {
                          setSubmitStatus('idle');
                          setView('my');
                        }}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        View My Feedback
                      </button>
                      <button
                        onClick={() => {
                          setSubmitStatus('idle');
                        }}
                        className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Submit Another
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Type</label>
                          <div className="flex gap-2 p-1.5 bg-black/40 border border-white/5 rounded-xl">
                            {(['issue', 'feedback', 'feature'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setType(t)}
                                className={cn(
                                  "flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                  type === t 
                                    ? "bg-white/10 text-white shadow-lg border border-white/10" 
                                    : "text-[var(--text-muted)] hover:text-slate-400 hover:bg-white/[0.02]"
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Email (optional)</label>
                          <input 
                            type="email" 
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-6 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Your Message</label>
                        <textarea 
                          required
                          placeholder="Describe the issue or share your thoughts..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="w-full h-48 bg-black/40 border border-white/5 rounded-xl p-6 text-base text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none custom-scroll"
                        />
                      </div>
                    </div>

                    {submitStatus === 'error' && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Failed to send. Please try again.</span>
                      </div>
                    )}

                    <button 
                      type="submit"
                      disabled={isSubmitting || !message.trim()}
                      className="w-full h-16 bg-[var(--accent)] hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-xl shadow-[var(--accent-glow)] transition-all flex items-center justify-center gap-3 group"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Submit Feedback</span>
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
