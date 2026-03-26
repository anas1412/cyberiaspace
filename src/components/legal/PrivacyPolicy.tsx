import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Database, Globe, Brain, UserCheck, Lock, Mail } from 'lucide-react';

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
      title: "Article 1: Overview",
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-400">
          Cyberia Space ("we," "us," or "our") is a spatial productivity tool designed with a Local-First philosophy. We attach the greatest importance to the protection of your personal data and wish to ensure the best level of protection in compliance with applicable regulations.
        </p>
      )
    },
    {
      id: 2,
      title: "Article 2: Local-First Data Storage",
      icon: <Database className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            By default, all thoughts, tasks, drawings, and files you create are stored <strong>locally</strong> in your browser's internal database (IndexedDB). 
          </p>
          <p className="leading-relaxed text-white font-medium mt-2">
            When you authenticate your account, your workspace is automatically synced to the cloud for backup and cross-device access.
          </p>
        </>
      )
    },
    {
      id: 3,
      title: "Article 3: Data We Collect",
      icon: <UserCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            We collect minimal personal data to provide and improve our services:
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-slate-400">
            <li><strong className="text-white font-bold">Identity Info:</strong> Email address and profile name via Google OAuth for account management and identity verification.</li>
            <li><strong className="text-white font-bold">Usage Data:</strong> Basic technical logs to detect errors and optimize application performance.</li>
            <li><strong className="text-white font-bold">Payment Data:</strong> We receive transaction confirmation tokens from our providers (<strong className="text-white">Flouci</strong> and <strong className="text-white">Polar.sh</strong>). We do not store your credit card numbers or sensitive financial details.</li>
          </ul>
        </>
      )
    },
    {
      id: 4,
      title: "Article 4: Cloud Synchronization",
      icon: <Globe className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <>
          <p className="leading-relaxed text-slate-300">
            When you authenticate your account, your workspace metadata and research assets are stored securely in <strong className="text-white">Supabase</strong> (PostgreSQL database and Cloud Storage). 
          </p>
          <p className="leading-relaxed text-sm text-slate-400 mt-2">
            This allows for persistent storage across multiple devices and ensures data continuity if your browser cache is cleared.
          </p>
        </>
      )
    },
    {
      id: 5,
      title: "Article 5: AI Data Protocol (The Oracle)",
      icon: <Brain className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            Interactions with "The Oracle" involve real-time inference via high-speed models (hosted via <strong className="text-white">OpenRouter</strong>, utilizing models from OpenAI, Google, Anthropic, etc.).
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-slate-400 italic">
            <li>Relevant workspace snippets are processed temporarily to generate responses.</li>
            <li>Your workspace data is <strong>never used for model training</strong>.</li>
            <li>AI chat history is stored locally on your device for maximum privacy.</li>
          </ul>
        </>
      )
    },
    {
      id: 6,
      title: "Article 6: Security Measures",
      icon: <Lock className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-400">
          We have implemented robust security measures to prevent your personal data from being accidentally lost, used, or accessed in an unauthorized way. Access to your data is strictly limited to processes necessary for providing the service.
        </p>
      )
    },
    {
      id: 7,
      title: "Article 7: Your Legal Rights",
      icon: <Shield className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            In accordance with Tunisian and international data protection regulations, you have the right to access, correct, or delete your personal data.
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-slate-400">
            <li><strong className="text-white font-bold">Portability:</strong> You can export your entire workspace as a JSON file at any time.</li>
            <li><strong className="text-white font-bold">Erasure:</strong> You can request the deletion of your account and associated cloud data directly from the application settings.</li>
          </ul>
        </>
      )
    },
    {
      id: 8,
      title: "Article 8: Contact",
      icon: <Mail className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-400">
          For any questions regarding this policy or to exercise your rights, please contact us at: 
          <br />
          <a href="mailto:support@cyberiaspace.app" className="text-blue-400 font-bold hover:text-white transition-colors">support@cyberiaspace.app</a>
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
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Privacy Policy</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Effective Date: March 12, 2026</p>
        </header>

        <section className="space-y-8 pb-20">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className={`border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 ${
                article.highlight 
                  ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.03)]' 
                  : 'bg-white/5 border border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {article.icon}
                <h2 className="text-xl font-black text-white uppercase tracking-widest">
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