import React, { useState, useEffect } from 'react';
import { useModalStore } from '../store/useModalStore';
import { PLAN_CONFIG, type AccessPeriod } from '../constants';
import { Zap, Check, Star, X, Shield, Layout, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose }) => {
  const [billingCycle, setBillingCycle] = useState<AccessPeriod>('monthly');
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'upgrade'>('features');
  const { openModal } = useModalStore();

  useEffect(() => {
    if (isOpen) {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userLanguage = navigator.language;
      const isTunisiaLikely = userTimezone === 'Africa/Tunis' || userLanguage.includes('ar-TN') || userLanguage.includes('fr-TN');

      fetch('/api/pay?action=pricing')
        .then(res => res.json())
        .then(data => {
          if (data.country === 'US' && isTunisiaLikely) {
            setLocation({ country: 'TN', currency: 'DT', isLocalPricing: true });
          } else {
            setLocation(data);
          }
        })
        .catch(() => setLocation({
          country: isTunisiaLikely ? 'TN' : 'US',
          currency: isTunisiaLikely ? 'DT' : 'USD',
          isLocalPricing: isTunisiaLikely
        }));
    }
  }, [isOpen]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authStore = (await import('../store/useAuthStore')).useAuthStore.getState();
      if (authStore.status !== 'authenticated') {
        openModal({
          title: 'Sign In Required',
          description: 'Please sign in to your Google account to upgrade to Cyberia Pro.',
          type: 'alert',
          confirmText: 'Sign In',
          onConfirm: () => (window as any)._cyberia_login?.[0]?.()
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/pay?action=init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.accessToken}`
        },
        body: JSON.stringify({
          amount: location?.currency === 'DT' ? currentPrice.tnd : currentPrice.usd,
          currency: location?.currency === 'DT' ? 'TND' : 'USD',
          billingCycle
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate payment');
      }

      const { payUrl } = await response.json();
      window.location.href = payUrl;

    } catch (err: any) {
      console.error('Upgrade Error:', err);
      setError(err.message || 'Payment system currently unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const currentPrice = billingCycle === 'monthly' ? proPrice.monthly : proPrice.yearly;
  const savings = Math.round((proPrice.monthly.usd * 12 - proPrice.yearly.usd));

  return (
    <div className="fixed inset-0 z-[10005] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 lg:p-20 animate-in fade-in duration-300 overflow-y-auto">
      <div className="glass w-full max-w-5xl rounded-[2.5rem] md:rounded-[3rem] border border-white/10 overflow-hidden relative flex flex-col md:flex-row my-auto shadow-2xl">
        
        {/* Close Button - Premium Universal Positioning */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-500 hover:text-white transition-all z-[50] w-10 h-10 md:w-12 md:h-12 flex items-center justify-center hover:bg-white/10 rounded-full active:scale-90 backdrop-blur-md"
        >
          <X className="w-5 h-5 md:w-6 h-6" />
        </button>

        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden px-8 pt-16 pb-4 justify-center shrink-0">
          <div className="flex p-1 bg-white/5 border border-white/10 rounded-2xl w-full">
            <button 
              onClick={() => setActiveTab('features')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'features' ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-slate-500"
              )}
            >
              <Layout className="w-3.5 h-3.5" />
              Features
            </button>
            <button 
              onClick={() => setActiveTab('upgrade')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === 'upgrade' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-500"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Upgrade
            </button>
          </div>
        </div>

        {/* LEFT: Benefits */}
        <div className={cn(
          "flex-1 p-8 md:p-10 lg:p-16 md:border-r border-white/5 flex-col",
          activeTab === 'features' ? 'flex' : 'hidden md:flex'
        )}>
          <div className="flex items-center gap-5 mb-8 md:mb-12">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
              <Zap className="w-7 h-7 md:w-8 md:h-8 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl md:text-2xl font-black uppercase tracking-widest text-white leading-none mb-1.5">Go Pro</h2>
              <p className="text-[10px] md:text-[11px] font-bold text-slate-500 uppercase tracking-[0.25em]">Unlimited Flow & More Space</p>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8 flex-1">
            {[
              { title: 'Premium Oracle AI', desc: `Access advanced Premium models with ${PLAN_CONFIG.pro.AI_DAILY_LIMIT} daily interactions (Free uses mini models with ${PLAN_CONFIG.free.AI_DAILY_LIMIT} daily).` },
              { title: 'Expanded Workspaces', desc: `Create up to ${PLAN_CONFIG.pro.MAX_SPACES} different spaces (Free only has ${PLAN_CONFIG.free.MAX_SPACES}).` },
              { title: 'High Frequency Flow', desc: `Add up to ${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} thoughts in every single space.` },
              { title: 'Heavy Cloud Sync', desc: `${PLAN_CONFIG.pro.MAX_CLOUD_THOUGHTS} Cloud Thoughts for power users (Free is ${PLAN_CONFIG.free.MAX_CLOUD_THOUGHTS}).` },
              { title: 'Advanced Functionalities', desc: 'Exclusive access to future Premium architectures and future themes.' }
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                initial={activeTab === 'features' ? { opacity: 0, x: -10 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-5 group"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs md:text-xs font-black uppercase tracking-widest text-white group-hover:text-blue-400 transition-colors mb-1.5">{feature.title}</h4>
                  <p className="text-[11px] md:text-[11px] font-medium text-slate-500 leading-relaxed uppercase tracking-wider">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="md:hidden pt-8 mt-auto">
            <button 
              onClick={() => setActiveTab('upgrade')}
              className="w-full py-5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all border border-blue-500/20 active:scale-[0.98]"
            >
              Continue to Upgrade
            </button>
          </div>
        </div>

        {/* RIGHT: Pricing */}
        <div className={cn(
          "w-full md:w-[340px] lg:w-[420px] p-8 md:p-10 lg:p-16 bg-white/[0.02] flex-col justify-center",
          activeTab === 'upgrade' ? 'flex' : 'hidden md:flex'
        )}>
          <div className="flex flex-col items-center text-center mb-8 md:mb-12">
            <div className="flex p-1.5 bg-black/40 border border-white/5 rounded-2xl mb-10 w-full">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  billingCycle === 'monthly' ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                  billingCycle === 'yearly' ? "bg-white/10 text-white shadow-lg border border-white/5" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Yearly
                <span className="bg-green-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-lg shadow-green-500/20 whitespace-nowrap">Save ${savings}</span>
              </button>
            </div>

            <div className="mb-6">
              {location?.isLocalPricing ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] md:text-[9px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 px-3 py-1 rounded-full border border-green-500/20">Local Pricing</span>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl md:text-5xl lg:text-6xl font-black text-white">{currentPrice.tnd} DT</span>
                  </div>
                  <span className="text-[11px] md:text-[9px] font-bold text-slate-600 uppercase tracking-widest">Global Price: ${currentPrice.usd} USD</span>
                </div>
              ) : (
                <div className="flex items-baseline justify-center">
                  <span className="text-6xl md:text-6xl lg:text-7xl font-black text-white">${currentPrice.usd}</span>
                </div>
              )}
              <span className="text-slate-500 font-bold uppercase tracking-widest text-xs md:text-[11px] block mt-4">
                For 1 {billingCycle === 'monthly' ? 'Month' : 'Year'} of Access
              </span>
            </div>
            <p className="text-xs md:text-[11px] font-bold text-slate-500 uppercase tracking-widest px-6 leading-relaxed">
              {billingCycle === 'yearly' ? `One-time payment of ${location?.isLocalPricing ? currentPrice.tnd + ' DT' : '$' + proPrice.yearly.usd} per year` : 'Manual renewal. No auto-charges.'}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400 font-bold uppercase tracking-widest text-center mb-8 animate-shake">
              {error}
            </p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={isLoading || import.meta.env.PROD}
            className={cn(
              "w-full h-16 md:h-16 rounded-[2rem] text-xs md:text-xs font-black uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-4 mb-10 shadow-2xl shadow-blue-500/10",
              (isLoading || import.meta.env.PROD)
                ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                : "bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98]"
            )}
          >
            {isLoading ? (
              <div className="w-6 h-6 rounded-full border-2 border-slate-500 border-t-white animate-spin" />
            ) : (
              <Star className={cn("w-5 h-5", import.meta.env.PROD ? "fill-slate-500" : "fill-white")} />
            )}
            {import.meta.env.PROD ? 'Coming Soon' : (isLoading ? 'Processing...' : 'Upgrade Now')}
          </button>

          <div className="text-center space-y-8">
            <div className="p-5 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-start gap-4 text-left">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <p className="text-[10px] md:text-[10px] text-slate-500 font-medium leading-relaxed uppercase tracking-wider">
                Secure 256-bit payments via <span className="text-blue-400">Konnect</span>. Financial details never touch our servers.
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-8 opacity-40">
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 transition-colors"
              >
                Privacy Policy
              </button>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-400 transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
