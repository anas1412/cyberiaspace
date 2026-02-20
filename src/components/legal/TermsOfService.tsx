import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsOfService: React.FC = () => {
  return (
    <div className="min-h-[100dvh] bg-black text-slate-300 p-6 md:p-20 overflow-y-auto custom-scroll selection:bg-indigo-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2 text-indigo-400 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Workspace</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Terms of Service</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: February 20, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing or using Cyberia (cyberia.tn), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Description of Service</h2>
            <p className="leading-relaxed">
              Cyberia is a spatial productivity platform that allows users to organize information using a physics-driven interface. The service includes local storage features and optional cloud synchronization via third-party providers like Google.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">3. User Data & Ownership</h2>
            <p className="leading-relaxed">
              You retain full ownership of all data, thoughts, and assets you create or upload to Cyberia. We do not claim any ownership rights over your content. You are responsible for maintaining backups of your data.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Pro Accounts & Subscriptions</h2>
            <p className="leading-relaxed">
              Certain features (like Oracle AI and expanded storage) require a paid Pro subscription. Subscriptions are billed on a recurring basis and can be canceled at any time.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate your access to the service if you violate these terms or engage in illegal activities using the platform.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">6. Disclaimer of Warranties</h2>
            <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500">
              The service is provided "as is" without warranties of any kind. Cyberia is not liable for any data loss resulting from browser storage clearing, cloud sync errors, or service interruptions.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default TermsOfService;
