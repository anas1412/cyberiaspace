import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsOfService: React.FC = () => {
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

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
          <span className="text-xs font-black uppercase tracking-widest">Back to Workspace</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Terms of Service</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: February 21, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing or using Cyberia (cyberia.tn), you agree to be bound by these Terms of Service. This is a legal agreement between you and Cyberia.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Description of Service</h2>
            <p className="leading-relaxed">
              Cyberia is a spatial workspace platform that treats information as physical objects. The service provides local browser storage and optional cloud synchronization. Use of certain "Oracle" features involves real-time AI processing.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">3. User Ownership & Responsibility</h2>
            <p className="leading-relaxed">
              You own every thought, drawing, and file you place in Cyberia. 
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li><strong>Local-First:</strong> You are responsible for your browser data. Clearing your browser cache or factory resetting your device without Cloud Sync enabled will result in data loss.</li>
              <li><strong>Conduct:</strong> You may not use Cyberia to store or process illegal material or engage in activities that disrupt the service for others.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Pro Subscriptions & Payments</h2>
            <p className="leading-relaxed">
              Upgrade features (Pro tier) are provided on a subscription basis.
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2 uppercase text-[10px] font-bold tracking-wide">
              <li><strong>Manual Renewal:</strong> Cyberia follows a non-predatory billing model. We do not automatically charge your card. You must manually renew your access at the end of each period.</li>
              <li><strong>Third-Party Gateway:</strong> All financial transactions are handled by Flouci. By upgrading, you agree to their terms of service as well.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. Service Continuity</h2>
            <p className="leading-relaxed">
              While we strive for 100% uptime, Cyberia is provided "as is." We are not liable for data loss due to technical failure, browser instability, or synchronization conflicts. We strongly recommend using the "Export Workspace" feature regularly.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">6. Disclaimers</h2>
            <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500">
              Cyberia disclaims all warranties, express or implied. In no event shall Cyberia be liable for any indirect, incidental, or consequential damages arising out of the use of the service.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default TermsOfService;
