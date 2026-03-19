import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import { useModalStore } from '../store/useModalStore';
import { db } from '../db';
import { Merge, ArrowRight, Replace } from 'lucide-react';
import { PLAN_CONFIG } from '../constants';

const QuotaResolver: React.FC = () => {
  const { mergeGuestSpace, replaceCloudSpace } = useStore();
  const { user, setQuotaResolverPending } = useAuthStore();
  const { closeModal, openPricing } = useModalStore();
  const plan = user?.plan || 'free';
  const limits = PLAN_CONFIG[plan];

  const [guestSpaces, setGuestSpaces] = useState<any[]>([]);
  const [cloudSpaces, setCloudSpaces] = useState<any[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [selectedCloudId, setSelectedCloudId] = useState<string | null>(null);
  const [step, setStep] = useState<'options' | 'merge' | 'replace'>('options');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResolvedOne, setHasResolvedOne] = useState(false);
  const [isResolved, setIsResolved] = useState(false);

  const loadSpaces = useCallback(async () => {
    const currentUserId = user?.id ?? 'guest';
    
    const { syncOrchestrator } = await import('../services/sync/syncOrchestrator');
    const cloudData = await syncOrchestrator.fetchCloudData();
    const cloudDataSpaces = (cloudData?.spaces || []) as any[];
    const cloudSpaceIds = new Set(cloudDataSpaces.map(s => s.id));
    
    const allLocalSpaces = await db.spaces
      .filter(s => (s.userId === currentUserId || !s.userId || s.userId === 'guest') && !s.deletedAt)
      .toArray();
    
    const localOnly = allLocalSpaces.filter(s => 
      !cloudSpaceIds.has(s.id) || s.syncStatus === 'local' || s.syncStatus === undefined
    );
    
    const cloudOnly = cloudDataSpaces.filter(s => 
      allLocalSpaces.some((us: any) => us.id === s.id)
    );
    
    console.log('[QuotaResolver] Loaded. localOnly:', localOnly.length, 'cloudOnly:', cloudOnly.length);
    setGuestSpaces(localOnly);
    setCloudSpaces(cloudOnly);
    if (localOnly.length > 0) {
      setSelectedGuestId(localOnly[0].id);
    }
    if (cloudOnly.length > 0) {
      setSelectedCloudId(cloudOnly[0].id);
    }
    
    // Check if all resolved
    if (localOnly.length === 0 && hasResolvedOne) {
      setIsResolved(true);
    }
  }, [user, hasResolvedOne]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const handleMerge = async () => {
    if (!selectedGuestId || !selectedCloudId) return;

    setIsProcessing(true);
    const success = await mergeGuestSpace(selectedGuestId, selectedCloudId);
    setIsProcessing(false);
    
    if (success) {
      setHasResolvedOne(true);
      setStep('options');
      await loadSpaces();
    }
  };

  const handleReplace = async () => {
    if (!selectedGuestId || !selectedCloudId) return;
    setIsProcessing(true);
    const success = await replaceCloudSpace(selectedGuestId, selectedCloudId);
    setIsProcessing(false);
    
    if (success) {
      setHasResolvedOne(true);
      setStep('options');
      await loadSpaces();
    }
  };

  const handleClose = () => {
    setQuotaResolverPending(false);
    closeModal();
  };

  // Show resolved state if all conflicts have been resolved
  if (isResolved) {
    return (
      <div className="text-center py-8">
        <h3 className="text-white font-bold mb-2">All Resolved</h3>
        <p className="text-slate-400 text-xs">You can close this modal.</p>
        <button onClick={handleClose} className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase">Close</button>
      </div>
    );
  }

  return (
    <div className="text-left space-y-6">
      <div className="text-center mb-6">
        <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1">Your {plan} account has {limits.MAX_SPACES} spaces max.</p>
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
              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Move local thoughts into a cloud space.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
          </button>

          <button 
            onClick={() => setStep('replace')}
            className="w-full flex items-center gap-4 p-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-2xl transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Replace className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h4 className="text-white text-[11px] font-black uppercase tracking-widest">Replace a Space</h4>
              <p className="text-slate-500 text-[10px] leading-tight mt-0.5">Delete a cloud space to keep this local one.</p>
            </div>
            <ArrowRight className="ml-auto w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
          </button>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={handleClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Close
            </button>
            <button 
              onClick={openPricing}
              className="flex-1 py-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {step === 'merge' && (
        <div className="space-y-6">
          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Local space:</label>
            <select 
              value={selectedGuestId || ''} 
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500"
            >
              {guestSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div className="flex justify-center">
            <Merge className="w-5 h-5 text-blue-500/40 rotate-180" />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Cloud space:</label>
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
              {isProcessing ? 'Merging...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {step === 'replace' && (
        <div className="space-y-6">
          <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
            <p className="text-[10px] text-red-400/80 leading-relaxed font-medium uppercase tracking-wider">
              Warning: This will permanently delete the selected cloud space and all its thoughts.
            </p>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Keep local space:</label>
            <select 
              value={selectedGuestId || ''} 
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-white/20"
            >
              {guestSpaces.map(s => <option key={s.id} value={s.id}>{s.name || 'Untitled'}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block ml-1">Delete cloud space:</label>
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
              {isProcessing ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaResolver;
