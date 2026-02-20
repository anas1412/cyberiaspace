import React from 'react';
import { motion } from 'framer-motion';
import { MousePointer2, Layout, Database, Sparkles } from 'lucide-react';

const LandingAbout: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-2xl space-y-10 pointer-events-auto"
        >
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
              Cyberia<span className="text-indigo-500">.tn</span>
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
              Kinetic Information Architecture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <MousePointer2 className="w-4 h-4 text-indigo-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Spatial Flux</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Organize your mind in an infinite workspace where thoughts have mass and gravity.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Layout className="w-4 h-4 text-indigo-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Multi-View</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Morph your space into Kanban or Calendar views instantly to match your flow.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-indigo-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Local First</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Privacy is default. Your data lives in your browser, with optional Google Drive backup.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white">Oracle AI</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Deploy advanced reasoning agents to research and automate your workspace.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 text-center space-y-4">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 italic leading-loose">
              Sign in above to initialize your session<br/>
              By signing in, you agree to our terms
            </p>
            <div className="flex items-center justify-center gap-4 opacity-40">
              <button 
                onClick={() => window.location.href = '/privacy'}
                className="text-[7px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                Privacy Policy
              </button>
              <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
              <button 
                onClick={() => window.location.href = '/terms'}
                className="text-[7px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingAbout;
