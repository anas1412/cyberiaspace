import React from 'react';
import { motion } from 'framer-motion';
import { Scale, ArrowLeft, Building2, Server, Shield, Lock } from 'lucide-react';

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
      title: "1. Corporate Identity",
      icon: <Building2 className="w-5 h-5 text-blue-400" />,
      content: (
        <div className="space-y-4">
          <p className="leading-relaxed text-slate-400">
            Cyberia Space is developed and operated by <strong>Anas Bassoumi</strong>, operating under the trade name <strong>Cyberia AI Studio</strong> in Tunisia.
          </p>
          <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-3 font-mono text-[11px] uppercase tracking-wider">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-slate-500">Tax ID (Matricule Fiscal)</span>
              <span className="text-white font-bold">1970272D</span>
            </div>
            <div className="flex justify-between items-start border-b border-white/5 pb-2">
              <span className="text-slate-500">Registered Address</span>
              <span className="text-white text-right">Rue Taieb El Azzabi, Hammamet,<br/>8050, Nabeul, Tunisia</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Legal Representative</span>
              <span className="text-white font-bold">Anas Bassoumi</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "2. Website Hosting",
      icon: <Server className="w-5 h-5 text-blue-400" />,
      content: (
        <div className="bg-black/40 border border-white/5 p-6 rounded-2xl space-y-2">
          <p className="text-white font-black uppercase text-xs tracking-widest">Vercel Inc.</p>
          <p className="text-sm leading-relaxed text-slate-400 italic">
            440 N Barranca Ave #4133, Covina, CA 91723, United States.<br />
            Website: <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white transition-colors">https://vercel.com</a>
          </p>
        </div>
      )
    },
    {
      id: 3,
      title: "3. Intellectual Property",
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-400">
          All content, design, code, and interfaces related to Cyberia Space are the exclusive property of <strong>Cyberia AI Studio</strong>. Unauthorized reproduction, modification, or distribution is strictly prohibited. Users retain ownership of the content they create within their workspace.
        </p>
      )
    },
    {
      id: 4,
      title: "4. Governing Law",
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <p className="leading-relaxed text-slate-300">
          This Legal Notice and any disputes arising from it shall be governed by the laws of <strong>Tunisia</strong>. Any disputes shall be resolved in accordance with Tunisian jurisdiction.
        </p>
      )
    }
  ];

  return (
    <div className="min-h-[100dvh] bg-black text-slate-300 p-6 md:p-20 overflow-y-auto custom-scroll selection:bg-blue-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Scale className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Legal Notice</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: March 12, 2026</p>
        </header>

        <section className="space-y-8 pb-20">
          {sections.map((section) => (
            <div 
              key={section.id} 
              className={`border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 ${
                section.highlight 
                  ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.03)]' 
                  : 'bg-white/5 border border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {section.icon}
                <h2 className="text-xl font-black text-white uppercase tracking-widest">
                  {section.title}
                </h2>
              </div>
              {section.content}
            </div>
          ))}

          <div className="pt-12 border-t border-white/5 flex items-center justify-between opacity-30">
            <Scale className="w-8 h-8 text-slate-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              Cyberia Legal Framework
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default LegalNotice;