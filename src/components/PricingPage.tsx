import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { PLAN_CONFIG, type AccessPeriod } from '../constants';
import { resolvePricingLocation } from '../utils/pricing';
import { Sparkles, Check, Star, Shield, Loader2, CreditCard, ExternalLink, Smartphone, Layout, AlertCircle, RefreshCw, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BackgroundEngine from './background/BackgroundEngine';
import Navigation from './Navigation';
import Footer from './Footer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 3-Column Comparison Row component
const ComparisonRow: React.FC<{ label: string; free: string | React.ReactNode; pro: string | React.ReactNode; enterprise?: string | React.ReactNode; highlight?: boolean }> = ({ 
  label,
  free, 
  pro,
  enterprise,
  highlight 
}) => (
  <div className={cn(
    "grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 py-4 px-6 border-b border-[var(--border)] items-center transition-colors",
    highlight ? "bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-500/[0.03] dark:hover:bg-blue-500/[0.05]" : "hover:bg-[var(--glass-bg)]"
  )}>
    <div className="text-left">
      <span className="text-sm font-semibold text-[var(--text-dimmed)]">{label}</span>
    </div>
    <div className="text-center">
      {typeof free === 'string' ? (
        <span className="text-sm font-medium text-[var(--text-muted)]">{free}</span>
      ) : (
        free
      )}
    </div>
    <div className="text-center">
      {typeof pro === 'string' ? (
        <span className={cn("text-sm font-bold", highlight ? "text-blue-600 dark:text-blue-400" : "text-[var(--text-primary)]")}>
          {pro}
        </span>
      ) : (
        pro
      )}
    </div>
    <div className="text-center">
      {typeof enterprise === 'string' ? (
        <span className={cn("text-sm font-bold", highlight ? "text-[var(--accent)] dark:text-[var(--accent)]" : "text-[var(--text-primary)]")}>
          {enterprise}
        </span>
      ) : enterprise ? (
        enterprise
      ) : (
        <span className="text-[var(--text-muted)]">—</span>
      )}
    </div>
  </div>
);

const PricingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, accessToken } = useAuthStore();
  const [billingCycle, setBillingCycle] = useState<AccessPeriod>('monthly');
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  // Check if user is already Pro
  const isProUser = user?.plan === 'pro';

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const currentPrice = billingCycle === 'monthly' ? proPrice.monthly : proPrice.yearly;
  const savings = Math.round((proPrice.monthly.usd * 12 - proPrice.yearly.usd));
  const savingsTnd = Math.round((proPrice.monthly.tnd * 12 - proPrice.yearly.tnd));

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
      if (fail !== null) {
        setPaymentStatus('failed');
        setPaymentMessage('Payment was cancelled or failed. Your account was not charged.');
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (paymentId) {
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
              setPaymentMessage(data.message || 'Payment failed. Please try again or use a different card.');
            }
          })
          .catch(() => {
            setPaymentStatus('failed');
            setPaymentMessage('Unable to confirm payment status. Please try refreshing the page.');
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

  // Failure state (Full Page)
  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]">
        <BackgroundEngine />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass bg-[var(--bg-page)]/90 p-12 rounded-2xl border border-rose-500/30 text-center max-w-lg shadow-2xl shadow-rose-500/10"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500/20 to-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/30">
              <AlertCircle className="w-10 h-10 text-rose-500 dark:text-rose-400" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">{t('pricing.status.failed')}</h2>
            <p className="text-base text-[var(--text-muted)] font-medium leading-relaxed mb-8">{paymentMessage || t('pricing.status.failed_desc')}</p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setPaymentStatus('idle');
                  setPaymentMessage('');
                }}
                className="w-full h-14 rounded-2xl text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-lg shadow-rose-500/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <RefreshCw className="w-4 h-4" />
                {t('pricing.status.try_another')}
              </button>
              <button
                onClick={() => window.location.href = '/home'}
                className="w-full h-12 rounded-2xl text-sm font-semibold tracking-wide text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                {t('pricing.status.return')}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Success state (Full Page)
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]">
        <BackgroundEngine />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glass bg-[var(--bg-page)]/90 p-12 rounded-2xl border border-green-500/30 text-center max-w-lg shadow-2xl shadow-green-500/10"
          >
            <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/30">
              <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-500" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-3">{t('pricing.status.success')}</h2>
            <p className="text-base text-emerald-600 dark:text-emerald-500 font-medium leading-relaxed mb-8">{paymentMessage}</p>
            <button
              onClick={() => window.location.href = '/home'}
              className="w-full h-14 rounded-2xl text-sm font-semibold tracking-wide transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg shadow-green-500/25 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              Enter Cyberia
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-[var(--bg-page)] text-[var(--text-primary)]">
      <BackgroundEngine />
      
      <Navigation />

      <div className="relative z-10 max-w-5xl mx-auto px-4 pt-32 pb-24 md:pt-40 md:pb-32">
        
        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          {/* Made consistent with Homepage titles */}
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            {isProUser ? (
              <>
                {t('pricing.hero.title_pro')}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]">
                  Pro
                </span>
              </>
            ) : (
              <>
                {t('pricing.hero.title_unlock')}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]">
                  {t('pricing.hero.title_accent')}
                </span>
              </>
            )}
          </h1>
          <p className="text-[var(--text-muted)] font-medium text-base max-w-2xl mx-auto mt-6">
            {isProUser 
              ? t('pricing.hero.subtitle_pro', { date: user?.expiryDate ? new Date(user.expiryDate).toLocaleDateString() : 'the end of your period' })
              : t('pricing.hero.subtitle_unlock')
            }
          </p>
        </motion.div>

        {/* Hero Pricing Card */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "glass bg-[var(--bg-page)]/90 w-full rounded-2xl border overflow-hidden shadow-2xl mb-12",
            isProUser ? "border-green-500/30 flex-col p-10 md:p-14 text-center items-center" : "border-[var(--glass-border)] flex flex-col md:flex-row"
          )}
        >
          {isProUser ? (
            <div className="relative z-10 w-full flex flex-col items-center">
              <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/2" />
              
              {/* Badges should be text-xs */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                <span className="text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-500 uppercase">{t('pricing.pro_card.active_badge')}</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter text-[var(--text-primary)] mb-4">{t('pricing.pro_card.unlocked_title')}</h2>
              <p className="text-[var(--text-muted)] mb-8 max-w-lg mx-auto">{t('pricing.pro_card.unlocked_desc')}</p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4 w-full max-w-md">
                {user?.paymentProvider === 'polar' && (
                  <button
                    onClick={handleManageSubscription}
                    className="flex-1 h-12 rounded-xl text-sm font-semibold tracking-wide bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80 text-[var(--text-primary)] border border-[var(--glass-border)] transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
                    {t('pricing.pro_card.manage_billing')}
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                )}
                <button
                  onClick={() => window.location.href = '/home'}
                  className="flex-1 h-12 rounded-xl text-sm font-semibold tracking-wide bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                >
                  <Layout className="w-4 h-4" />
                  {t('pricing.pro_card.access_space')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* LEFT: Benefits */}
              <div className="flex-1 p-6 md:p-10 lg:p-14 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-lg shadow-blue-500/10">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter text-[var(--text-primary)]">{t('pricing.pro_card.unlock_pro')}</h2>
                    <p className="text-base font-medium text-blue-600 dark:text-blue-400">{t('pricing.pro_card.pro_desc', { storage: PLAN_CONFIG.pro.MAX_STORAGE_MB })}</p>
                  </div>
                </div>

                <div className="space-y-6 flex-1 relative z-10">
                  {[
                    { 
                      title: t('pricing.pro_card.feature_ai.title'), 
                      desc: t('pricing.pro_card.feature_ai.desc')
                    },
                    { 
                      title: t('pricing.pro_card.feature_spaces.title'), 
                      desc: t('pricing.pro_card.feature_spaces.desc', { maxSpaces: PLAN_CONFIG.pro.MAX_SPACES, maxThoughts: PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE, freeSpaces: PLAN_CONFIG.free.MAX_SPACES })
                    },
                    { 
                      title: t('pricing.pro_card.feature_files.title'), 
                      desc: t('pricing.pro_card.feature_files.desc', { storage: PLAN_CONFIG.pro.MAX_STORAGE_MB })
                    },
                  ].map((feature, i) => (
                    <div key={i} className="flex gap-4 group">
                      <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-[var(--text-primary)] mb-1">{feature.title}</h4>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coming Soon Section */}
                <div className="mt-8 p-5 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border border-indigo-500/10 flex gap-4 items-start relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-16 -mt-16 transition-opacity group-hover:opacity-75" />
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 z-10 shadow-inner">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="z-10 flex-1">
                    <div className="flex items-center gap-3 mb-1.5 whitespace-nowrap">
                      <h4 className="text-base font-semibold text-[var(--text-primary)]">{t('pricing.pro_card.mobile_app.title')}</h4>
                      <span className="text-[10px] font-bold tracking-wide bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2.5 py-0.5 rounded-full uppercase shadow-lg shadow-indigo-500/25">
                        {t('pricing.pro_card.mobile_app.badge')}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                      {t('pricing.pro_card.mobile_app.desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* RIGHT: Pricing Checkout */}
              <div className="w-full md:w-[380px] lg:w-[440px] p-6 md:p-10 lg:p-14 bg-[var(--glass-bg)] border-t md:border-t-0 md:border-l border-[var(--glass-border)] flex flex-col justify-center">
                
                <div className="flex flex-col items-center text-center mb-8">
                  {/* Billing Toggle */}
                  <div className="relative flex p-1 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-xl mb-8 w-full">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className={cn(
                        "relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        billingCycle === 'monthly' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
                      )}
                    >
                      {billingCycle === 'monthly' && (
                        <motion.div 
                          layoutId="pageBillingCycleToggle"
                          className="absolute inset-0 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 shadow-sm"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-20">{t('pricing.checkout.monthly')}</span>
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      className={cn(
                        "relative z-10 flex-1 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        billingCycle === 'yearly' ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-dimmed)]"
                      )}
                    >
                      {billingCycle === 'yearly' && (
                        <motion.div 
                          layoutId="pageBillingCycleToggle"
                          className="absolute inset-0 rounded-lg bg-blue-500/10 dark:bg-blue-500/15 shadow-sm"
                          initial={false}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-20">{t('pricing.checkout.yearly')}</span>
                      <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md tracking-wide shadow-md shadow-emerald-500/25 whitespace-nowrap relative z-20">
                        {t('pricing.checkout.save', { amount: location?.isLocalPricing ? `${savingsTnd}DT` : `$${savings}` })}
                      </span>
                    </button>
                  </div>

                  {/* Price Display */}
                  <div className="mb-4">
                    {location?.isLocalPricing ? (
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-xs font-bold tracking-wide uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full border border-blue-500/20">
                          {t('pricing.checkout.local_pricing')}
                        </span>
                        <div className="flex items-baseline justify-center">
                          <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)]">{currentPrice.tnd}</span>
                          <span className="text-xl text-[var(--text-muted)] ml-2 font-semibold">DT</span>
                        </div>
                        <span className="text-xs font-bold tracking-wide text-[var(--text-muted)] bg-[var(--glass-bg)] border border-[var(--glass-border)] px-3 py-1 rounded-full">
                          {t('pricing.checkout.global_price', { price: currentPrice.usd })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-center">
                        <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text-primary)]">${currentPrice.usd}</span>
                      </div>
                    )}
                    
                    <span className="text-[var(--text-muted)] font-semibold tracking-wide text-sm block mt-4">
                      {billingCycle === 'monthly' ? t('pricing.checkout.per_month') : t('pricing.checkout.per_year')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed px-4 font-medium">
                    {location?.isLocalPricing 
                      ? (t('pricing.checkout.manual_renewal'))
                      : (billingCycle === 'yearly' ? t('pricing.checkout.recurring_yearly') : t('pricing.checkout.recurring_monthly'))
                    }
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-rose-600 dark:text-rose-400 font-medium text-center mb-6 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20"
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
                        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
                      </div>
                      <p className="text-sm font-bold text-[var(--text-primary)] mb-1">Verifying Upgrade</p>
                      <p className="text-sm text-blue-600 dark:text-blue-400 font-medium leading-relaxed">{paymentMessage}</p>
                    </motion.div>
                  )}
                  {paymentStatus === 'idle' && paymentMessage && (
                     <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center mb-6 bg-[var(--glass-bg)] p-6 rounded-2xl border border-[var(--glass-border)]"
                    >
                      <Loader2 className="w-8 h-8 text-[var(--text-muted)] animate-spin mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-[var(--text-dimmed)] font-medium leading-relaxed">{paymentMessage}</p>
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
                          ? "bg-blue-600 border-blue-600"
                          : "bg-[var(--glass-bg)] border-[var(--glass-border)] group-hover:border-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg-page)]"
                     )}>
                      {acceptedTerms && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-sm text-[var(--text-muted)] leading-relaxed font-medium">
                    {t('pricing.checkout.agree_terms')}
                    <a href="/terms" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm">
                      {t('pricing.checkout.terms')}
                    </a>
                    {' '}{t('pricing.checkout.and')}{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm">
                      {t('pricing.checkout.privacy')}
                    </a>
                  </span>
                </label>

                {/* Upgrade Button */}
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading || !acceptedTerms}
                  className={cn(
                    "w-full h-14 rounded-2xl text-base font-semibold tracking-wide transition-all flex items-center justify-center gap-3 mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]",
                    isLoading || !acceptedTerms
                       ? "bg-[var(--glass-bg)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--glass-border)]"
                       : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 active:scale-95"
                  )}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 rounded-full border-2 border-[var(--glass-border)] border-t-white animate-spin" />
                  ) : (
                    <Star className="w-4 h-4 text-white" />
                  )}
                  {isLoading ? t('pricing.checkout.processing') : "Upgrade" }
                </button>

                {!user && (
                  <div className="text-center mb-6">
                    <p className="text-sm text-[var(--text-muted)] mb-3 font-medium">
                      {t('pricing.checkout.signin_note')}
                    </p>
                    <button
                      onClick={() => window.location.href = '/login'}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80 text-[var(--text-primary)] text-sm font-semibold tracking-wide border border-[var(--glass-border)] transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {t('pricing.checkout.signin_cta')}
                    </button>
                  </div>
                )}

                {/* Security Note */}
                <div className="p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center gap-3 text-left mt-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-sm text-[var(--text-muted)] font-medium">
                    {t('pricing.checkout.security_note', { provider: location?.isLocalPricing ? 'Flouci' : 'Polar.sh' })}
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Enterprise Card - Contact Sales */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent-secondary)]/5 w-full rounded-2xl border border-[var(--accent)]/20 overflow-hidden shadow-xl mb-8"
        >
          <div className="flex flex-col md:flex-row">
            {/* LEFT: Enterprise Benefits */}
            <div className="flex-1 p-6 md:p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent)]/10 blur-[60px] rounded-full -translate-y-1/4 translate-x-1/4" />
              
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent-secondary)]/20 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0 shadow-lg shadow-[var(--accent)]/10">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-semibold tracking-tighter text-[var(--text-primary)]">{t('pricing.enterprise.title')}</h2>
                  <p className="text-sm font-medium text-[var(--accent)]">{t('pricing.enterprise.subtitle')}</p>
                </div>
              </div>

              <div className="space-y-4 flex-1 relative z-10">
                {[
                  t('pricing.enterprise.features.members'),
                  t('pricing.enterprise.features.storage', { storage: PLAN_CONFIG.enterprise.MAX_STORAGE_MB / 1000 }),
                  t('pricing.enterprise.features.payasyougo'),
                  t('pricing.enterprise.features.collaboration'),
                  t('pricing.enterprise.features.support'),
                  t('pricing.enterprise.features.ai_limits'),
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-sm text-[var(--text-primary)] font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Enterprise CTA */}
            <div className="w-full md:w-72 p-6 md:p-8 bg-[var(--glass-bg)] border-t md:border-t-0 md:border-l border-[var(--accent)]/20 flex flex-col justify-center">
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-extrabold text-[var(--text-primary)]">{t('pricing.enterprise.price')}</span>
                  <span className="text-lg text-[var(--text-muted)] font-semibold">{t('pricing.enterprise.per_seat')}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium block mt-1">{t('pricing.enterprise.starting_at')}</span>
              </div>

              <button
                onClick={() => window.location.href = 'mailto:support@cyberiaspace.app?subject=Enterprise%20Plan%20Inquiry'}
                className="w-full h-12 rounded-xl text-sm font-semibold tracking-wide bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                <Users className="w-4 h-4" />
                {t('pricing.enterprise.cta')}
              </button>
              
              <p className="text-xs text-[var(--text-muted)] text-center mt-4 font-medium">
                {t('pricing.enterprise.discounts')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Toggle Features Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowFeatures(!showFeatures)}
            className="px-6 py-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg)]/80 text-sm font-semibold tracking-wide text-[var(--text-primary)] transition-colors flex items-center gap-2 mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {showFeatures ? t('pricing.comparison.cta_hide') : t('pricing.comparison.cta_show')}
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
        
        {/* 3-Column Comparison Table */}
        <motion.div
          initial={false}
          animate={{ 
            height: showFeatures ? 'auto' : 0,
            opacity: showFeatures ? 1 : 0
          }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="glass bg-[var(--bg-page)]/60 rounded-2xl border border-[var(--glass-border)] overflow-hidden shadow-2xl">
            {/* Table Header */}
            <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 py-6 px-6 bg-[var(--glass-bg)] border-b border-[var(--glass-border)] items-center">
              <div className="text-left">
                <span className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">{t('pricing.comparison.header')}</span>
              </div>
              <div className="text-center">
                <span className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{t('pricing.comparison.free')}</span>
              </div>
              <div className="text-center relative">
                <span className="text-lg font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{t('pricing.comparison.pro')}</span>
              </div>
              <div className="text-center relative">
                <span className="text-lg font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]">{t('pricing.comparison.enterprise')}</span>
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[var(--border)]">
              <ComparisonRow 
                label={t('pricing.comparison.rows.workspaces')} 
                free={`${PLAN_CONFIG.free.MAX_SPACES} ${t('pricing.comparison.spaces')}`} 
                pro={`${PLAN_CONFIG.pro.MAX_SPACES} ${t('pricing.comparison.spaces')}`}
                enterprise={`${PLAN_CONFIG.enterprise.MAX_SPACES}+`}
                highlight 
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.thoughts')} 
                free={`${PLAN_CONFIG.free.MAX_THOUGHTS_PER_SPACE}`} 
                pro={`${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE}`}
                enterprise={`${PLAN_CONFIG.enterprise.MAX_THOUGHTS_PER_SPACE}+`}
                highlight 
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.storage')} 
                free={`${PLAN_CONFIG.free.MAX_STORAGE_MB}MB`} 
                pro={PLAN_CONFIG.pro.MAX_STORAGE_MB >= 1024 ? '1GB' : `${PLAN_CONFIG.pro.MAX_STORAGE_MB}MB`}
                enterprise={`${PLAN_CONFIG.enterprise.MAX_STORAGE_MB / 1000}GB / user`}
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.members')} 
                free="1" 
                pro="1"
                enterprise="5+"
                highlight
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.ai_quota')} 
                free={<span className="text-[var(--text-muted)]">—</span>} 
                pro={t('pricing.comparison.rows.generous')}
                enterprise={t('pricing.comparison.rows.higher')}
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.ai_models')} 
                free={<span className="text-[var(--text-muted)]">—</span>}
                pro={t('pricing.comparison.rows.all_models')} 
                enterprise={t('pricing.comparison.rows.all_models')}
                highlight
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.agentic')} 
                free={<span className="text-[var(--text-muted)]">—</span>}
                pro={t('pricing.comparison.rows.full_access')}
                enterprise={t('pricing.comparison.rows.full_access')}
                highlight
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.file_intel')} 
                free={<span className="text-[var(--text-muted)]">—</span>}
                pro={t('pricing.comparison.rows.all_files')}
                enterprise={t('pricing.comparison.rows.all_files')}
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.collaboration')} 
                free={<span className="text-[var(--text-muted)]">—</span>} 
                pro={<span className="text-[var(--text-muted)]">—</span>}
                enterprise={<Check className="w-4 h-4 text-emerald-500 mx-auto" />}
                highlight
              />
              <ComparisonRow 
                label={t('pricing.comparison.rows.support')} 
                free={<span className="text-[var(--text-muted)]">—</span>} 
                pro={<Check className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto" />}
                enterprise={<span className="text-emerald-500 font-bold">{t('pricing.comparison.rows.dedicated')}</span>}
                highlight
              />
            </div>
          </div>
        </motion.div>

      </div>
      
      <Footer />
    </div>
  );
};

export default PricingPage;