import React, { useState, useEffect } from 'react';
import { useModalStore } from '../store/useModalStore';
import { PLAN_CONFIG, type AccessPeriod } from '../constants';
import { Zap, Check, Star, X } from 'lucide-react';
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
  const { openModal } = useModalStore();

  useEffect(() => {
    if (isOpen) {
      // Local fallback logic for development
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userLanguage = navigator.language;
      const isTunisiaLikely = userTimezone === 'Africa/Tunis' || userLanguage.includes('ar-TN') || userLanguage.includes('fr-TN');

      fetch('/api/pay?action=pricing')
        .then(res => res.json())
        .then(data => {
          // If server says US (default) but browser is definitely TN, trust the browser
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
          amount: billingCycle === 'monthly' ? currentPrice.tnd : currentPrice.tnd * 12,
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
    <div className="fixed inset-0 z-[10005] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300 overflow-y-auto">
      <div className="glass w-full max-w-4xl rounded-[3rem] border border-white/10 overflow-hidden relative flex flex-col md:flex-row my-auto">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors z-10">
          <X className="w-6 h-6" />
        </button>

        {/* LEFT: Benefits */}
        <div className="flex-1 p-8 md:p-12 border-b md:border-b-0 md:border-r border-white/5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-white">Go Pro</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Unlock Oracle & More Space</p>
            </div>
          </div>

          <div className="space-y-6">
            {[
              { title: 'Oracle AI', desc: 'Ask Oracle to help you generate, search and organize your ideas.' },
              { title: 'More Workspaces', desc: 'Create up to 8 different spaces (Free only has 3).' },
              { title: 'Bigger Capacity', desc: 'Add up to 50 thoughts in every single space.' },
              { title: '400 Cloud Thoughts', desc: 'High-capacity sync for power users (Free is 60).' },
              { title: 'Priority Support', desc: 'Get help directly from the Cyberia development team.' }
            ].map((feature, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-white group-hover:text-indigo-400 transition-colors">{feature.title}</h4>
                  <p className="text-[10px] font-medium text-slate-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Pricing */}
        <div className="w-full md:w-[380px] p-8 md:p-12 bg-white/[0.02] flex flex-col justify-center">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl mb-8">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  billingCycle === 'monthly' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative",
                  billingCycle === 'yearly' ? "bg-white/10 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                )}
              >
                Yearly
                {billingCycle !== 'yearly' && (
                  <span className="absolute -top-3 -right-2 bg-green-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg shadow-green-500/20">Save ${savings}</span>
                )}
              </button>
            </div>

            <div className="mb-2">
              {location?.isLocalPricing ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black uppercase tracking-widest bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 shadow-lg shadow-green-500/10">Local Pricing Detected</span>
                  </div>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl font-black text-white">{currentPrice.tnd} DT</span>
                  </div>
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">Normal Price: ${currentPrice.usd} USD</span>
                </div>
              ) : (
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl font-black text-white">${currentPrice.usd}</span>
                </div>
              )}
              <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] block mt-2">
                For 1 {billingCycle === 'monthly' ? 'Month' : 'Year'} of Access
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4">
              {billingCycle === 'yearly' ? `One-time payment of ${location?.isLocalPricing ? currentPrice.tnd + ' DT' : '$' + proPrice.yearly.usd} per year` : 'Manual renewal. No automatic charges.'}
            </p>
          </div>

          {error && (
            <p className="text-[9px] text-red-400 font-bold uppercase tracking-widest text-center mb-4 animate-shake">
              {error}
            </p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={isLoading || import.meta.env.PROD}
            className={cn(
              "w-full py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 mb-6",
              (isLoading || import.meta.env.PROD)
                ? "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 active:scale-[0.98]"
            )}
          >
            {isLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-white animate-spin" />
            ) : (
              <Star className={cn("w-4 h-4", import.meta.env.PROD ? "fill-slate-500" : "fill-white")} />
            )}
            {import.meta.env.PROD ? 'Coming Soon' : (isLoading ? 'Processing...' : 'Upgrade Now')}
          </button>

          <div className="text-center space-y-3">
            <p className="text-[9px] text-slate-600 font-medium leading-relaxed">
              Secure 256-bit encrypted transactions. <br /> We never store your card details on our servers.
            </p>
            <button
              onClick={() => openModal({
                title: 'Privacy & Security',
                type: 'terms',
                confirmText: 'Acknowledged'
              })}
              className="text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-400 transition-colors pointer-events-auto"
            >
              Privacy Policy & Terms
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;