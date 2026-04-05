import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useStore } from '../../store/useStore';
import { supabase } from '../../services/supabase';
import { ArrowLeft, AlertCircle, Loader2, Mail, Zap } from 'lucide-react';

const GoogleIcon = () => (
  <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    <path fill="none" d="M0 0h48v48H0z"/>
  </svg>
);

const LoginPage: React.FC = () => {
  const { status } = useAuthStore();
  
  useEffect(() => {
    if (status === 'authenticated') {
      window.location.href = '/home';
    }
  }, [status]);

  // Error Handling & Loading State Management
  const searchParams = new URLSearchParams(window.location.search);
  const errorParam = searchParams.get('error');

  useEffect(() => {
    if (errorParam) {
      console.error('[Auth] Redirect error detected:', errorParam);
      useStore.setState({ isInitializing: false });
      useAuthStore.setState({ status: 'unauthenticated', syncStatus: 'offline' });
    }
  }, [errorParam]);

  // Magic Link state
  const [isMagicLinkMode, setIsMagicLinkMode] = useState(false);
  const [email, setEmail] = useState('');
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    
    const currentOrigin = window.location.origin;
    console.log('[Auth] Current origin:', currentOrigin);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${currentOrigin}/home`,
      },
    });

    if (error) {
      console.error('[Auth] Supabase OAuth error:', error);
      setIsLoading(false);
      return;
    } 
    
    if (data?.url) {
      console.log('[Auth] Full OAuth URL:', data.url);
      window.location.href = data.url;
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setMagicLinkError('Please enter your email address');
      return;
    }

    setIsMagicLinkLoading(true);
    setMagicLinkError('');

    const currentOrigin = window.location.origin;
    
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${currentOrigin}/home`,
      },
    });

    if (error) {
      console.error('[Auth] Magic link error:', error);
      setMagicLinkError(error.message);
      setIsMagicLinkLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setIsMagicLinkLoading(false);
  };

  const [isLoading, setIsLoading] = useState(false);

  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-[var(--bg-page)] flex items-center justify-center p-6 overflow-hidden select-none">
      {/* Background Layers matching Cyberia theme */}
      <div className="fixed inset-0 z-0">
        <div className="stars-layer stars-1" />
        <div className="stars-layer stars-2" />
        <div className="stars-layer stars-twinkle" />
        <div className="nebula-cloud" />
        <div className="grain" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md md:max-w-lg"
      >
        <button
          onClick={handleBack}
          className="mb-8 flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-semibold tracking-wide">Back</span>
        </button>

        <div className="glass p-8 md:p-16 rounded-2xl border border-[var(--glass-border)] shadow-2xl space-y-10 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold text-[var(--text-primary)] tracking-tight leading-none whitespace-nowrap">
              WELCOME <span style={{ color: 'var(--accent)' }}>BACK</span>
            </h1>
            <p className="text-[12px] md:text-[14px] font-medium text-[var(--text-muted)]">
              Synchronize your space
            </p>
          </div>

          {errorParam && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <p className="text-[10px] font-semibold tracking-wide text-red-400 text-left leading-tight">
                Authentication snaged. <br/>
                <span className="opacity-60">Try signing in again.</span>
              </p>
            </div>
          )}

          <div className="space-y-6">
            <p className="text-[13px] md:text-[14px] text-[var(--text-muted)] leading-relaxed font-medium max-w-sm mx-auto">
              Sign in to enable cross-device synchronization, secure cloud backups, and advanced Oracle AI features.
            </p>

            {/* Google Button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleLogin}
                disabled={status === 'loading' || isLoading}
                className="h-[44px] md:h-[48px] px-5 bg-[#F2F2F2] text-[#1F1F1F] rounded-xl hover:bg-[#e5e5e5] active:bg-[#dcdcdc] active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="w-[20px] h-[20px] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <GoogleIcon />
                  </div>
                )}
                <span className="text-[14px] font-medium whitespace-nowrap">
                  {isLoading ? 'Signing in...' : 'Sign in with Google'}
                </span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-[var(--glass-border)]"></div>
              <span className="flex-shrink-0 mx-4 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
                Or
              </span>
              <div className="flex-grow border-t border-[var(--glass-border)]"></div>
            </div>

            {/* Magic Link Section */}
            {!isMagicLinkMode ? (
              <div className="flex justify-center">
                <button
                  onClick={() => setIsMagicLinkMode(true)}
                  className="h-[44px] md:h-[48px] px-5 bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-page)] active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <Mail className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="text-[14px] font-medium whitespace-nowrap">
                    Sign in with Email
                  </span>
                </button>
              </div>
            ) : magicLinkSent ? (
              <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl p-6 space-y-3">
                <Zap className="w-8 h-8 text-[var(--accent)] mx-auto" />
                <p className="text-[13px] font-medium text-[var(--accent)]">
                  Check your email!
                </p>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  We sent a magic link to <span className="text-[var(--text-primary)]">{email}</span>
                  <br />
                  Click the link in the email to sign in.
                </p>
                <button
                  onClick={() => {
                    setMagicLinkSent(false);
                    setEmail('');
                  }}
                  className="text-[11px] font-medium text-[var(--accent-secondary)] hover:underline"
                >
                  Send to a different email
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setMagicLinkError('');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
                  className="w-full h-[44px] px-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all"
                />
                
                {magicLinkError && (
                  <p className="text-[11px] text-red-400 text-left">{magicLinkError}</p>
                )}
                
                <button
                  onClick={handleMagicLink}
                  disabled={isMagicLinkLoading || !email.trim()}
                  className="w-full h-[44px] bg-[var(--accent)] text-white rounded-xl font-medium text-[14px] hover:bg-[var(--accent-secondary)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-200"
                >
                  {isMagicLinkLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Send Magic Link</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setIsMagicLinkMode(false);
                    setMagicLinkSent(false);
                    setEmail('');
                    setMagicLinkError('');
                  }}
                  className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  ← Back to Google sign in
                </button>
              </div>
            )}
          </div>

          <div className="pt-8 border-t border-[var(--glass-border)] text-center space-y-4">
            <p className="text-[12px] font-medium text-[var(--text-muted)] italic leading-relaxed">
              By signing in, you agree to our policies
              and the storage of your profile data.
            </p>
            <div className="flex items-center justify-center gap-4 opacity-40 flex-wrap">
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Privacy Policy
              </button>
              <span className="w-0.5 h-0.5 rounded-full bg-[var(--glass-border)]" />
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Terms of Sale (CGV)
              </button>
              <span className="w-0.5 h-0.5 rounded-full bg-[var(--glass-border)]" />
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/legal');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Legal Notice
              </button>
              <span className="w-0.5 h-0.5 rounded-full bg-[var(--glass-border)]" />
              <button
                onClick={() => {
                  window.history.pushState({}, '', '/contact');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Contact
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
