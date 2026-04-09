import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Database, Globe, Brain, UserCheck, Lock, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const articles = [
    {
      id: 1,
      title: t('legal.privacy.articles.article_1.title'),
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          {t('legal.privacy.articles.article_1.content')}
        </p>
      )
    },
    {
      id: 2,
      title: t('legal.privacy.articles.article_2.title'),
      icon: <Database className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.privacy.articles.article_2.content_1')}
          </p>
          <p className="leading-relaxed text-[var(--text-primary)] font-medium mt-2">
            {t('legal.privacy.articles.article_2.content_2')}
          </p>
        </>
      )
    },
    {
      id: 3,
      title: t('legal.privacy.articles.article_3.title'),
      icon: <UserCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.privacy.articles.article_3.content')}
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.privacy.articles.article_3.identity_info')}</strong> {t('legal.privacy.articles.article_3.identity_info_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.privacy.articles.article_3.usage_data')}</strong> {t('legal.privacy.articles.article_3.usage_data_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.privacy.articles.article_3.payment_data')}</strong> {t('legal.privacy.articles.article_3.payment_data_desc')}</li>
          </ul>
        </>
      )
    },
    {
      id: 4,
      title: t('legal.privacy.articles.article_4.title'),
      icon: <Globe className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-dimmed)]">
            {t('legal.privacy.articles.article_4.content_1')}
          </p>
          <p className="leading-relaxed text-sm text-[var(--text-muted)] mt-2">
            {t('legal.privacy.articles.article_4.content_2')}
          </p>
        </>
      )
    },
    {
      id: 5,
      title: t('legal.privacy.articles.article_5.title'),
      icon: <Brain className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.privacy.articles.article_5.content')}
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)] italic">
            <li>{t('legal.privacy.articles.article_5.bullet_1')}</li>
            <li>{t('legal.privacy.articles.article_5.bullet_2')}</li>
            <li>{t('legal.privacy.articles.article_5.bullet_3')}</li>
          </ul>
        </>
      )
    },
    {
      id: 6,
      title: t('legal.privacy.articles.article_6.title'),
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.privacy.articles.article_6.content')}
          </p>
          <p className="leading-relaxed text-[var(--text-muted)] mt-4">
            We use multiple layers of security to protect your files and data:
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">Private Storage</strong> — Your files are stored in a private cloud bucket that cannot be accessed via public URLs. Only authenticated users can access their own files.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Signed URLs</strong> — When accessing files, we generate time-limited signed URLs (1-hour expiry) rather than using permanent public links.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Local-First Storage</strong> — Your files are stored locally in your browser first (IndexedDB). The cloud is used only for backup and cross-device sync.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Row-Level Security</strong> — Database policies ensure you can only access your own data. There is no way for one user to view or modify another user's files.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Local-Only Backgrounds</strong> — Space backgrounds stay on your device only, never uploaded to the cloud.</li>
          </ul>
        </>
      )
    },
    {
      id: 7,
      title: t('legal.privacy.articles.article_7.title'),
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.privacy.articles.article_7.content')}
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.privacy.articles.article_7.portability')}</strong> {t('legal.privacy.articles.article_7.portability_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.privacy.articles.article_7.erasure')}</strong> {t('legal.privacy.articles.article_7.erasure_desc')}</li>
</ul>
        </>
      )
    },
    {
      id: 8,
      title: t('legal.privacy.articles.article_8.title'),
      icon: <Mail className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          {t('legal.privacy.articles.article_8.content')}
          <br />
          <a href="mailto:support@cyberiaspace.app" className="text-blue-400 font-bold hover:text-[var(--text-primary)] transition-colors">support@cyberiaspace.app</a>
        </p>
      )
    }
  ];

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
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{t('legal.privacy.title')}</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">{t('legal.privacy.effective_date')}</p>
        </header>

        <section className="space-y-8 pb-20">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className={`border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 ${
                article.highlight 
                  ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.03)]' 
                  : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {article.icon}
                <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest">
                  {article.title}
                </h2>
              </div>
              {article.content}
            </div>
          ))}
        </section>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicy;
