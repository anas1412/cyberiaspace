import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database } from 'lucide-react';
import DemoThought from './DemoThought';

const CloudSyncVisual: React.FC = () => {
  const [phase, setPhase] = useState<'upload' | 'pulse' | 'distribute' | 'success' | 'idle'>('idle');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    let mounted = true;
    const sequence = async () => {
      while (mounted) {
        setPhase('upload');
        await new Promise(r => setTimeout(r, 2200));
        if (!mounted) break;
        
        setPhase('pulse');
        await new Promise(r => setTimeout(r, 800));
        if (!mounted) break;

        setPhase('distribute');
        await new Promise(r => setTimeout(r, 1500));
        if (!mounted) break;

        setPhase('success');
        await new Promise(r => setTimeout(r, 1500));
        if (!mounted) break;

        setPhase('idle');
        await new Promise(r => setTimeout(r, 1000));
      }
    };
    sequence();
    return () => { mounted = false; };
  }, []);

  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return null;
  }

  const devices = [
    { id: 'desktop', label: 'Desktop', x: -240, y: 0, type: 'monitor' },
    { id: 'mobile', label: 'Mobile', x: 240, y: 0, type: 'phone' },
    { id: 'laptop-top', label: 'Laptop', x: 0, y: -180, type: 'laptop' },
    { id: 'laptop-bottom', label: 'Laptop', x: 0, y: 180, type: 'laptop' },
  ];

  const freeNodes = [
    { id: 'f1', title: 'NOTES', x: [310, -310], y: [-220, 220], duration: 35, delay: 0 },
    { id: 'f2', title: 'IMAGES', x: [-280, 280], y: [170, -170], duration: 45, delay: 5 },
    { id: 'f3', title: 'VIDEOS', x: [220, -220], y: [280, -280], duration: 40, delay: 10 },
  ];

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-transparent overflow-hidden pointer-events-none will-change-transform">
      <div className="absolute inset-0 opacity-[0.03]" style={{ 
        backgroundImage: `radial-gradient(circle at 1px 1px, var(--accent) 1px, transparent 0)`,
        backgroundSize: '40px 40px' 
      }} />

      {freeNodes.map((node) => (
        <motion.div
          key={node.id}
          className="absolute left-1/2 top-1/2"
          animate={{ x: node.x, y: node.y, rotate: [0, 8, -8, 0] }}
          transition={{ 
            x: { duration: node.duration, repeat: Infinity, ease: "linear", delay: -node.delay },
            y: { duration: node.duration * 0.9, repeat: Infinity, ease: "linear", delay: -node.delay },
            rotate: { duration: 12, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <DemoThought title={node.title} className="scale-75 opacity-40" />
          </div>
        </motion.div>
      ))}

      <div className="relative z-20">
        <div className="relative flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute w-40 h-40 opacity-20">
            <svg viewBox="-50 -50 100 100" className="w-full h-full">
              <circle cx="0" cy="0" r="48" stroke="var(--text-primary)" strokeWidth="0.5" fill="none" strokeDasharray="4 6" />
            </svg>
          </motion.div>
          <div className="w-[110px] h-[110px] rounded-full border border-[var(--glass-border)] glass bg-[var(--glass-bg)] flex items-center justify-center relative group shadow-2xl">
            <div className="absolute inset-0 bg-[var(--accent)]/5 blur-3xl rounded-full" />
            <Database className="w-10 h-10 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-500" />
            <AnimatePresence>
              {phase === 'pulse' && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 2.5, opacity: [0, 1, 0] }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[radial-gradient(circle,var(--accent)_0%,transparent_70%)] opacity-40 rounded-full blur-xl" transition={{ duration: 0.8, ease: "easeOut" }} />
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="absolute top-[120%] left-1/2 -translate-x-1/2">
          <span className="text-[8px] font-black tracking-[0.4em] text-[var(--text-muted)] uppercase whitespace-nowrap">Cloud Storage</span>
        </div>
      </div>

      {devices.map((device) => (
        <motion.div key={device.id} className="absolute left-1/2 top-1/2" animate={{ x: device.x, y: device.y }}>
          <div className="-translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
            <motion.div className="relative" animate={phase === 'success' ? { scale: [1, 1.05, 1], filter: ['drop-shadow(0 0 0px transparent)', 'drop-shadow(0 0 15px #22c55e44)', 'drop-shadow(0 0 0px transparent)'] } : {}} transition={{ duration: 0.6 }}>
              {device.type === 'monitor' && (
                <div className="flex flex-col items-center">
                  <div className="w-[100px] h-[75px] rounded-lg border border-[var(--glass-border)] glass bg-[var(--glass-bg)] p-1.5 relative shadow-xl overflow-hidden"><div className="w-full h-full rounded-md bg-[var(--bg-page)]/40 border border-[var(--glass-border)]" /></div>
                  <div className="w-4 h-3 bg-[var(--glass-bg)] border-x border-[var(--glass-border)] opacity-50" />
                  <div className="w-10 h-0.5 bg-[var(--glass-border)] rounded-full opacity-50" />
                </div>
              )}
              {device.type === 'phone' && (
                <div className="w-[50px] h-[90px] rounded-xl border border-[var(--glass-border)] glass bg-[var(--glass-bg)] p-1 relative shadow-xl overflow-hidden">
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-[var(--bg-page)]/60 border border-[var(--glass-border)]" /><div className="w-full h-full rounded-lg bg-[var(--bg-page)]/40 border border-[var(--glass-border)]" />
                </div>
              )}
              {device.type === 'laptop' && (
                <div className="flex flex-col items-center">
                  <div className="w-[90px] h-[60px] rounded-t-lg border border-[var(--glass-border)] glass bg-[var(--glass-bg)] p-1.5 relative shadow-xl overflow-hidden"><div className="w-full h-full rounded-md bg-[var(--bg-page)]/40 border border-[var(--glass-border)]" /></div>
                  <div className="w-[105px] h-1.5 bg-[var(--glass-border)] rounded-b-lg border-x border-b border-[var(--glass-border)]" />
                </div>
              )}
            </motion.div>
            <span className="text-[7px] font-black tracking-[0.3em] text-[var(--text-muted)] uppercase">{device.label}</span>
          </div>
        </motion.div>
      ))}

      <AnimatePresence>
        {phase === 'upload' && (
          <motion.div className="absolute left-1/2 top-1/2 z-30" initial={{ x: -240, y: 0, opacity: 0, scale: 0.7 }} animate={{ x: [ -240, -240, 0, 0 ], y: [ 0, 0, 0, 0 ], opacity: [ 0, 1, 1, 0 ], scale: [ 0.7, 0.9, 0.9, 0 ] }} transition={{ duration: 2.2, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}>
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <DemoThought title="SYNCING..." className="shadow-2xl" />
              <motion.div className="absolute top-[15px] right-[15px] w-1 h-1 rounded-full z-10" animate={{ backgroundColor: ['color-mix(in srgb, var(--text-muted) 20%, transparent)', 'color-mix(in srgb, var(--text-muted) 20%, transparent)', 'var(--accent)', 'var(--accent)'] }} transition={{ duration: 2.2, times: [0, 0.45, 0.55, 1] }} />
            </div>
          </motion.div>
        )}
        {phase === 'distribute' && devices.map((device, i) => (
          <motion.div key={`dist-${device.id}`} className="absolute left-1/2 top-1/2 z-30" initial={{ x: 0, y: 0, opacity: 0, scale: 0 }} animate={{ x: [ 0, device.x ], y: [ 0, device.y ], opacity: [ 0, 1, 1 ], scale: [ 0, 0.7, 0.7 ] }} transition={{ duration: 1.2, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}>
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <DemoThought title="SYNCED" className="shadow-xl" />
              <div className="absolute top-[14px] right-[14px] w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            </div>
          </motion.div>
        ))}
        {phase === 'success' && devices.map((device) => (
          <motion.div key={`success-${device.id}`} className="absolute left-1/2 top-1/2 z-30" initial={{ x: device.x, y: device.y, opacity: 1, scale: 0.7 }} animate={{ opacity: 0, scale: 0.6 }} transition={{ duration: 0.5, delay: 0.8 }}>
            <div className="-translate-x-1/2 -translate-y-1/2 relative">
              <DemoThought title="SYNCED" className="shadow-xl" />
              <div className="absolute top-[14px] right-[14px] w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#22c55e' }} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default CloudSyncVisual;
