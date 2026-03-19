import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useModalStore } from '../store/useModalStore';
import { db } from '../db';
import { Merge, Trash2, Zap, ArrowRight, BrainCircuit, ShieldCheck } from 'lucide-react';
import { PLAN_CONFIG } from '../constants';

const QuotaResolver: React.FC = () => {
  const { mergeGuestSpace, replaceCloudSpace, discardGuestSpace, setActiveSpace } = useStore();
  const { user } = useAuthStore();
  const { closeModal, openPricing } = useModalStore();
  const plan = user?.plan || 'free';
  const limits = PLAN_CONFIG[plan];

  const [guestSpaces, setGuestSpaces] = useState<any[]>([]);
  const [cloudSpaces, setCloudSpaces] = useState<any[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedCloudId, setSelectedCloudId] = useState<string | null>(null);
  const [step, setStep] = useState<'options' | 'merge' | 'replace' | 'discard'>('options');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      const currentUserId = user?.id ?? 'guest';
      const userSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
      const guests = userSpaces.filter(s => s.syncStatus === 'local');
      const synced = userSpaces.filter(s => s.syncStatus === 'synced');
      setGuestSpaces(guests);
      setCloudSpaces(synced);
      if (guests.length > 0) setSelectedGuestId(guests[0].id);
      if (synced.length > 0) setSelectedCloudId(synced[0].id);
    };
    load();
  }, [user]);

  const handleMerge = async () => {
    if (!selectedGuestId || !selectedCloudId) return;
    
    // Check Global Cloud Thought Limit
    const sourceThoughtsCount = await db.thoughts.where('spaceId').equals(selectedGuestId).and(t => !t.deletedAt).count();
    const currentCloudThoughts = user?.usage?.sync_thoughts || 0;
    
    if (currentCloudThoughts + sourceThoughtsCount > limits.MAX_CLOUD_THOUGHTS) {
      useModalStore.getState().openModal({
        title: 'Account Limit Reached',
        description: `Merging would put you at ${currentCloudThoughts + sourceThoughtsCount} total thoughts, exceeding your ${plan} account limit of ${limits.MAX_CLOUD_THOUGHTS}.`,
        type: 'alert',
        confirmText: 'Acknowledged'
      });
      return;
    }

    setIsProcessing(true);
    const success = await mergeGuestSpace(selectedGuestId, selectedCloudId);
    setIsProcessing(false);
    if (success) {
      await setActiveSpace(selectedCloudId);
      closeModal();
    }
  };

  const handleReplace = async () => {
    if (!selectedGuestId || !selectedCloudId) return;
    setIsProcessing(true);
    const success = await replaceCloudSpace(selectedGuestId, selectedCloudId);
    setIsProcessing(false);
    if (success) {
      await setActiveSpace(selectedGuestId);
      closeModal();
    }
  };

  const handleDiscard = async () => {
    if (!selectedGuestId) return;
    const currentUserId = user?.id ?? 'guest';
    setIsProcessing(true);
    const success = await discardGuestSpace(selectedGuestId);
    setIsProcessing(false);
    if (success) {
      // Re-load to see if more conflicts remain - now with proper userId filtering
      const userSpaces = await db.spaces.filter(s => s.userId === currentUserId && !s.deletedAt).toArray();
      const guests = userSpaces.filter(s => s.syncStatus === 'local');
      setGuestSpaces(guests);
      if (guests.length > 0) {
        setSelectedGuestId(guests[0].id);
        setStep('options');
      } else {
        closeModal();
      }
    }
  };

  if (guestSpaces.length === 0) {
    return (
      <div className="text-center py-8">
        <ShieldCheck className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <h3 className="text-white font-bold mb-2">Workspace Synced</h3>
        <p className="text-slate-400 text-xs">All your work is safely in the cloud.</p>
        <button onClick={closeModal} className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase">Close</button>
      </div>
    );
  }

  return (
    <div className="text-left space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <BrainCircuit className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Space Limit Reached</h2>
        <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1">Your {plan} account is at its {limits.MAX_SPACES} space limit.</p>
      </div>

      {step === 'options' && (
        <div className="space-y-3">
          <button 
            onClick={() => setStep('merge')}
            className="w-full flex items-center gap-4 p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
              <Merge className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-white text-[11px] font-black uppercase tracking-widest">Merge Thoughts</h4>
              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Move guest work into an existing cloud space.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
          </button>

          <button 
            onClick={() => setStep('replace')}
            className="w-full flex items-center gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h4 className="text-white text-[11px] font-black uppercase tracking-widest">Replace a Space</h4>
              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Delete an old cloud space to make room for this one.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
          </button>

          <button 
            onClick={() => setStep('discard')}
            className="w-full flex items-center gap-4 p-4 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 rounded-2xl transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h4 className="text-red-400 text-[11px] font-black uppercase tracking-widest">Discard Guest Work</h4>
              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Permanently delete local work to enter your workspace.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-red-400 transition-colors" />
          </button>

          <button 
            onClick={() => { openPricing(); closeModal(); }}
            className="w-full flex items-center gap-4 p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-indigo-300 text-[11px] font-black uppercase tracking-widest">Upgrade to Pro</h4>
              <p className="text-indigo-400/60 text-[10px] leading-tight mt-0.5">Unlock up to {PLAN_CONFIG.pro.MAX_SPACES} spaces and unlimited syncing.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      )}

      {step === 'merge' && (
        <div className="space-y-6">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Move from:</label>
            <select 
              value={selectedGuestId || ''} 
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            >
              {guestSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div className="flex justify-center">
            <Merge className="w-5 h-5 text-blue-500/40" />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Move into:</label>
            <select 
              value={selectedCloudId || ''} 
              onChange={(e) => setSelectedCloudId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            >
              {cloudSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setStep('options')}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Back
            </button>
            <button 
              onClick={handleMerge}
              disabled={isProcessing}
              className="flex-[2] py-3 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {isProcessing ? 'Merging...' : 'Confirm Merge'}
            </button>
          </div>
        </div>
      )}

      {step === 'replace' && (
        <div className="space-y-6">
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
            <p className="text-[10px] text-red-400/80 leading-relaxed font-medium uppercase tracking-wider">
              Warning: Replacing a space will permanently delete the old cloud space and its thoughts.
            </p>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Keep this one:</label>
            <select 
              value={selectedGuestId || ''} 
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20"
            >
              {guestSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Delete this one:</label>
            <select 
              value={selectedCloudId || ''} 
              onChange={(e) => setSelectedCloudId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500/50"
            >
              {cloudSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setStep('options')}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Back
            </button>
            <button 
              onClick={handleReplace}
              disabled={isProcessing}
              className="flex-[2] py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isProcessing ? 'Processing...' : 'Confirm Replace'}
            </button>
          </div>
        </div>
      )}

      {step === 'discard' && (
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-[10px] text-red-400 font-bold leading-relaxed uppercase tracking-wider">
              DANGER: This will permanently delete your guest session work. This action cannot be undone.
            </p>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Select work to discard:</label>
            <select 
              value={selectedGuestId || ''} 
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500"
            >
              {guestSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setStep('options')}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Back
            </button>
            <button 
              onClick={handleDiscard}
              disabled={isProcessing}
              className="flex-[2] py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {isProcessing ? 'Discarding...' : 'Confirm Discard'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaResolver;
