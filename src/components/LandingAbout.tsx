import React from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { MousePointer2, Layout, Database, Sparkles, ArrowRight } from 'lucide-react';

const LandingAbout: React.FC = () => {
  const completeOnboarding = useStore((state) => state.completeOnboarding);

  return (
    <div className="fixed inset-0 z-[10001] bg-[#020408]/80 backdrop-blur-xl flex items-center justify-center p-6 overflow-y-auto custom-scroll selection:bg-blue-500/30 pointer-events-auto">
      <div className="max-w-xl w-full my-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 120, delay: 0.1 }}
          className="glass p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-2xl space-y-10 relative z-10"
        >
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
              Cyber<span className="text-blue-500">ia</span>
            </h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
              Kinetic Information Workspace
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <MousePointer2 className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white text-left">Spatial Flux</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Organize your mind in an infinite workspace where thoughts have mass and gravity. Feel the inertia as you map your ideas.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <Layout className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white text-left">Dynamic Stacks</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Link related thoughts into physical clusters. Morph your space into Kanban boards or Timelines without losing context.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white text-left">Cloud Sync</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Supabase-powered cloud storage for persistent access to your research assets, PDFs, and media across all devices.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white text-left">Oracle AI</h3>
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase font-bold tracking-wider">
                Deploy advanced agents to research the web and automate your workspace. Oracle can read your docs and suggest connections.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <button 
              onClick={() => completeOnboarding()}
              className="w-full py-5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-3 group"
            >
              Access Workspace
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="pt-6 border-t border-white/5 text-center space-y-4">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-600 italic leading-loose">
                Sign in above to enable cloud sync<br/>
                By using Cyberia, you agree to our policies
              </p>
              <div className="flex items-center justify-center gap-4 opacity-40">
                <button 
                  onClick={() => {
                    window.history.pushState({}, '', '/privacy');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </button>
                <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
                <button 
                  onClick={() => {
                    window.history.pushState({}, '', '/terms');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                >
                  Terms of Service
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LandingAbout;
