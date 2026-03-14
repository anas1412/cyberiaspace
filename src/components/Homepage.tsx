import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Layout, Database, ArrowRight, Menu, X, Zap, Check, Compass, Rocket, Send, Loader2, CheckCircle, Shield, ChevronDown } from 'lucide-react';
import { PLAN_CONFIG } from '../constants';

import SpatialThinkingVisual from './demo/SpatialThinkingVisual';
import DynamicViewsVisual from './demo/DynamicViewsVisual';
import CloudSyncVisual from './demo/CloudSyncVisual';
import AgenticWorkspaceVisual from './demo/AgenticWorkspaceVisual';

import BackgroundEngine from './background/BackgroundEngine';

const FEATURES = [
  {
    id: 'spatial',
    icon: MousePointer2,
    title: 'Spatial Thinking',
    description: 'Think visually in an infinite space. Thoughts have presence, momentum, and can be grouped into living collections.'
  },
  {
    id: 'views',
    icon: Layout,
    title: 'Dynamic Views',
    description: 'Instantly transform your workspace between Spatial, Kanban, and Calendar depending on how you want to work.'
  },
  {
    id: 'cloud',
    icon: Database,
    title: 'Real-time Sync',
    description: 'Everything updates instantly across your devices so your workspace is always perfectly in sync.'
  },
  {
    id: 'agentic',
    icon: Zap,
    title: 'Agentic Workspace',
    description: 'Intelligent agents help research, gather information, and automate tasks across your workspace.'
  }
];

const FAQ_ITEMS = [
  {
    question: "What is a Spatial Workspace?",
    answer: "Unlike traditional apps that use static grids or lists, Cyberia Workspace treats information as physical entities. Your thoughts have mass, velocity, and gravity, allowing you to organize data visually and discover non-linear connections through interaction."
  },
  {
    question: "Is my data private and secure?",
    answer: "Yes. Cyberia Workspace follows a Local-First philosophy. By default, all your work is stored locally in your browser's IndexedDB. When you authenticate, data is synced securely via Supabase using end-to-end encryption protocols."
  },
  {
    question: "How does the 'Oracle' AI handle my data?",
    answer: "Oracle uses advanced reasoning models to analyze your workspace snippets in real-time. We never use your personal data or workspace content to train AI models. Your history is stored locally on your device."
  },
  {
    question: "Do subscriptions automatically renew?",
    answer: "It depends on your provider. Local payments via Flouci are manual (no auto-charges). International subscriptions via Polar.sh are recurring and can be canceled at any time through the customer portal."
  },
  {
    question: "What happens when I downgrade from Pro to Free?",
    answer: "When you downgrade, your existing thoughts, spaces, and files stay safe—you keep full access to everything you created. However, premium features like advanced Oracle AI and higher limits become unavailable. You can still read and edit all your content, but won't be able to use Pro-only features until you resubscribe."
  },
  {
    question: "Why is there no mobile app yet?",
    answer: "The Cyberia spatial engine is designed for precision thinking and large-scale mapping, which requires a mouse and a large display. While we are working on companion apps, the full workspace experience is currently optimized for Desktop."
  }
];

const FAQItem: React.FC<{ 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onToggle: () => void;
}> = ({ question, answer, isOpen, onToggle }) => {
  return (
    <div className={`border-b border-white/5 transition-all duration-500 ${isOpen ? 'bg-white/[0.03]' : ''}`}>
      <button 
        onClick={onToggle}
        className="w-full py-7 px-6 md:px-10 flex items-center justify-between group text-left transition-all"
      >
        <span className={`text-[12px] md:text-[13px] font-black uppercase tracking-[0.2em] transition-colors duration-300 pr-8 ${isOpen ? 'text-[var(--accent-secondary)]' : 'text-slate-300 group-hover:text-white'}`}>
          {question}
        </span>
        <div className={`w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center transition-all duration-500 shrink-0 ${isOpen ? 'rotate-180 bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' : 'group-hover:border-white/30 text-slate-500 bg-white/5'}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 md:px-10 pb-8 text-sm text-slate-400 leading-relaxed font-medium uppercase tracking-widest max-w-3xl border-t border-white/5 pt-6 mt-2 mx-6 md:mx-10">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ResponsiveStage = React.memo(({ children }: { children: React.ReactNode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const lastDimensions = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        
        const widthChanged = width !== lastDimensions.current.width;
        const heightSignificant = Math.abs(height - lastDimensions.current.height) > 100;

        if (widthChanged || heightSignificant) {
          const safeWidth = width - 32;
          const safeHeight = height - 32;
          const designSize = 600;
          const newScale = Math.min(safeWidth / designSize, safeHeight / designSize);
          setScale(Math.max(0.45, newScale));
          
          lastDimensions.current = { width, height };
        }
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <motion.div 
        style={{ scale, width: 600, height: 600 }} 
        className="relative flex-shrink-0 origin-center will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
});

const FeatureVisual: React.FC<{ activeFeature: number }> = React.memo(({ activeFeature }) => {
  const [isLargeScreen, setIsLargeScreen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isLargeScreen) return null;

  return (
    <div className="w-full h-full relative">
      <ResponsiveStage>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFeature}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            {activeFeature === 0 && <SpatialThinkingVisual />}
            {activeFeature === 1 && <DynamicViewsVisual />}
            {activeFeature === 2 && <CloudSyncVisual />}
            {activeFeature === 3 && <AgenticWorkspaceVisual />}
          </motion.div>
        </AnimatePresence>
      </ResponsiveStage>
    </div>
  );
});




const Homepage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeFAQIndex, setActiveFAQIndex] = useState<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useState<{ country: string; currency: string; isLocalPricing: boolean } | null>(null);
  
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim() || isContactSubmitting) return;
    setIsContactSubmitting(true);
    setContactSubmitStatus('idle');
    try {
      const res = await fetch('/api/feedback?action=contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
      });
      if (res.ok) {
        setContactSubmitStatus('success');
        setContactMessage('');
        setContactName('');
        setContactEmail('');
        setTimeout(() => setContactSubmitStatus('idle'), 5000);
      } else setContactSubmitStatus('error');
    } catch { setContactSubmitStatus('error'); } finally { setIsContactSubmitting(false); }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userLanguage = navigator.language;
    const isTunisiaLikely = userTimezone === 'Africa/Tunis' || userLanguage.includes('ar-TN') || userLanguage.includes('fr-TN');

    fetch('/api/pay?action=pricing')
      .then(res => res.json())
      .then(data => {
        if (data.country === 'US' && isTunisiaLikely) {
          setLocation({ country: 'TN', currency: 'DT', isLocalPricing: true });
        } else {
          setLocation(data);
        }
      })
      .catch(() => setLocation({
        country: isTunisiaLikely ? 'TN' : 'US',
        currency: isTunisiaLikely ? 'DT' : 'USD',
        isLocalPricing: isTunisiaLikely
      }));
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const savingsUsd = proPrice.monthly.usd * 12 - proPrice.yearly.usd;
  const savingsTnd = proPrice.monthly.tnd * 12 - proPrice.yearly.tnd;

  return (
    <div className="min-h-screen text-[#e2e8f0] selection:bg-[var(--accent)]/30 relative">
      <BackgroundEngine />

      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled 
          ? 'bg-[#05060a]/40 backdrop-blur-3xl shadow-sm shadow-white/5 py-3' 
          : 'bg-transparent py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <img src="/logo.png" alt="Cyberia Workspace" className="w-10 h-10 object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-[var(--accent)]/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">
              Cyberia <span style={{ color: 'var(--accent)' }}>Workspace</span>
            </span>
          </div>

          {/* Desktop Nav - ViewSwitcher Style */}
          <div className="hidden md:flex items-center gap-3"> {/* Increased gap slightly to 3 */}
  {/* The Nav Container */}
  <div className="flex items-center h-10 p-1 rounded-2xl">
                {['features', 'about', 'pricing', 'faq', 'contact'].map((item) => (
      <button 
        key={item}
        onClick={() => scrollToSection(item)} 
        className="px-3 h-full rounded-xl transition-all duration-300 flex items-center group/nav"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 group-hover/nav:text-white transition-colors">
          {item}
        </span>
      </button>
    ))}
  </div>

  {/* The CTA Button - Now height matched and radius matched */}
  <a 
    href="https://app.cyberia.tn" 
    className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
  >
    Enter Cyberia
    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
  </a>
</div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden glass border-t border-white/5 overflow-hidden"
            >
              <div className="flex flex-col p-6 gap-6">
    {['features', 'about', 'pricing', 'faq', 'contact'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => scrollToSection(item)} 
                    className="text-left text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-[var(--accent-secondary)] transition-colors"
                  >
                    {item}
                  </button>
                ))}
                <a href="https://app.cyberia.tn" className="w-full py-3 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center flex items-center justify-center gap-2 group">
                  Enter Cyberia
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <section className="pt-40 pb-24 px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
            Your Mind, <br />
          <motion.span 
            initial={{ filter: 'blur(10px)', opacity: 0, x: -50 }}
            animate={{ filter: 'blur(0px)', opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: "circOut" }}
            style={{ color: 'var(--accent)', display: 'inline-block' }}
          >
            In Motion
          </motion.span>
          </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Stop <span className="text-white font-bold">digging through folders</span>. 
              Cyberia uses <span style={{ color: 'var(--accent-secondary)' }}>AI agents that find, connect, and organize</span> your 
              notes, files, and links in a visual workspace where your ideas actually 
              <span className="text-white font-bold"> stick together</span>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button 
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-10 py-5 glass hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
              >
                Explore Features
              </button>
              <a 
                href="https://app.cyberia.tn"
                className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-[var(--accent)]/30 active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                Enter Cyberia
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>

        {/* <motion.div 
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
          className="block max-w-6xl mx-auto mt-16 md:mt-24 px-4 md:px-0 relative"
        >
          {typeof window !== 'undefined' && window.innerWidth >= 1024 && (
            <Suspense fallback={
              <div className="w-full h-[400px] md:h-[600px] glass rounded-2xl animate-pulse flex items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing Core Engine...</span>
              </div>
            }>
              <InteractiveDemo />
            </Suspense>
          )}
          
              <div className="absolute inset-0 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
        </motion.div> */}
      </section>

      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <div className="max-w-2xl">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
                Redefining <br /><span style={{ color: 'var(--accent)' }}>Thinking Architecture</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Designed for non-linear thinkers, visionaries, and digital architects. We believe that productivity shouldn't feel like a spreadsheet. It should feel like a world.
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:gap-12 items-start">
            {/* Left Column: Feature Cards */}
            <div className="w-full lg:w-1/2 space-y-4">
              {FEATURES.map((feature, index) => (
                <motion.div
                  key={feature.id}
                  onClick={() => setActiveFeature(index)}
                  className={`relative p-8 rounded-2xl transition-all duration-500 cursor-pointer group overflow-hidden ${
                    activeFeature === index 
                      ? 'glass border-[var(--accent)]/30 bg-[var(--accent)]/5 shadow-2xl shadow-[var(--accent)]/10' 
                      : 'border border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="relative z-10 flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-500 ${
                      activeFeature === index 
                        ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/40' 
                        : 'bg-white/5 text-slate-500 group-hover:text-slate-300'
                    }`}>
                      <feature.icon className="w-7 h-7" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className={`text-[14px] font-black uppercase tracking-[0.2em] mb-2 transition-colors ${
                        activeFeature === index ? 'text-white' : 'text-slate-400'
                      }`}>
                        {feature.title}
                      </h3>
                      <p className={`text-[11px] leading-relaxed uppercase font-bold tracking-widest transition-all duration-500 ${
                        activeFeature === index ? 'text-slate-300 opacity-100' : 'text-slate-600 opacity-0 h-0 overflow-hidden group-hover:h-auto group-hover:opacity-60'
                      }`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {activeFeature === index && (typeof window === 'undefined' || window.innerWidth >= 1024) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="lg:hidden mt-6 w-full h-[380px] md:h-[500px] glass rounded-3xl overflow-hidden relative"
                      >

                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent opacity-50" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {activeFeature === index && (
                    <motion.div 
                      layoutId="active-pill"
                      className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 to-transparent pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            <div className="hidden lg:block lg:w-1/2 sticky top-32">
              <div className="bg-[#05060a] aspect-square lg:aspect-auto lg:h-[600px] rounded-2xl border border-white/10 overflow-hidden relative group isolate shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-transparent opacity-50" />
                <FeatureVisual activeFeature={activeFeature} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-4">
              Why <span style={{ color: 'var(--accent)' }}>Cyberia Workspace</span>?
            </h2>
            <p className="text-slate-400">Simple. Your brain isn't a spreadsheet.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Problem</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                <span className="text-white font-semibold">Spreadsheets kill creativity.</span> Your brain doesn't think in rows and columns—so why should your tools?
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Physics</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                Your thoughts <span className="text-white font-semibold">drift, collide, and cluster</span> like galaxies. We built a workspace that respects that.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Agentic Space</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                Oracle doesn't just chat. It <span className="text-white font-semibold">lives in your space</span>, reading docs and connecting dots.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
            >
              <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4">The Ownership</h3>
              <p className="text-sm text-[var(--text-dimmed)] leading-relaxed">
                <span className="text-white font-semibold">Your data stays local.</span> No cloud lock-in. You own your mind.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-32 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Unlock <span style={{ color: 'var(--accent)' }}>Your Potential</span>
            </h2>
            <p className="text-slate-400 font-medium">Start for free, upgrade when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-2xl border-white/5 flex flex-col hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="mb-8">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-2 group-hover:text-[var(--accent-secondary)] transition-colors">Explorer</h3>
                <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left duration-500">$0 <span className="text-sm text-slate-500 font-bold uppercase tracking-widest">/ Forever</span></div>
              </div>
              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_SPACES} Agentic Spaces`} />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_THOUGHTS_PER_SPACE} Thoughts per Agentic Space`} />
                <PricingFeature text={`${PLAN_CONFIG.free.AI_DAILY_LIMIT} Daily Agentic AI Interactions`} />
                <PricingFeature text="Limited Access to Basic AI Models" />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_STORAGE_MB}MB Cloud Storage`} />
                <PricingFeature text="Limited Upload Size" />
                <PricingFeature text="Limited Support" />
              </div>
              <a href="https://app.cyberia.tn" className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center">
                Get Started Free
              </a>

              <div className="mt-6 flex items-center justify-center gap-3 opacity-60">
                <Compass className="w-4 h-4 text-slate-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Free forever. No credit card required.
                </span>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-2xl border-[var(--accent)]/30 bg-[var(--accent)]/5 flex flex-col relative overflow-hidden hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 blur-[50px] rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-1000" />

              <div className="absolute top-6 right-6 z-10">
                <div className="px-3 py-1 bg-[var(--accent)] text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl shadow-lg shadow-[var(--accent)]/20 group-hover:scale-110 transition-transform">
                  Recommended
                </div>
              </div>

              <div className="mb-8 relative z-10">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-[var(--accent-secondary)] mb-2">Cyberia Pro</h3>
                
                {location?.isLocalPricing ? (
                  <div className="flex flex-col gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest bg-[var(--accent)]/20 text-[var(--accent-secondary)] px-3 py-1 rounded-xl border border-[var(--accent)]/30 w-fit">
                      Local Pricing Active
                    </span>
                    <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left duration-500">
                      <div className="text-4xl font-black text-white">{proPrice.monthly.tnd}</div>
                      <div className="text-xl text-slate-500 font-bold uppercase tracking-widest">DT / Month</div>
                    </div>
                    <div className="text-[10px] font-bold text-[var(--accent-secondary)]/60 uppercase tracking-widest">
                      Save {savingsTnd} DT Yearly — Global: ${proPrice.monthly.usd} USD
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left duration-500">
                    <div className="text-4xl font-black text-white">${proPrice.monthly.usd}</div>
                    <div className="text-xl text-slate-500 font-bold uppercase tracking-widest">/ Month</div>
                  </div>
                )}
                
                {!location?.isLocalPricing && (
                  <div className="mt-2 text-[10px] font-bold text-[var(--accent-secondary)]/60 uppercase tracking-widest">
                    Save ${savingsUsd} Yearly
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_SPACES} Agentic Spaces`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} Thoughts Per Agentic Space`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.AI_DAILY_LIMIT} Daily Agentic AI Interactions`} pro />
                <PricingFeature text="Access to Multiple Advanced Premium Models" pro />
                <PricingFeature 
                  text={`${(PLAN_CONFIG.pro.MAX_STORAGE_MB / 1024).toFixed(0)}GB Secure Cloud Storage`} pro />
                <PricingFeature text="Unlimited Upload Size" pro />
                <PricingFeature text="Analyze Images & PDFs" pro />
                <PricingFeature text="Custom AI Agent Personality" pro />
                <PricingFeature text="Custom Background" pro/>
                <PricingFeature text="Share Your Spaces" pro />
                <PricingFeature text="Shared Team Spaces (Coming Soon)" pro />
                <PricingFeature text="Early Access to New Features" pro />
                <PricingFeature text="24/7 Priority Support" pro />
              </div>

              <a href="https://app.cyberia.tn/pricing" className="w-full py-5 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center shadow-xl shadow-[var(--accent)]/20 active:scale-95">
                Go Pro
              </a>

<div className="mt-6 flex items-center justify-center gap-3 opacity-60">
                <Shield className="w-4 h-4 text-[var(--accent-secondary)]" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Secure local & global payments via {location?.isLocalPricing ? 'Flouci' : 'Polar.sh'}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Frequently Asked <span style={{ color: 'var(--accent)' }}>Questions</span>
            </h2>
            <p className="text-slate-400 font-medium uppercase tracking-[0.2em] text-[10px]">Everything you need to know about Cyberia Workspace</p>
          </div>

          <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/50 transition-all duration-700">
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem 
                key={index} 
                {...item} 
                isOpen={activeFAQIndex === index}
                onToggle={() => setActiveFAQIndex(activeFAQIndex === index ? null : index)}
              />
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left hover:border-white/10 transition-colors"
          >
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-2">Still have questions?</h3>
              <p className="text-xs text-slate-500 uppercase tracking-wider">Our team is here to help you build your perfect workspace.</p>
            </div>
            <button 
              onClick={() => scrollToSection('contact')}
              className="px-8 py-4 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl shadow-white/5 active:scale-95"
            >
              Contact Support
            </button>
          </motion.div>
        </div>
      </section>

      <section id="contact" className="py-32 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Get In <span style={{ color: 'var(--accent)' }}>Touch</span>
            </h2>
            <p className="text-slate-400 font-medium">Have questions or feedback? We'd love to hear from you.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass p-10 rounded-2xl border-white/5"
          >
            {contactSubmitStatus === 'success' ? (
              <div className="py-16 text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
                <div>
                  <p className="text-lg font-black uppercase tracking-widest text-green-400">Message Sent</p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">We will get back to you shortly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Name</label>
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      value={contactName} 
                      onChange={(e) => setContactName(e.target.value)} 
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Email</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="your@email.com" 
                      value={contactEmail} 
                      onChange={(e) => setContactEmail(e.target.value)} 
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Message</label>
                  <textarea 
                    required 
                    value={contactMessage} 
                    onChange={(e) => setContactMessage(e.target.value)} 
                    placeholder="How can we help?" 
                    className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all resize-none" 
                  />
                </div>
                {contactSubmitStatus === 'error' && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest text-center">
                    Failed to send message. Please try again.
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isContactSubmitting || !contactMessage.trim()} 
                  className="w-full h-14 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] disabled:opacity-50 text-white rounded-xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40"
                >
                  {isContactSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Send Message
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-40 px-6 relative z-10 text-center overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
<Rocket className="w-12 h-12 text-[var(--accent)] mx-auto mb-8 animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-8">
              Start <span style={{ color: 'var(--accent)' }}>Now</span>
            </h2>
            <p className="text-slate-400 mb-12 font-medium">
              Join a new generation of thinkers who are mapping the future in Cyberia Workspace.
            </p>
            <a 
              href="https://app.cyberia.tn"
              className="inline-flex items-center gap-4 px-12 py-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-xs font-black uppercase tracking-[0.4em] transition-all shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:-translate-y-1 active:translate-y-0"
            >
              Try for Free
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-[var(--accent)]/10 blur-[120px] rounded-full z-0" />
      </section>

      <footer className="py-20 px-6 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Cyberia Workspace" className="w-8 h-8 opacity-50" />
            <span className="font-black uppercase tracking-widest text-slate-500">Cyberia Workspace</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <a href="https://cyberia.tn/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="https://cyberia.tn/terms" className="hover:text-white transition-colors">Terms of Sale (CGV)</a>
            <a href="https://cyberia.tn/legal" className="hover:text-white transition-colors">Legal Notice</a>
            <a href="https://cyberia.tn/contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            © {new Date().getFullYear()} CYBERIA WORKSPACE
          </div>
        </div>
      </footer>
    </div>
  );
};

const PricingFeature: React.FC<{ text: string; pro?: boolean }> = ({ text, pro }) => (
  <div className="flex items-center gap-3">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${pro ? 'bg-[var(--accent)]/20 border-[var(--accent)]/30 text-[var(--accent-secondary)]' : 'bg-white/5 border-white/10 text-slate-500'}`}>
      <Check className="w-3 h-3" />
    </div>
    <span className={`text-[13px] font-bold uppercase tracking-widest ${pro ? 'text-slate-300' : 'text-slate-500'}`}>{text}</span>
  </div>
);

export default Homepage;
