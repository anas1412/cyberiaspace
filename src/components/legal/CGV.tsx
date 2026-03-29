import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, ShieldCheck, CreditCard, RefreshCw, AlertCircle, Scale, Building2, User, Ban } from 'lucide-react';

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
      title: "Article 1: Scope & Acceptance",
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-400">
          These General Terms of Sale (CGV) apply to all subscriptions and services purchased on Cyberia Space (cyberia.tn). By upgrading your account, you agree to be bound by these terms. Cyberia Space is a spatial platform developed by Cyberia AI Studio.
        </p>
      )
    },
    {
      id: 2,
      title: "Article 2: Subscription & Account",
      icon: <Building2 className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            To access Pro features, you must create an account and subscribe to a plan. Your subscription is tied to your Google identity.
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-slate-400">
            <li><strong className="text-white font-bold">Pro Tier:</strong> Grants enhanced storage, higher Oracle AI limits, and other premium features.</li>
            <li><strong className="text-white font-bold">Account Responsibility:</strong> You are responsible for all activity occurring under your account. We reserve the right to suspend accounts violating our policies.</li>
          </ul>
        </>
      )
    },
    {
      id: 3,
      title: "Article 3: Billing & Renewals",
      icon: <RefreshCw className="w-5 h-5 text-blue-400" />,
      highlight: true,
      content: (
        <div className="space-y-4">
          <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Local Payments (Tunisia)
            </h3>
            <p className="leading-relaxed text-sm text-slate-400">
              Payments via <strong className="text-white">Flouci</strong> follow a <strong>manual renewal model</strong>. We do not automatically charge your payment method. You must manually renew your subscription to maintain Pro access.
            </p>
          </div>

          <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              International Payments
            </h3>
            <p className="leading-relaxed text-sm text-slate-400">
              Subscriptions via <strong className="text-white">Polar.sh</strong> are <strong>automatic recurring subscriptions</strong>. Your payment method will be charged at the start of each billing cycle (monthly or yearly) unless you cancel your subscription through the customer portal.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 4,
      title: "Article 4: Pricing & Payment",
      icon: <CreditCard className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            Prices are indicated in the application and on the website in the local currency (TND for Tunisia) or USD for international users.
          </p>
          <ul className="list-disc list-inside space-y-3 mt-4 ml-2 text-slate-400">
            <li><strong className="text-white font-bold">Local Payments (Tunisia):</strong> Handled securely via <strong className="text-white">Flouci</strong>.</li>
            <li><strong className="text-white font-bold">International Payments:</strong> Handled securely via <strong className="text-white">Polar.sh</strong>.</li>
            <li><strong className="text-white font-bold">Security:</strong> We do not store your financial data. All transactions are encrypted and processed by our third-party payment gateways.</li>
          </ul>
        </>
      )
    },
    {
      id: 5,
      title: "Article 5: Refund Policy",
      icon: <AlertCircle className="w-5 h-5 text-red-400" />,
      error: true,
      content: (
        <>
          <p className="leading-relaxed font-bold text-slate-200">
            Given the digital nature of the services and the instant access to Pro features and AI processing resources:
          </p>
          <p className="text-xl font-black text-white uppercase tracking-tighter mt-4 border-l-4 border-red-500 pl-4 py-2">
            All sales are final. We do not offer refunds or credits for any reason.
          </p>
          <p className="leading-relaxed mt-4 text-sm text-slate-400 italic">
            Please use the Free Tier to ensure the service meets your requirements before upgrading.
          </p>
        </>
      )
    },
    {
      id: 6,
      title: "Article 6: Service Availability",
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500 italic">
          Cyberia Space strives for high uptime but is provided "as is". We are not liable for data loss due to technical failure, browser instability, or synchronization conflicts. Users are encouraged to use the "Export Workspace" feature regularly.
        </p>
      )
    },
    {
      id: 7,
      title: "Article 7: Acceptable Use Policy",
      icon: <ShieldCheck className="w-5 h-5 text-blue-400" />,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            Cyberia Space is an AI-powered spatial thinking and knowledge management tool. It is designed for personal productivity, research, and AI-assisted analysis of private documents.
          </p>
          <p className="leading-relaxed text-slate-400 mt-3">
            <strong className="text-white">Acceptable Uses:</strong>
          </p>
          <ul className="list-disc list-inside space-y-2 mt-2 ml-2 text-slate-400">
            <li>Personal knowledge management and note organization</li>
            <li>AI-assisted analysis of privately uploaded research documents and PDFs</li>
            <li>Team collaboration within private, authenticated workspaces</li>
            <li>Storing files as contextual attachments to thoughts and projects</li>
          </ul>
        </>
      )
    },
    {
      id: 8,
      title: "Article 8: Prohibited Uses",
      icon: <Ban className="w-5 h-5 text-red-400" />,
      error: true,
      content: (
        <>
          <p className="leading-relaxed text-slate-400">
            The following uses of Cyberia Space are strictly prohibited:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3 ml-2 text-slate-400">
            <li>Uploading or sharing files for the purpose of distributing content to the public or third parties</li>
            <li>Using the storage layer as a direct file distribution or "cyberlocker" mechanism</li>
            <li>Attempting to bypass access controls or extract files for unauthorized sharing</li>
            <li>Hosting content that infringes on intellectual property rights</li>
            <li>Uploading content that violates applicable laws or our Terms of Service</li>
            <li>Using the platform as a CDN or public file hosting service</li>
          </ul>
          <p className="leading-relaxed mt-4 text-sm text-slate-400">
            Violations may result in <strong className="text-white">immediate account suspension</strong>, <strong className="text-white">permanent deletion of content</strong>, and <strong className="text-white">referral to appropriate authorities</strong>.
          </p>
        </>
      )
    },
    {
      id: 9,
      title: "Article 9: Governing Law",
      icon: <Scale className="w-5 h-5 text-blue-400" />,
      content: (
        <p className="leading-relaxed text-slate-300">
          These Terms of Sale and any disputes arising from them shall be governed by the laws of <strong>Tunisia</strong>.
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
              <FileText className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Terms of Sale (CGV)</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: March 29, 2026</p>
        </header>

        <section className="space-y-8 pb-20">
          {articles.map((article) => (
            <div 
              key={article.id} 
              className={`border p-8 rounded-[2.5rem] space-y-4 transition-colors duration-500 ${
                article.highlight 
                  ? 'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.03)]' 
                  : article.error
                  ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20'
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

          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex gap-4 opacity-30">
              <CreditCard className="w-8 h-8" />
              <ShieldCheck className="w-8 h-8" />
              <User className="w-8 h-8" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
              © 2026 CYBERIA AI STUDIO
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default CGV;