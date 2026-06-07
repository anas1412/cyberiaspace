import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, ShieldCheck, Scale } from 'lucide-react';

const CGV: React.FC = () => {
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
      title: 'Scope & Acceptance',
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          These Terms and Conditions govern your use of the Cyberia application. By accessing or using the app, you agree to be bound by these terms. If you do not agree with any part of these terms, you must not use the application. We reserve the right to update these terms at any time, and continued use after changes constitutes acceptance of the new terms.
        </p>
      )
    },
    {
      id: 2,
      title: 'Free & Open Source',
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            Cyberia is free and open-source software released under the MIT License. You can use, modify, and distribute the software in accordance with the license terms. The full source code is available on GitHub.
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-[var(--text-muted)]">
            <li><strong className="text-[var(--text-primary)] font-bold">No Account Required</strong> — You can use Cyberia immediately without creating an account or providing any personal information.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">No Subscription</strong> — The app is completely free. There are no paid tiers, subscriptions, or hidden fees.</li>
            <li><strong className="text-[var(--text-primary)] font-bold">Local-First</strong> — All your data is stored locally in your browser. No cloud storage is used.</li>
          </ul>
        </>
      )
    },
    {
      id: 3,
      title: 'AI Features (BYOK)',
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          Cyberia offers optional AI features through OpenRouter. You must provide your own OpenRouter API key to use AI functionality. Your API key is stored locally in your browser and is never sent to us. AI queries are sent directly from your browser to OpenRouter. We are not responsible for the availability, accuracy, or behavior of third-party AI models. You are responsible for complying with OpenRouter&apos;s terms of service and the terms of the AI models you choose to use.
        </p>
      )
    },
    {
      id: 4,
      title: 'Intellectual Property',
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-[var(--text-muted)] italic">
          You retain full ownership of all content you create within the application. We claim no intellectual property rights over your thoughts, files, or spaces. The Cyberia software, logo, and branding are our intellectual property and may not be copied or reproduced without permission. The source code is licensed under the MIT License.
        </p>
      )
    },
    {
      id: 5,
      title: 'Acceptable Use',
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-[var(--text-muted)]">
            You agree to use the application responsibly and in compliance with all applicable laws. Prohibited activities include:
          </p>
          <p className="leading-relaxed text-[var(--text-muted)] mt-3">
            <strong className="text-[var(--text-primary)]">You must not use Cyberia to:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2 ml-2 text-[var(--text-muted)]">
            <li>Upload illegal, harmful, or abusive content</li>
            <li>Attempt to compromise the service or other users</li>
            <li>Use automated scripts or bots to scrape or overload the service</li>
            <li>Reverse engineer, decompile, or attempt to extract the source code beyond what the MIT License permits</li>
          </ul>
        </>
      )
    },
    {
      id: 6,
      title: 'Limitation of Liability',
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-dimmed)]">
          The application is provided &quot;as is&quot; without warranty of any kind. In no event shall Cyberia be liable for any damages arising from the use or inability to use the service. This includes, but is not limited to, data loss, service interruption, or any indirect or consequential damages. Since all data is stored locally in your browser, you are responsible for maintaining backups of your important data.
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
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">Terms &amp; Conditions</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Last Updated: June 2025</p>
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

export default CGV;
