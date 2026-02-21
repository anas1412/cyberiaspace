import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-[100dvh] bg-black text-slate-300 p-6 md:p-20 overflow-y-auto custom-scroll selection:bg-blue-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={() => window.location.href = '/'}
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
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Privacy Policy</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Effective Date: February 20, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Overview</h2>
            <p className="leading-relaxed">
              Cyberia ("we," "us," or "our") is a spatial productivity tool designed with a **Local-First** philosophy. We believe your thoughts should remain private and under your control. This policy explains how we handle your data when you use our website (cyberia.tn) and our integrated services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Local-First Data Storage</h2>
            <p className="leading-relaxed">
              By default, all thoughts, tasks, tables, drawings, and images you create are stored locally in your browser's internal database (IndexedDB). This data never leaves your device unless you explicitly enable Cloud Sync.
            </p>
          </div>

          <div className="space-y-4 bg-blue-500/5 border border-blue-500/10 p-8 rounded-[2rem]">
            <h2 className="text-xl font-black text-blue-400 uppercase tracking-widest border-b border-blue-500/20 pb-2">3. Google API Data Usage</h2>
            <p className="leading-relaxed text-white font-medium">
              Cyberia uses Google OAuth services to provide optional cloud synchronization features.
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li>
                <strong className="text-white">Google Drive (`drive.file`):</strong> We request access only to files created or opened by Cyberia. We use this to store your rich content (Markdown, JSON) and media assets (PDFs, Images, Audio) in a visible `/Cyberia` folder in your private Drive.
              </li>
              <li>
                <strong className="text-white">Google Account Info:</strong> We access your basic profile (email, name, avatar) strictly for identity management and to personalize your workspace.
              </li>
            </ul>
            <p className="mt-6 p-4 bg-black/40 rounded-xl border border-white/5 text-sm italic">
              <strong>Google Limited Use Disclosure:</strong> Cyberia's use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-blue-400 underline underline-offset-4 hover:text-blue-300 transition-colors">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Data Sharing & Security</h2>
            <p className="leading-relaxed">
              We do **not** sell, trade, or share your personal data or workspace content with third parties. Your Google Drive data remains in your own account; Cyberia only acts as a bridge to manage those files.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. Contact</h2>
            <p className="leading-relaxed">
              If you have questions about this policy or your data, please contact the Architect at <span className="text-blue-400 font-mono">support@cyberia.tn</span>.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicy;
