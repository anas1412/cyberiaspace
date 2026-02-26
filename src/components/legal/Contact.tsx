import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, Shield, ArrowLeft } from 'lucide-react';

const Contact: React.FC = () => {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
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
          <span className="text-xs font-black uppercase tracking-widest">Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Contact</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: February 24, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem]">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex gap-2">
                <Mail className="w-5 h-5 text-blue-400" />
                <Phone className="w-5 h-5 text-blue-400" />
              </div>
              <h2 className="text-lg font-black text-white uppercase tracking-widest">General and Business Inquiries</h2>
            </div>
            <p className="leading-relaxed">
              <strong className="text-white">Email:</strong> <a href="mailto:anas.bassoumi@gmail.com" className="text-blue-400 hover:text-white">anas.bassoumi@gmail.com</a>
            </p>
            <p className="leading-relaxed mt-2">
              <strong className="text-white">Phone:</strong> <a href="tel:+21650377851" className="text-blue-400 hover:text-white">+216 50 377 851</a>
            </p>
            <p className="leading-relaxed mt-2">
              <strong className="text-white">Website:</strong> <a href="https://cyberia.tn" className="text-blue-400 hover:text-white">https://cyberia.tn</a>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem]">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-widest">Legal Matters</h2>
            </div>
            <p className="leading-relaxed">
              For legal notices, DMCA requests, or privacy concerns:
            </p>
            <p className="leading-relaxed mt-2">
              <strong className="text-white">Email:</strong> <a href="mailto:anas.bassoumi@gmail.com" className="text-blue-400 hover:text-white">anas.bassoumi@gmail.com</a>
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">Response Time</h2>
            <p className="leading-relaxed">
              We aim to respond to all inquiries within 48 hours. During high-volume periods, response times may be slightly longer.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default Contact;
