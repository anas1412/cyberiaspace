import React from 'react';
import { motion } from 'framer-motion';
import { Scale, ArrowLeft, Building2, Server, Shield } from 'lucide-react';

const LegalNotice: React.FC = () => {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const sections = [
    {
      id: 1,
      title: 'Company Information',
      icon: <Building2 className="w-5 h-5 text-blue-400" />,
      content: (
        <div className="space-y-4">
          <p className="leading-relaxed text-[var(--text-muted)]">
            Cyberia AI Studio is operated by an independent developer. The following information is provided in accordance with legal requirements.
          </p>
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-2xl space-y-3 font-mono text-[11px] uppercase tracking-wider">
            <div className="flex justify-between items-center border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--text-muted)]">SIRET / Tax ID</span>
              <span className="text-[var(--text-primary)] font-bold">1970272D</span>
            </div>
            <div className="flex justify-between items-start border-b border-[var(--glass-border)] pb-2">
              <span className="text-[var(--text-muted)]">Registered Address</span>
              <span className="text-[var(--text-primary)] text-right">Hammamet, Tunisia</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-muted)]">Legal Representative</span>
              <span className="text-[var(--text-primary)] font-bold">Anas Bassoumi</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: 'Hosting',
      icon: <Server className="w-5 h-5 text-blue-400" />,
      content: (
          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-6 rounded-2xl space-y-2">
            <p className="text-[var(--text-primary)] font-semibold text-xs tracking-widest">Hosting Provider</p>
          <p className="text-sm leading-relaxed text-[var(--text-muted)] italic">
            Vercel Inc.<br />
            340 S Lemon Ave #4133, Walnut, CA 91789, USA<br />
            Website: <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white transition-colors">https://vercel.com</a>
          </p>
        </div>
      )
    },
    {
      id: 3,
      title: 'Intellectual Property',
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-[var(--text-muted)]">
          The Cyberia AI Studio application, including its design, source code, graphics, and branding, is protected by applicable intellectual property laws. Users retain ownership of content they create within the app. Unauthorized reproduction, distribution, or modification of the application itself is prohibited.
        </p>
      )
    },
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
              <Scale className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--text-primary)] uppercase tracking-tighter leading-none">Legal Notice</h1>
          </div>
          <p className="text-[var(--text-muted)] font-mono text-sm uppercase tracking-widest">Last Updated: January 1, 2025</p>
        </header>

        <section className="space-y-8 pb-20">
          {sections.map((section) => (
            <div 
              key={section.id} 
              className="border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 bg-[var(--glass-bg)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30"
            >
              <div className="flex items-center gap-3 mb-2">
                {section.icon}
                <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-widest">
                  {section.title}
                </h2>
              </div>
              {section.content}
            </div>
          ))}

          <div className="pt-12 border-t border-[var(--glass-border)] flex items-center justify-between opacity-30">
            <Scale className="w-8 h-8 text-[var(--text-muted)]" />
            <p className="text-[10px] font-semibold tracking-widest text-[var(--text-muted)]">
              Legal Framework
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default LegalNotice;
