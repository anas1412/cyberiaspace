import React, { useState, useEffect } from 'react';
import { useModalStore } from '../store/useModalStore';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_CONFIG, type AccessPeriod } from '../constants';
import { Zap, Check, Star, X, Shield, Layout, CreditCard, Rocket, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { user } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<AccessPeriod>('monthly');
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'features' | 'upgrade'>('features');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const { openModal } = useModalStore();

  useEffect(() => {
    if (isOpen) {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const userLanguage = navigator.language;
      const isTunisiaLikely = userTimezone === 'Africa/Tunis' || userLanguage.includes('ar-TN') || userLanguage.includes('fr-TN');
      const forceGlobal = import.meta.env.VITE_ENABLE_LOCAL_PRICING === 'false';

      fetch('/api/pay?action=pricing')
        .then(res => res.json())
        .then(data => {
          // Force currency if user is already Pro and has a payment provider
          if (user?.plan === 'pro' && user?.paymentProvider) {
            if (user.paymentProvider === 'polar') {
              setLocation({ ...data, currency: 'USD', isLocalPricing: false });
              return;
            } else if (user.paymentProvider === 'flouci') {
              setLocation({ ...data, currency: 'DT', isLocalPricing: true });
              return;
            }
          }

          if (forceGlobal) {
            setLocation({ ...data, currency: 'USD', isLocalPricing: false });
          } else if (data.country === 'US' && isTunisiaLikely) {
            setLocation({ country: 'TN', currency: 'DT', isLocalPricing: true });
          } else {
            setLocation(data);
          }
        })
        .catch(() => {
          if (user?.plan === 'pro' && user?.paymentProvider) {
            if (user.paymentProvider === 'polar') {
              setLocation({ country: 'US', currency: 'USD', isLocalPricing: false });
              return;
            } else if (user.paymentProvider === 'flouci') {
              setLocation({ country: 'TN', currency: 'DT', isLocalPricing: true });
              return;
            }
          }

          if (forceGlobal) {
            setLocation({ country: 'US', currency: 'USD', isLocalPricing: false });
          } else {
            setLocation({
              country: isTunisiaLikely ? 'TN' : 'US',
              currency: isTunisiaLikely ? 'DT' : 'USD',
              isLocalPricing: isTunisiaLikely
            });
          }
        });
    }
  }, [isOpen, user?.plan, user?.paymentProvider]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const fail = params.get('fail');
    const paymentId = params.get('payment_id');
    const checkoutId = params.get('checkout_id');

    let pollInterval: any;

    if ((success !== null || fail !== null || checkoutId !== null) && isOpen) {
      if (paymentId) {
        setPaymentStatus('verifying');
        fetch(`/api/pay?action=verify&payment_id=${paymentId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.status === 'SUCCESS') {
              setPaymentStatus('success');
              setPaymentMessage(data.message || 'Payment successful! You are now a Pro member.');
              setTimeout(() => {
                window.history.replaceState({}, '', '/pricing');
              }, 3000);
            } else {
              setPaymentStatus('failed');
              setPaymentMessage(data.message || 'Payment failed. Please try again.');
            }
          })
          .catch(() => {
            setPaymentStatus('failed');
            setPaymentMessage('Failed to verify payment. Please try again.');
          });
      } else if (checkoutId || success !== null) {
        setPaymentStatus('verifying');
        setPaymentMessage('Verifying your upgrade and unlocking Pro features...');
        
        let attempts = 0;
        const maxAttempts = 10; // ~20 seconds total

        pollInterval = setInterval(async () => {
          attempts++;
          const authStore = useAuthStore.getState();
          await authStore.refreshProfile();
          
          if (useAuthStore.getState().user?.plan === 'pro') {
            clearInterval(pollInterval);
            setPaymentStatus('success');
            setPaymentMessage('Upgrade successful! Welcome to Cyberia Pro.');
            
            // Confetti effect
            import('canvas-confetti').then(confetti => {
              confetti.default({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                zIndex: 20000
              });
            });

            setTimeout(() => {
              window.history.replaceState({}, '', '/pricing');
              onClose();
            }, 4000);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setPaymentStatus('idle');
            setPaymentMessage('We are still processing your upgrade. It will appear shortly!');
            setTimeout(() => {
              window.history.replaceState({}, '', '/pricing');
              onClose();
            }, 4000);
          }
        }, 2000);
      } else if (fail !== null) {
        setPaymentStatus('failed');
        setPaymentMessage('Payment failed. Please try again.');
      }
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isOpen]);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authStore = useAuthStore.getState();
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

      const action = location?.isLocalPricing ? 'init' : 'polar_init';
      const response = await fetch(`/api/pay?action=${action}`, {
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
    <div className="fixed inset-0 z-[10005] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="glass bg-[#0B0F19]/90 w-full max-w-5xl rounded-[2rem] border border-white/10 overflow-hidden relative flex flex-col md:flex-row my-auto shadow-2xl"
      >
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:top-6 md:right-6 text-slate-400 hover:text-white transition-all z-[50] w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full active:scale-95 backdrop-blur-md"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden px-6 pt-16 pb-2 justify-center shrink-0">
          <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl w-full">
            <button 
              onClick={() => setActiveTab('features')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                activeTab === 'features' ? "bg-white/10 text-white shadow-sm" : "text-slate-400"
              )}
            >
              <Layout className="w-4 h-4" />
              Features
            </button>
            <button 
              onClick={() => setActiveTab('upgrade')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all",
                activeTab === 'upgrade' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400"
              )}
            >
              <CreditCard className="w-4 h-4" />
              Upgrade
            </button>
          </div>
        </div>

        {/* LEFT: Benefits */}
        <div className={cn(
          "flex-1 p-6 md:p-10 lg:p-14 flex-col",
          activeTab === 'features' ? 'flex' : 'hidden md:flex'
        )}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Unlock Pro</h2>
              <p className="text-sm font-medium text-blue-400">Unlimited flow & maximum space</p>
            </div>
          </div>

          <div className="space-y-6 flex-1">
            {[
              { title: 'Advanced Reasoning', desc: 'Gain exclusive early access to next-generation logic, enhanced reasoning capabilities, and upcoming premium workflow tools.' },
              { title: 'Expanded Workspaces', desc: `Create up to ${PLAN_CONFIG.pro.MAX_SPACES} different spaces to organize your workflow. (Free limits to ${PLAN_CONFIG.free.MAX_SPACES})` },
              { title: 'High Frequency Flow', desc: `Add up to ${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} thoughts in every single space without hitting limits.` },
              { title: 'Expanded File Storage', desc: `Get ${Math.round(PLAN_CONFIG.pro.MAX_STORAGE_MB / 1024)}GB of secure cloud storage for your files and attachments (Free tier is limited to ${PLAN_CONFIG.free.MAX_STORAGE_MB}MB).` },
            ].map((feature, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 + 0.2 }}
                className="flex gap-4 group"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white mb-1">{feature.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ADD THIS NEW SECTION HERE */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 flex gap-4 items-start relative overflow-hidden group"
          >
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16 transition-opacity group-hover:opacity-75" />
            
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 z-10 shadow-inner">
              <Rocket className="w-5 h-5" />
            </div>
            <div className="z-10">
              <div className="flex items-center gap-3 mb-1.5">
                <h4 className="text-sm font-bold text-white">Teams & Mobile App</h4>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  Coming Soon
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Invite friends to shared spaces, work together in real-time, and take your thoughts anywhere with our upcoming iOS & Android apps.
              </p>
            </div>
          </motion.div>
          {/* END NEW SECTION */}

          <div className="md:hidden pt-8 mt-auto">
            <button 
              onClick={() => setActiveTab('upgrade')}
              className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-semibold transition-all border border-white/10 active:scale-95"
            >
              View Pricing Details
            </button>
          </div>
        </div>

        {/* RIGHT: Pricing */}
        <div className={cn(
          "w-full md:w-[380px] lg:w-[440px] p-6 md:p-10 lg:p-14 bg-white/[0.02] border-l border-white/5 flex-col justify-center",
          activeTab === 'upgrade' ? 'flex' : 'hidden md:flex'
        )}>
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl mb-8 w-full">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all",
                  billingCycle === 'monthly' ? "bg-white/15 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2",
                  billingCycle === 'yearly' ? "bg-white/15 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                )}
              >
                Yearly
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight shadow-sm whitespace-nowrap">
                  Save ${savings}
                </span>
              </button>
            </div>

            <div className="mb-4">
              {location?.isLocalPricing ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                    Local Pricing Active
                  </span>
                  <div className="flex items-baseline justify-center">
                    <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">{currentPrice.tnd}</span>
                    <span className="text-xl text-slate-400 ml-2 font-semibold">DT</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 bg-black/20 px-3 py-1 rounded-full">
                    Global Price: ${currentPrice.usd} USD
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline justify-center">
                  <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-white">${currentPrice.usd}</span>
                </div>
              )}
              
              <span className="text-slate-400 font-medium text-sm block mt-4">
                {billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed px-4">
              {billingCycle === 'yearly' ? `One-time payment of ${location?.isLocalPricing ? currentPrice.tnd + ' DT' : '$' + proPrice.yearly.usd} per year.` : 'Manual renewal. No surprise auto-charges.'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-400 font-medium text-center mb-6 bg-red-400/10 p-3 rounded-xl border border-red-400/20"
              >
                {error}
              </motion.p>
            )}
            
            {paymentStatus === 'verifying' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mb-6 bg-blue-500/10 p-8 rounded-[2rem] border border-blue-500/20 backdrop-blur-md"
              >
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                  <Loader2 className="w-16 h-16 text-blue-400 animate-spin" />
                </div>
                <p className="text-base font-bold text-white mb-1">Verifying Upgrade</p>
                <p className="text-sm text-blue-400/80 font-medium leading-relaxed">{paymentMessage}</p>
              </motion.div>
            )}
            
            {paymentStatus === 'success' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="text-center mb-6 bg-gradient-to-br from-green-500/20 to-emerald-500/20 p-8 rounded-[2rem] border border-green-500/30 shadow-xl shadow-green-500/10"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">You're Pro!</h3>
                <p className="text-sm text-green-400 font-medium leading-relaxed">{paymentMessage}</p>
                <p className="text-xs text-slate-400 mt-4 animate-pulse">Closing in a few seconds...</p>
              </motion.div>
            )}

            {paymentStatus === 'idle' && paymentMessage && (
               <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6 bg-white/5 p-8 rounded-[2rem] border border-white/10"
              >
                <Loader2 className="w-12 h-12 text-slate-400 animate-spin mx-auto mb-4 opacity-50" />
                <p className="text-sm text-slate-300 font-medium leading-relaxed">{paymentMessage}</p>
              </motion.div>
            )}
            
            {paymentStatus === 'failed' && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 font-medium text-center mb-6 bg-red-400/10 p-3 rounded-xl border border-red-400/20"
              >
                {paymentMessage}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            onClick={handleUpgrade}
            disabled={isLoading}
            className={cn(
              "w-full h-14 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-3 mb-8",
              isLoading
                ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-white/5"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-95"
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Star className="w-4 h-4 text-white" />
            )}
            {isLoading ? 'Processing...' : 'Upgrade Now'}
          </button>

          <div className="text-center space-y-6">
            <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Secure local & global payments powered by <span className="text-white font-semibold">{location?.isLocalPricing ? 'Flouci' : 'Polar.sh'}</span>.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {[
                { label: 'Privacy Policy', path: '/privacy' },
                { label: 'Terms of Service', path: '/terms' },
                { label: 'Legal Notice', path: '/legal-notice' },
                { label: 'Terms of Sale & Refund Policy', path: '/sales-conditions' },
                { label: 'Contact', path: '/contact' }
              ].map((link, idx) => (
                <button 
                  key={idx}
                  onClick={() => {
                    window.history.pushState({}, '', link.path);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PricingModal;