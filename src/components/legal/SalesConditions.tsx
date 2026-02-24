import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft } from 'lucide-react';

const SalesConditions: React.FC = () => {
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
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Terms of Sale & Refund Policy</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: February 24, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing or using Cyberia (cyberia.tn), you agree to be bound by these Terms of Sale & Refund Policy. This is a legal agreement between you and Cyberia.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Description of Service</h2>
            <p className="leading-relaxed">
              Cyberia is a spatial workspace platform that treats information as physical objects. The service provides local browser storage and optional cloud synchronization. Use of certain "Oracle" features involves real-time AI processing.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">3. Pricing and Payment</h2>
            <p className="leading-relaxed">
              Upgrade features (Pro tier) are provided on a subscription basis.
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li><strong>Free Tier:</strong> Basic workspace functionality with limited storage.</li>
              <li><strong>Premium Subscriptions:</strong> Pricing is displayed in the app and on our website. Payments are processed securely through authorized payment providers.</li>
              <li><strong>Manual Renewal:</strong> Cyberia follows a non-predatory billing model. We do not automatically charge your card. You must manually renew your access at the end of each period.</li>
              <li><strong>Third-Party Gateway:</strong> All financial transactions are handled by Flouci. By upgrading, you agree to their terms of service as well.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Refund Policy</h2>
            <p className="leading-relaxed">
              All purchases are final. We offer no refunds for any reason. Please ensure the Service meets your needs before purchasing.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. User Accounts</h2>
            <p className="leading-relaxed">
              You must provide accurate registration information. You are responsible for maintaining account security and must notify us immediately of any unauthorized use.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">6. User Content</h2>
            <p className="leading-relaxed">
              You retain ownership of all content you create in Cyberia. By using the Service, you grant us permission to store and sync your content.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">7. Prohibited Use</h2>
            <p className="leading-relaxed">
              You may not use the Service to violate laws, infringe intellectual property, distribute malware, or attempt unauthorized access.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">8. Limitation of Liability</h2>
            <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500">
              Cyberia disclaims all warranties, express or implied. In no event shall Cyberia be liable for any indirect, incidental, or consequential damages arising out of the use of the service.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">9. Changes to Terms</h2>
            <p className="leading-relaxed">
              We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">10. Governing Law</h2>
            <p className="leading-relaxed">
              These terms shall be governed by the laws of Tunisia.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default SalesConditions;
