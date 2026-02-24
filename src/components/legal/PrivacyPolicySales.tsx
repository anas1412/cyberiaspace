import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';

const PrivacyPolicySales: React.FC = () => {
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
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Privacy Policy (Sales)</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Effective Date: February 24, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Overview</h2>
            <p className="leading-relaxed">
              This Privacy Policy outlines how Cyberia AI Studio handles your data when you use our services, with a specific focus on payment and transaction privacy. We are a registered company in <strong className="text-white">Tunisia</strong> committed to protecting your personal and financial information.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Local-First Data Storage</h2>
            <p className="leading-relaxed">
              By default, all thoughts, tasks, tables, drawings, and images you create are stored locally in your browser's internal database (IndexedDB). This data never leaves your device unless you explicitly enable Cloud Sync.
            </p>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/10 p-8 rounded-[2rem] space-y-4">
            <h2 className="text-xl font-black text-blue-400 uppercase tracking-widest border-b border-blue-500/20 pb-2">3. Google API Data Usage</h2>
            <p className="leading-relaxed text-white font-medium">
              Cyberia uses Google OAuth services to provide optional cloud synchronization features.
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li>
                <strong className="text-white">Supabase Storage:</strong> Your files and media are stored securely in Supabase cloud storage. This provides persistent storage for your research assets across all devices.
              </li>
              <li>
                <strong className="text-white">Google Account Info:</strong> We access your basic profile strictly for identity management and to personalize your workspace.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. AI Data Protocol (The Oracle)</h2>
            <p className="leading-relaxed">
              When interacting with The Oracle, relevant snippets of your workspace are processed in real-time via high-speed inference models (hosted by Groq/OpenAI). 
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li>Data is processed temporarily for the duration of the request.</li>
              <li>Your personal data and thoughts are <strong className="text-white">never</strong> used for model training.</li>
              <li>We do not store your AI chat history on our central servers; it is stored locally on your device.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. Payment Security</h2>
            <p className="leading-relaxed">
              Payments are handled securely by the <strong className="text-white">Flouci</strong>. Cyberia does not collect or store your credit card numbers, CVVs, or billing addresses. We only receive a confirmation token to activate your Pro features.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">6. Data Portability</h2>
            <p className="leading-relaxed">
              We believe in data freedom. You can export your entire workspace as a standard JSON file at any time via the System Tray. You are never locked into the Cyberia ecosystem.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">7. Your Rights</h2>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li><strong className="text-white">Access:</strong> Download your data at any time</li>
              <li><strong className="text-white">Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong className="text-white">Portability:</strong> Export your content in standard formats</li>
              <li><strong className="text-white">Revoke Access:</strong> Disconnect Google Drive anytime</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">8. Children's Privacy</h2>
            <p className="leading-relaxed">
              The Service is not intended for children under 13. We do not knowingly collect information from children.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">9. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes via the app or email.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">10. Contact</h2>
            <p className="leading-relaxed">
              If you have questions about this policy or your data, please contact us at <a href="mailto:anas.bassoumi@gmail.com" className="text-blue-400 hover:text-white">anas.bassoumi@gmail.com</a>.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicySales;
