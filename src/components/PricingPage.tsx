import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_CONFIG, type AccessPeriod } from '../constants';
import { resolvePricingLocation } from '../utils/pricing';
import { Zap, Check, Star, Shield, Loader2, CreditCard, ExternalLink, Rocket, Layout, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BackgroundEngine from './background/BackgroundEngine';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 3-Column Comparison Row component
const ComparisonRow: React.FC<{ label: string; free: string | React.ReactNode; pro: string | React.ReactNode; highlight?: boolean }> = ({ 
  label,
  free, 
  pro, 
  highlight 
}) => (
  <div className={cn(
    "grid grid-cols-[1.5fr_1fr_1fr] gap-4 py-4 px-6 border-b border-white/5 items-center transition-colors",
    highlight ? "bg-blue-500/[0.03] hover:bg-blue-500/[0.05]" : "hover:bg-white/[0.02]"
  )}>
    <div className="text-left">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
    </div>
    <div className="text-center">
      {typeof free === 'string' ? (
        <span className="text-sm font-medium text-slate-500">{free}</span>
      ) : (
        free
      )}
    </div>
    <div className="text-center">
      {typeof pro === 'string' ? (
        <span className={cn("text-sm font-bold", highlight ? "text-blue-400" : "text-white")}>
          {pro}
        </span>
      ) : (
        pro
      )}
    </div>
  </div>
);

const PricingPage: React.FC = () => {
  const { user, accessToken } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<AccessPeriod>('monthly');
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Check if user is already Pro
  const isProUser = user?.plan === 'pro';

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const currentPrice = billingCycle === 'monthly' ? proPrice.monthly : proPrice.yearly;
  const savings = Math.round((proPrice.monthly.usd * 12 - proPrice.yearly.usd));
  const savingsTnd = Math.round((proPrice.monthly.tnd * 12 - proPrice.yearly.tnd));

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setAcceptedTerms(false);

    fetch('/api/pay?action=pricing')
      .then(res => res.json())
      .then(data => {
        setLocation(resolvePricingLocation(data, user));
      })
      .catch(() => {
        setLocation(resolvePricingLocation(null, user));
      });
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const fail = params.get('fail');
    const paymentId = params.get('payment_id');
    const checkoutId = params.get('checkout_id');

    let pollInterval: any;

    if (success !== null || fail !== null || checkoutId !== null) {
      if (paymentId) {
        setPaymentStatus('verifying');
        fetch(`/api/pay?action=verify&payment_id=${paymentId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.status === 'SUCCESS') {
              setPaymentStatus('success');
              setPaymentMessage(data.message || 'Payment successful! You are now a Pro member.');
              import('canvas-confetti').then(confetti => {
                confetti.default({
                  particleCount: 150,
                  spread: 70,
                  origin: { y: 0.6 },
                  zIndex: 20000
                });
              });
              window.history.replaceState({}, '', window.location.pathname);
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
        const maxAttempts = 15;
        const initialPlan = useAuthStore.getState().user?.plan;
        const initialExpiry = useAuthStore.getState().user?.expiryDate;

        pollInterval = setInterval(async () => {
          attempts++;
          const authStore = useAuthStore.getState();
          await authStore.refreshProfile();
          
          const updatedUser = useAuthStore.getState().user;
          const isNowPro = initialPlan === 'free' && updatedUser?.plan === 'pro';
          
          const hasNewExpiry = updatedUser?.expiryDate && (!initialExpiry || new Date(updatedUser.expiryDate) > new Date(initialExpiry));
          const isExtended = initialPlan === 'pro' && hasNewExpiry;

          if (isNowPro || isExtended) {
            clearInterval(pollInterval);
            setPaymentStatus('success');
            setPaymentMessage(isExtended ? 'Access extended successfully! Enjoy your extra time.' : 'Upgrade successful! Welcome to Cyberia Pro.');
            
            import('canvas-confetti').then(confetti => {
              confetti.default({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                zIndex: 20000
              });
            });
            window.history.replaceState({}, '', window.location.pathname);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setPaymentStatus('idle');
            setPaymentMessage('We are still processing your upgrade. It will appear shortly!');
            window.history.replaceState({}, '', window.location.pathname);
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
  }, []);

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const authStore = useAuthStore.getState();

      if (authStore.status !== 'authenticated') {
        window.location.href = '/login';
        return;
      }

      const currentToken = await authStore.getOrRefreshToken();
      
      if (!currentToken) {
        throw new Error('Failed to obtain a valid authentication token. Please sign in again.');
      }

      const payload = {
        amount: location?.currency === 'DT' ? currentPrice.tnd : currentPrice.usd,
        currency: location?.currency === 'DT' ? 'TND' : 'USD',
        billingCycle,
        termsAccepted: acceptedTerms,
        termsVersion: 'v1',
        privacyVersion: 'v1'
      };
      console.log('[PricingPage] Sending payload:', payload);

      const action = location?.isLocalPricing ? 'init' : 'polar_init';
      const response = await fetch(`/api/pay?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('[PricingPage] Error response:', data);
        const errMsg = data.error || 'Failed to initiate payment';
        const debugInfo = data.debug ? `\n\nDebug: ${JSON.stringify(data.debug)}` : '';
        throw new Error(errMsg + debugInfo);
      }

      const result = await response.json();
      console.log('[PricingPage] Success response:', result);
      
      if (!result.payUrl) {
        throw new Error('Payment URL missing from server response. Please try again.');
      }

      window.location.href = result.payUrl;

    } catch (err: any) {
      console.error('Upgrade Error:', err);
      setError(err.message || 'Payment system currently unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/pay?action=polar_portal', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (data.customerPortalUrl) {
        window.open(data.customerPortalUrl, '_blank');
      }
    } catch (err) {
      console.error('Failed to open portal:', err);
    }
  };

  // Success state (Full Page)
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#0B0F19]">
        <BackgroundEngine />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass bg-[#0B0F19]/90 p-12 rounded-2xl border border-green-500/30 text-center max-w-lg shadow-2xl shadow-green-500/10"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white mb-3">You're Pro!</h2>
            <p className="text-base text-green-400 font-medium leading-relaxed mb-8">{paymentMessage}</p>
            <button
              onClick={() => window.location.href = '/home'}
              className="w-full h-14 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/25 active:scale-95"
            >
              Enter Cyberia
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0B0F19]">
      <BackgroundEngine />
      
      {/* Header / Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled 
          ? 'bg-[#05060a]/40 backdrop-blur-3xl shadow-sm shadow-white/5 py-3' 
          : 'bg-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <a href="/" className="text-2xl font-black tracking-tighter uppercase cursor-pointer text-white">
            Cyberia <span style={{ color: 'var(--accent)' }}>Space</span>
          </a>

          <a 
            href="/home"
            className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
          >
            Launch Space
            <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-32 pb-12 md:pt-40 md:pb-16">
        
        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            {isProUser ? 'You\'re Already Pro' : 'Unlock Your Potential'}
          </h1>
          <p className="text-slate-400 font-medium text-base max-w-2xl mx-auto">
            {isProUser 
              ? `Your Pro access is valid until ${user?.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : 'the end of your period'}. Enjoy your unlimited access.` 
              : 'Start for free, upgrade when you\'re ready. Choose the plan that fits your workflow.'
            }
          </p>
        </motion.div>

        {/* Hero Pricing Card (Matches Modal Split Design) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "glass bg-[#0B0F19]/90 w-full rounded-2xl border overflow-hidden shadow-2xl mb-12",
            isProUser ? "border-green-500/30 flex-col p-10 md:p-14 text-center items-center" : "border-white/10 flex flex-col md:flex-row"
          )}
        >
          {isProUser ? (
            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-sm font-bold uppercase tracking-wider text-green-400">Active Pro Member</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4">Everything is unlocked.</h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">You have full access to all Pro features including unlimited AI models, file intelligence, agentic capabilities, and expanded spaces.</p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-md">
                {user?.paymentProvider === 'polar' && (
                  <button
                    onClick={handleManageSubscription}
                    className="flex-1 h-12 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    Manage Billing
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </button>
                )}
                <button
                  onClick={() => window.location.href = '/home'}
                  className="flex-1 h-12 rounded-xl text-sm font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 active:scale-95"
                >
                  <Layout className="w-4 h-4" />
                  Launch Workspace
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* LEFT: Benefits */}
              <div className="flex-1 p-6 md:p-10 lg:p-14 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
                    <Zap className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Do more with Pro</h2>
                    <p className="text-sm font-medium text-blue-400">Get unlimited AI usage and more storage so you never have to think about limits.</p>
                  </div>
                </div>

                <div className="space-y-6 flex-1 relative z-10">
                  {[
                    { 
                      title: 'All-in-One AI Powerhouse', 
                      desc: 'Gain Pro-tier access to ChatGPT, Claude, Google Gemini and More—all in one place. Our agents are workspace-aware, can search, create, edit and remove right where you work.' 
                    },
                    { 
                      title: 'Expanded Agentic Workspaces', 
                      desc: `Create up to ${PLAN_CONFIG.pro.MAX_SPACES} spaces with ${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} thoughts each (Free tier limits to ${PLAN_CONFIG.free.MAX_SPACES} spaces).` 
                    },
                    { 
                      title: 'File Intelligence & More Storage', 
                      desc: `Upload and analyze images & PDFs. Includes ${PLAN_CONFIG.pro.MAX_STORAGE_MB}MB of secure cloud storage with unlimited upload sizes.` 
                    },
                    { 
                      title: 'Pro Customization & Support', 
                      desc: 'Personalize your workspace with a custom AI personality and backgrounds, plus get 24/7 priority customer support.' 
                    }
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-white mb-1">{feature.title}</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coming Soon Section */}
                <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 flex gap-4 items-start relative overflow-hidden group">
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
                </div>
              </div>

              {/* RIGHT: Pricing Checkout */}
              <div className="w-full md:w-[380px] lg:w-[440px] p-6 md:p-10 lg:p-14 bg-white/[0.02] border-t md:border-t-0 md:border-l border-white/5 flex flex-col justify-center">
                
                <div className="flex flex-col items-center text-center mb-8">
                  {/* Billing Toggle */}
                  <div className="relative flex p-1 bg-black/40 border border-white/5 rounded-xl mb-8 w-full">
                    <motion.div 
                      layoutId="pageBillingCycleToggle"
                      className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white/15 shadow-sm"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      animate={{ x: billingCycle === 'monthly' ? '0%' : '100%' }}
                    />
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={cn(
                        "relative z-10 flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors",
                        billingCycle === 'monthly' ? "text-white" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={cn(
                        "relative z-10 flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2",
                        billingCycle === 'yearly' ? "text-white" : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Yearly
                      <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-tight shadow-sm whitespace-nowrap">
                        Save {location?.isLocalPricing ? `${savingsTnd}DT` : `$${savings}`}
                      </span>
                    </button>
                  </div>

                  {/* Price Display */}
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
                    {location?.isLocalPricing 
                      ? (billingCycle === 'yearly' ? `One-time payment of ${currentPrice.tnd} DT per year.` : 'Manual renewal via Flouci. No auto-charges.')
                      : (billingCycle === 'yearly' ? `Recurring payment of $${proPrice.yearly.usd} per year via Polar.sh. Cancel anytime.` : `Recurring monthly subscription via Polar.sh. Cancel anytime.`)
                    }
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
                      className="text-center mb-6 bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 backdrop-blur-md"
                    >
                      <div className="relative w-12 h-12 mx-auto mb-3">
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                        <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
                      </div>
                      <p className="text-sm font-bold text-white mb-1">Verifying Upgrade</p>
                      <p className="text-xs text-blue-400/80 font-medium leading-relaxed">{paymentMessage}</p>
                    </motion.div>
                  )}
                  {paymentStatus === 'idle' && paymentMessage && (
                     <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center mb-6 bg-white/5 p-6 rounded-2xl border border-white/10"
                    >
                      <Loader2 className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-3 opacity-50" />
                      <p className="text-xs text-slate-300 font-medium leading-relaxed">{paymentMessage}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Terms Checkbox */}
                <label className="flex items-start gap-3 mb-6 cursor-pointer group select-none">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                      acceptedTerms
                        ? "bg-blue-600 border-blue-500"
                        : "bg-white/5 border-white/20 group-hover:border-white/40"
                    )}>
                      {acceptedTerms && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 leading-relaxed">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                      Terms of Service
                    </a>
                    {' '}and{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
                      Privacy Policy
                    </a>
                  </span>
                </label>

                {/* Upgrade Button */}
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading || !acceptedTerms}
                  className={cn(
                    "w-full h-14 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-3 mb-4",
                    isLoading || !acceptedTerms
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

                {!user && (
                  <div className="text-center mb-6">
                    <p className="text-[11px] text-slate-500 mb-3">
                      Please sign in to your account before upgrading.
                    </p>
                    <button
                      onClick={() => window.location.href = '/login'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-all active:scale-95"
                    >
                      Sign In with Google
                    </button>
                  </div>
                )}

                {/* Security Note */}
                <div className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center gap-3 text-left mt-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Secure local & global payments via <span className="text-white font-semibold">{location?.isLocalPricing ? 'Flouci' : 'Polar.sh'}</span>.
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Toggle Features Button */}
        {!isProUser && (
          <div className="text-center mb-8">
            <button
              onClick={() => setShowFeatures(!showFeatures)}
              className="px-6 py-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-semibold text-white transition-colors flex items-center gap-2 mx-auto"
            >
              <Layout className="w-4 h-4 text-blue-400" />
              {showFeatures ? 'Hide' : 'View'} Full Comparison
              <motion.div
                animate={{ rotate: showFeatures ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </button>
          </div>
        )}

        {/* 3-Column Comparison Table */}
        {!isProUser && (
          <motion.div
            initial={false}
            animate={{ 
              height: showFeatures ? 'auto' : 0,
              opacity: showFeatures ? 1 : 0
            }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="glass bg-[#0B0F19]/60 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Table Header */}
              <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-4 py-6 px-6 bg-white/[0.03] border-b border-white/10 items-center">
                <div className="text-left">
                  <span className="text-sm font-bold uppercase tracking-wider text-slate-400">Features Comparison</span>
                </div>
                <div className="text-center">
                  <span className="text-lg font-bold text-white">Free</span>
                </div>
                <div className="text-center relative">
                  <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Pro</span>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-white/5">
                <ComparisonRow 
                  label="Agentic Workspaces" 
                  free={`${PLAN_CONFIG.free.MAX_SPACES} Spaces`} 
                  pro={`${PLAN_CONFIG.pro.MAX_SPACES} Spaces`} 
                  highlight 
                />
                <ComparisonRow 
                  label="Thoughts per Space" 
                  free={`${PLAN_CONFIG.free.MAX_THOUGHTS_PER_SPACE} thoughts`} 
                  pro={`${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} thoughts`} 
                  highlight 
                />
                <ComparisonRow 
                  label="Cloud Storage" 
                  free={`${PLAN_CONFIG.free.MAX_STORAGE_MB}MB`} 
                  pro={`${PLAN_CONFIG.pro.MAX_STORAGE_MB}MB`} 
                />
                <ComparisonRow 
                  label="AI Requests quota" 
                  free="Rate Limited" 
                  pro="Unlimited & Generous for premium models"
                />
                <ComparisonRow 
                  label="AI Models" 
                  free="Basic Models"
                  pro="Latest ChatGPT, Claude, Gemini and more Models" 
                  highlight
                />
                <ComparisonRow 
                  label="Agentic Capabilities" 
                  free="None"
                  pro=" Web Search, Youtube Search, Generating, Editing, Organizing, Removing and More"
                  highlight
                />
                <ComparisonRow 
                  label="File Intelligence" 
                  free="Text only" 
                  pro="Docs, Tables, Images & PDFs"
                />
                <ComparisonRow 
                  label="UI Themes" 
                  free="Standard" 
                  pro="All Premium Themes + Custom background" 
                />
                <ComparisonRow 
                  label="Custom AI Personality" 
                  free={<span className="text-slate-600">None</span>} 
                  pro={<Check className="w-4 h-4 text-blue-400 mx-auto" />} 
                />
                <ComparisonRow 
                  label="Customer Support" 
                  free={<span className="text-slate-500">Standard</span>} 
                  pro={<span className="text-blue-400 font-bold">24/7 Priority</span>} 
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Footer Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-16 text-[13px]">
          <a href="/privacy" className="text-slate-500 hover:text-slate-300 transition-colors font-medium">Privacy Policy</a>
          <a href="/terms" className="text-slate-500 hover:text-slate-300 transition-colors font-medium">Terms of Sale</a>
          <a href="/legal" className="text-slate-500 hover:text-slate-300 transition-colors font-medium">Legal Notice</a>
          <a href="/contact" className="text-slate-500 hover:text-slate-300 transition-colors font-medium">Contact</a>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;