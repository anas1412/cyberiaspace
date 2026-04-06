import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare, ArrowLeft, Headphones, Send, Loader2, CheckCircle, ArrowRight, Copy, Check } from 'lucide-react';
import { DISCORD_INVITE_URL } from '../../constants';
import { useTranslation } from 'react-i18next';

const Contact: React.FC = () => {
  const { t } = useTranslation();
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [emailCopied, setEmailCopied] = useState(false);

  const SUPPORT_EMAIL = 'support@cyberiaspace.app';

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim() || isContactSubmitting) return;
    setIsContactSubmitting(true);
    setContactSubmitStatus('idle');
    try {
      const res = await fetch('/api/feedback?action=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
      });
      if (res.ok) {
        setContactSubmitStatus('success');
        setContactMessage('');
        setContactName('');
        setContactEmail('');
        setTimeout(() => setContactSubmitStatus('idle'), 5000);
      } else setContactSubmitStatus('error');
    } catch { setContactSubmitStatus('error'); } finally { setIsContactSubmitting(false); }
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
          <span className="text-xs font-semibold tracking-widest">{t('legal.back')}</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Headphones className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{t('legal.contact.title')}</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">{t('legal.contact.subtitle')}</p>
        </header>

      {/* Contact Form */}
        <section className="pb-20">
          <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest mb-6">{t('legal.contact.send_message')}</h2>
          
          {contactSubmitStatus === 'success' ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-500/10 border border-emerald-500/20 p-12 rounded-[2.5rem] text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
              <div>
                <p className="text-xl font-bold text-emerald-500">{t('homepage.contact.form.success')}</p>
                <p className="text-sm text-[var(--text-muted)] mt-2">{t('homepage.contact.form.success_desc')}</p>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleContactSubmit} className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-8 md:p-12 rounded-[2.5rem] space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="contact-name" className="text-sm font-semibold text-[var(--text-dimmed)] uppercase tracking-wider">{t('homepage.contact.form.name')}</label>
                  <input 
                    id="contact-name"
                    type="text" 
                    placeholder={t('homepage.contact.form.placeholder_name')} 
                    value={contactName} 
                    onChange={(e) => setContactName(e.target.value)} 
                    className="w-full h-14 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-2xl px-5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contact-email" className="text-sm font-semibold text-[var(--text-dimmed)] uppercase tracking-wider">{t('homepage.contact.form.email')} <span className="text-rose-400">*</span></label>
                  <input 
                    id="contact-email"
                    type="email" 
                    required 
                    placeholder={t('homepage.contact.form.placeholder_email')} 
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)} 
                    className="w-full h-14 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-2xl px-5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="contact-message" className="text-sm font-semibold text-[var(--text-dimmed)] uppercase tracking-wider">{t('homepage.contact.form.message')} <span className="text-rose-400">*</span></label>
                <textarea 
                  id="contact-message"
                  required 
                  value={contactMessage} 
                  onChange={(e) => setContactMessage(e.target.value)} 
                  placeholder={t('homepage.contact.form.placeholder_message')} 
                  className="w-full h-40 bg-[var(--bg-page)] border border-[var(--glass-border)] rounded-2xl p-5 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none" 
                />
              </div>
              {contactSubmitStatus === 'error' && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-semibold text-center">
                  {t('homepage.contact.form.error')}
                </div>
              )}
              <button 
                type="submit" 
                disabled={isContactSubmitting || !contactMessage.trim() || !contactEmail.trim()} 
                className="w-full h-14 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--bg-page)] rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 hover:shadow-xl active:scale-[0.98]"
              >
                {isContactSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('homepage.contact.form.submit')}
                    <Send className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        {/* Email Support */}
        <div className="bg-blue-500/5 border border-blue-500/10 p-8 md:p-12 rounded-[2.5rem] mb-8 transition-all duration-500 hover:border-blue-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                <Mail className="w-7 h-7 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">{t('legal.contact.email_support')}</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">{t('legal.contact.email_support_desc')}</p>
              </div>
            </div>
            <button 
              onClick={handleCopyEmail}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-[#ffffff] rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] whitespace-nowrap"
            >
              {emailCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  {t('legal.contact.copied')}
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
                <h3 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">{t('legal.contact.join_community')}</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">{t('legal.contact.join_community_desc')}</p>
              </div>
            </div>
            <a 
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-[#ffffff] rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] whitespace-nowrap"
            >
              {t('legal.contact.join_discord')}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        
      </motion.div>
    </div>
  );
};

export default Contact;
