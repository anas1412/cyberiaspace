import React from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { ArrowLeft } from 'lucide-react';

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

  const handleLogin = () => {
    const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const REDIRECT_URI = window.location.origin + '/api/auth/callback';
    
    // Generate secure random state and nonce
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();

    // Store in cookies for backend verification (15 min expiry)
    const isLocalhost = window.location.hostname === 'localhost';
    const cookieDomain = isLocalhost ? '' : '; domain=.cyberia.tn';
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toUTCString();
    document.cookie = `auth_state=${state}; path=/; expires=${expiry}; SameSite=Lax; Secure${cookieDomain}`;
    document.cookie = `auth_nonce=${nonce}; path=/; expires=${expiry}; SameSite=Lax; Secure${cookieDomain}`;

    const SCOPE = 'openid email profile';
    const RESPONSE_TYPE = 'code';
    const ACCESS_TYPE = 'offline';
    const PROMPT = 'consent';

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=${RESPONSE_TYPE}&` +
      `scope=${encodeURIComponent(SCOPE)}&` +
      `access_type=${ACCESS_TYPE}&` +
      `state=${state}&` +
      `nonce=${nonce}&` +
      `prompt=${PROMPT}`;

    window.location.href = authUrl;
  };

  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-black flex items-center justify-center p-6 overflow-hidden select-none">
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
          className="mb-8 flex items-center gap-2 text-slate-500 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Space</span>
        </button>

        <div className="glass p-8 md:p-16 rounded-[3rem] border border-white/10 shadow-2xl space-y-10 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
              Welcome <span className="text-blue-500">Back</span>
            </h1>
            <p className="text-[10px] md:text-[12px] font-bold text-slate-500 uppercase tracking-[0.3em]">
              Synchronize your workspace
            </p>
          </div>

          <div className="space-y-6">
            <p className="text-[11px] md:text-[13px] text-slate-400 leading-relaxed font-medium max-w-sm mx-auto uppercase tracking-wider">
              Sign in to enable cross-device synchronization, secure cloud backups, and advanced Oracle AI features.
            </p>

            <div className="flex justify-center pt-4">
              <button
                onClick={handleLogin}
                disabled={status === 'loading'}
                style={{
                  fontFamily: "'Roboto', sans-serif",
                  fontWeight: 500,
                }}
                className="h-[44px] md:h-[48px] pl-[12px] pr-[16px] bg-[#F2F2F2] text-[#1F1F1F] rounded-[4px] hover:bg-[#e5e5e5] active:bg-[#dcdcdc] flex items-center justify-center group pointer-events-auto shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-[20px] h-[20px] bg-[#F2F2F2] rounded-full flex items-center justify-center mr-[12px] flex-shrink-0 overflow-hidden">
                  <GoogleIcon />
                </div>
                <span 
                  style={{ lineHeight: '20px' }}
                  className="text-[14px] tracking-[0.25px] font-medium whitespace-nowrap"
                >
                  Sign in with Google
                </span>
              </button>
            </div>
          </div>

          <div className="pt-8 border-t border-white/5 text-center space-y-4">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 italic leading-loose">
              By signing in, you agree to our policies<br/>
              and the storage of your profile data.
            </p>
            <div className="flex items-center justify-center gap-4 opacity-40">
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </button>
              <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
              <button 
                onClick={() => {
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
