import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, ArrowLeft, Headphones, Copy, Check, ArrowRight } from 'lucide-react';
import { DISCORD_INVITE_URL } from '../../constants';

const Contact: React.FC = () => {
  const [emailCopied, setEmailCopied] = useState(false);

  const SUPPORT_EMAIL = 'support@cyberiaspace.app';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = SUPPORT_EMAIL;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-page)] text-[var(--text-muted)] p-6 md:p-20 overflow-y-auto custom-scroll selection:bg-blue-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-400 hover:text-[var(--text-primary)] transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-semibold tracking-widest">Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Headphones className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">Contact</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Get in touch with us</p>
        </header>

        {/* Email Support */}
        <div className="bg-blue-500/5 border border-blue-500/10 p-8 md:p-12 rounded-[2.5rem] mb-8 transition-all duration-500 hover:border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Mail className="w-7 h-7 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">Email Support</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">Send us an email and we'll get back to you within 24 hours</p>
              </div>
            </div>
            <button 
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-[#ffffff] rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] whitespace-nowrap"
            >
              {emailCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  {SUPPORT_EMAIL}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Discord Community */}
        <div className="bg-blue-500/5 border border-blue-500/10 p-8 md:p-12 rounded-[2.5rem] mb-8 transition-all duration-500 hover:border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">Join our Community</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">Connect with other users, share feedback, and get help from the community</p>
              </div>
            </div>
            <a 
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-[#ffffff] rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] whitespace-nowrap"
            >
              Join Discord
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

      </motion.div>
    </div>
  );
};

export default Contact;
