import React from 'react';
import { motion } from 'framer-motion';
import { MonitorSmartphone, Hammer, Construction } from 'lucide-react';

const MobileNotSupported: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100000] bg-[#020408] flex flex-col items-center justify-center p-10 text-center overflow-hidden">
      {/* Deep Space Background */}
      <div className="stars-layer stars-1 opacity-20" />
      <div className="nebula-cloud opacity-30" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-8 max-w-sm"
      >
        {/* Animated Icon Group */}
        <div className="relative">
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 bg-blue-500/20 blur-[40px] rounded-full"
          />
          <div className="w-24 h-24 rounded-[2rem] glass border-white/10 flex items-center justify-center relative z-10 shadow-2xl">
            <MonitorSmartphone className="w-10 h-10 text-blue-400" />
            <motion.div 
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-2 -right-2 bg-amber-500 p-2 rounded-xl shadow-lg border border-amber-400/50"
            >
              <Hammer className="w-4 h-4 text-black" />
            </motion.div>
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-white">
            Desktop Required
          </h1>
          <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full" />
          <p className="text-slate-400 text-sm leading-relaxed font-medium">
            Cyberia's kinetic space is optimized for high-precision spatial mapping. 
          </p>
          <p className="text-blue-400/80 text-[10px] font-black uppercase tracking-widest bg-blue-500/5 py-3 px-4 rounded-2xl border border-blue-500/10 inline-block">
            <Construction className="w-3 h-3 inline mr-2 -mt-0.5" />
            Mobile & Tablet Support Under Construction
          </p>
        </div>

        <div className="pt-8 border-t border-white/5 w-full">
          <p className="text-[9px] text-slate-600 uppercase font-bold tracking-[0.3em]">
            Access via Desktop for Full Synchronization
          </p>
        </div>
      </motion.div>

      {/* Aesthetic Grain */}
      <div className="grain" />
    </div>
  );
};

export default MobileNotSupported;
