import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, ShieldCheck, CreditCard, RefreshCw, AlertCircle, Scale, Building2, User, Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CGV: React.FC = () => {
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
      title: t('legal.cgv.articles.article_1.title'),
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          {t('legal.cgv.articles.article_1.content')}
        </p>
      )
    },
    {
      id: 2,
      title: t('legal.cgv.articles.article_2.title'),
      icon: <Building2 className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.cgv.articles.article_2.content')}
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.cgv.articles.article_2.pro_tier')}</strong> {t('legal.cgv.articles.article_2.pro_tier_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.cgv.articles.article_2.account_responsibility')}</strong> {t('legal.cgv.articles.article_2.account_responsibility_desc')}</li>
          </ul>
        </>
      )
    },
    {
      id: 3,
      title: t('legal.cgv.articles.article_3.title'),
      icon: <RefreshCw className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <div className="space-y-4">
          <div className="bg-[var(--glass-bg)] p-6 rounded-2xl border border-[var(--glass-border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              {t('legal.cgv.articles.article_3.local_payments')}
            </h3>
            <p className="leading-relaxed text-sm text-[var(--text-muted)]">
              {t('legal.cgv.articles.article_3.local_payments_desc')}
            </p>
          </div>

          <div className="bg-[var(--glass-bg)] p-6 rounded-2xl border border-[var(--glass-border)]">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              {t('legal.cgv.articles.article_3.international_payments')}
            </h3>
            <p className="leading-relaxed text-sm text-[var(--text-muted)]">
              {t('legal.cgv.articles.article_3.international_payments_desc')}
            </p>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: t('legal.cgv.articles.article_4.title'),
      icon: <CreditCard className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.cgv.articles.article_4.content')}
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.cgv.articles.article_4.local_payments')}</strong> {t('legal.cgv.articles.article_4.local_payments_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.cgv.articles.article_4.international_payments')}</strong> {t('legal.cgv.articles.article_4.international_payments_desc')}</li>
            <li><strong className="text-[var(--text-primary)] font-bold">{t('legal.cgv.articles.article_4.security')}</strong> {t('legal.cgv.articles.article_4.security_desc')}</li>
          </ul>
        </>
      )
    },
    {
      id: 5,
      title: t('legal.cgv.articles.article_5.title'),
      icon: <AlertCircle className="w-5 h-5 text-red-400" />,
      error: true,
      content: (
        <>
          <p className="leading-relaxed font-bold text-[var(--text-primary)]">
            {t('legal.cgv.articles.article_5.content')}
          </p>
          <p className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter mt-4 border-l-4 border-red-500 pl-4 py-2">
            {t('legal.cgv.articles.article_5.final_sale')}
          </p>
          <p className="leading-relaxed mt-4 text-sm text-[var(--text-muted)] italic">
            {t('legal.cgv.articles.article_5.free_tier_note')}
          </p>
        </>
      )
    },
    {
      id: 6,
      title: t('legal.cgv.articles.article_6.title'),
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-[var(--text-muted)] italic">
          {t('legal.cgv.articles.article_6.content')}
        </p>
      )
    },
    {
      id: 7,
      title: t('legal.cgv.articles.article_7.title'),
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.cgv.articles.article_7.content_1')}
          </p>
          <p className="leading-relaxed text-[var(--text-muted)] mt-3">
            <strong className="text-[var(--text-primary)]">{t('legal.cgv.articles.article_7.content_2')}</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2 ml-2 text-[var(--text-muted)]">
            <li>{t('legal.cgv.articles.article_7.bullet_1')}</li>
            <li>{t('legal.cgv.articles.article_7.bullet_2')}</li>
            <li>{t('legal.cgv.articles.article_7.bullet_3')}</li>
            <li>{t('legal.cgv.articles.article_7.bullet_4')}</li>
          </ul>
        </>
      )
    },
    {
      id: 8,
      title: t('legal.cgv.articles.article_8.title'),
      icon: <Ban className="w-5 h-5 text-red-400" />,
      error: true,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            {t('legal.cgv.articles.article_8.content')}
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3 ml-2 text-[var(--text-muted)]">
            <li>{t('legal.cgv.articles.article_8.bullet_1')}</li>
            <li>{t('legal.cgv.articles.article_8.bullet_2')}</li>
            <li>{t('legal.cgv.articles.article_8.bullet_3')}</li>
            <li>{t('legal.cgv.articles.article_8.bullet_4')}</li>
            <li>{t('legal.cgv.articles.article_8.bullet_5')}</li>
            <li>{t('legal.cgv.articles.article_8.bullet_6')}</li>
          </ul>
          <p className="leading-relaxed mt-4 text-sm text-[var(--text-muted)]">
            {t('legal.cgv.articles.article_8.violation_note')}
          </p>
        </>
      )
    },
    {
      id: 9,
      title: t('legal.cgv.articles.article_9.title'),
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-dimmed)]">
          {t('legal.cgv.articles.article_9.content')}
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
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">{t('legal.cgv.title')}</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">{t('legal.cgv.last_updated')}</p>
        </header>

        <section className="space-y-8 pb-20">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className={`border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 ${
                article.highlight 
                  ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.03)]' 
                  : article.error
                  ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20'
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

          <div className="pt-12 border-t border-[var(--glass-border)] flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex gap-4 opacity-30">
              <CreditCard className="w-8 h-8" />
              <ShieldCheck className="w-8 h-8" />
              <User className="w-8 h-8" />
            </div>
            <p className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)]">
              {t('legal.cgv.copyright')}
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default CGV;
