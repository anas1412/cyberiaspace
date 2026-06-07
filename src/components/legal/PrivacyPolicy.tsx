import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Database, Globe, Brain, Lock, Mail } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
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
      title: 'Introduction',
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          Cyberia (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we handle your information when you use our application. Cyberia is a local-first, open-source application — your data stays on your device. Please read this policy carefully.
        </p>
      )
    },
    {
      id: 2,
      title: 'Data We Collect',
      icon: <Database className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            Cyberia collects minimal data. The application is designed to work entirely locally — no accounts, no cloud sync, no data leaves your device unless you choose to use AI features.
          </p>
          <p className="leading-relaxed text-[var(--text-primary)] font-medium mt-2">
            We do not collect, sell, or share your personal data. We do not have access to your content.
          </p>
        </>
      )
    },
    {
      id: 3,
      title: 'Local-First Architecture',
      icon: <Globe className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-dimmed)]">
            Cyberia is built on a local-first architecture. All your data — thoughts, files, spaces, settings — is stored in your browser&apos;s IndexedDB database. Nothing is uploaded to any server. You own your data completely.
          </p>
          <p className="leading-relaxed text-sm text-[var(--text-muted)] mt-2">
            No account is required. No cloud storage is used. Your workspace stays on your machine and is never transmitted to us.
          </p>
        </>
      )
    },
    {
      id: 4,
      title: 'AI & OpenRouter',
      icon: <Brain className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            Cyberia offers optional AI features through OpenRouter. You must provide your own OpenRouter API key, which is stored locally in your browser and never sent to our servers. When you use AI features:
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li>Your prompts and selected thought content are sent directly from your browser to the AI model you choose via OpenRouter.</li>
            <li>We do not have access to your API key, your prompts, or the AI responses.</li>
            <li>Your data is not used to train or improve AI models.</li>
            <li>AI usage is subject to OpenRouter&apos;s privacy policy and the privacy policy of the model provider you select.</li>
          </ul>
        </>
      )
    },
    {
      id: 5,
      title: 'File Storage',
      icon: <Database className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          Files you add to Cyberia are stored as blobs in your browser&apos;s IndexedDB. They never leave your device. There is no cloud upload, no remote backup — your files stay local and under your control.
        </p>
      )
    },
    {
      id: 6,
      title: 'Security Measures',
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            Since all data stays in your browser, security is managed by your browser&apos;s built-in protections. IndexedDB data is sandboxed per origin and cannot be accessed by other websites. To further protect your data:
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">Local-Only</strong> — No data is ever transmitted to external servers (except optional AI queries sent directly to OpenRouter with your API key).</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Open Source</strong> — The full source code is available on GitHub for independent review.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Minimal Analytics</strong> — We use Vercel Analytics for basic page view counting. No personal data is collected, and no cookies are used for tracking.</li>
          </ul>
        </>
      )
    },
    {
      id: 7,
      title: 'Your Rights',
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            You have full control over your data. Since everything is stored locally:
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">Data Portability</strong> — You can export all your data at any time from the Settings page.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Right to Erasure</strong> — You can delete all your data from Settings or clear your browser data for the site at any time.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">No Third-Party Access</strong> — Because your data never leaves your device, no third party (including us) can access it without your explicit action.</li>
          </ul>
        </>
      )
    },
    {
      id: 8,
      title: 'Contact',
      icon: <Mail className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          If you have any questions about this Privacy Policy, please contact us at:
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
          <span className="text-xs font-semibold tracking-widest">Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">Privacy Policy</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Effective Date: June 2025</p>
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
