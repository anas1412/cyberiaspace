import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Layout, Database, ArrowRight, Cpu, Rocket, Send, Loader2, CheckCircle, ChevronDown, MessageCircle } from 'lucide-react';

import SpatialThinkingVisual from './demo/SpatialThinkingVisual';
import DynamicViewsVisual from './demo/DynamicViewsVisual';
import CloudSyncVisual from './demo/CloudSyncVisual';
import AgenticWorkspaceVisual from './demo/AgenticWorkspaceVisual';

import BackgroundEngine from './background/BackgroundEngine';
import Navigation from './Navigation';
import Footer from './Footer';

const FEATURES = [
  {
    id: 'agentic',
    icon: Cpu,
    title: 'The Agentic Space',
    description: 'The AI lives in your space. It reads your files, PDFs, and notes to find answers, connect dots, and synthesize insights. All without leaving your space.'
  },
  {
    id: 'spatial',
    icon: MousePointer2,
    title: 'Spatial Thinking',
    description: 'Think visually in an infinite space. Your thoughts have mass, momentum, and cluster naturally into collections.'
  },
  {
    id: 'views',
    icon: Layout,
    title: 'Infinite Views',
    description: 'Switch between Spatial, Kanban, and Calendar instantly. Same space, different perspectives.'
  },
  {
    id: 'cloud',
    icon: Database,
    title: 'Always in Sync',
    description: 'Your space, on all your devices. Work offline, stay in sync everywhere.'
  }
];

const FAQ_ITEMS = [
  {
    question: "What is a Thinking Space?",
    answer: "Unlike traditional apps that use static grids or lists, your space treats information as physical entities. Your thoughts have mass, velocity, and gravity, allowing you to organize visually and discover non-linear connections through interaction."
  },
  {
    question: "Is my data private and secure?",
    answer: "Yes. Your space follows a Local-First philosophy. By default, all your work is stored locally in your browser's IndexedDB. When you authenticate, data is synced securely via HTTPS/TLS encryption in transit and stored securely in the cloud."
  },
  {
    question: "How does the 'Oracle' AI handle my data?",
    answer: "Oracle uses advanced reasoning models to analyze your space in real-time. We never use your personal data or content to train AI models. Your history stays local on your device."
  },
  {
    question: "Do subscriptions automatically renew?",
    answer: "It depends on your provider. Local payments via Flouci are manual (no auto-charges). International subscriptions via Polar.sh are recurring and can be canceled at any time through the customer portal."
  },
  {
    question: "What happens when I downgrade from Pro to Free?",
    answer: "When you downgrade, your existing thoughts, spaces, and files stay safe. You keep full access to everything you created. However, premium features like advanced Oracle AI and higher limits become unavailable. You can still read and edit all your content, but won't be able to use Pro-only features until you resubscribe."
  },
  {
    question: "Why is there no mobile app yet?",
    answer: "The spatial thinking engine is designed for precision and large-scale mapping, which requires a mouse and a large display. While we are working on companion apps, the full experience is currently optimized for Desktop."
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
        <div className={`w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center transition-all duration-500 shrink-0 ${isOpen ? 'rotate-180 bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20' : 'group-hover:border-white/30 text-[var(--text-muted)] bg-white/5'}`}>
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
            {activeFeature === 0 && <AgenticWorkspaceVisual />}
            {activeFeature === 1 && <SpatialThinkingVisual />}
            {activeFeature === 2 && <DynamicViewsVisual />}
            {activeFeature === 3 && <CloudSyncVisual />}
          </motion.div>
        </AnimatePresence>
      </ResponsiveStage>
    </div>
  );
});

const Homepage: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeFAQIndex, setActiveFAQIndex] = useState<number | null>(null);
  const [discordData, setDiscordData] = useState<{ member_count: number; presence_count: number; instant_invite: string } | null>(null);
  
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
    const INVITE_CODE = '6DRsnY3ajE'; 
    fetch(`https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`)
      .then(res => res.json())
      .then(data => {
        if (data.approximate_member_count) {
          setDiscordData({
            member_count: data.approximate_member_count,
            presence_count: data.approximate_presence_count,
            instant_invite: `https://discord.gg/${data.code}`
          });
        }
      })
      .catch(() => {});
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-[#e2e8f0] selection:bg-[var(--accent)]/30 relative">
      <BackgroundEngine />

      <Navigation isHomepage />

      <section className="pt-40 pb-24 px-6 relative z-10">
       <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 120 }}
          >
            {/* Changed text size here from 6xl/8xl to 5xl/7xl */}
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
            Your brain moves. <br />
          <motion.span 
            initial={{ filter: 'blur(10px)', opacity: 0, x: -50 }}
            animate={{ filter: 'blur(0px)', opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: "circOut" }}
            style={{ color: 'var(--accent)', display: 'inline-block' }}
          >
            So does your space.
          </motion.span>
          </h1>
            
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              A personal and team thinking space. Add docs, images, links, tables. <span style={{ color: 'var(--accent-secondary)' }}>Chat with AI</span> to explore your ideas, or command it to <span style={{ color: 'var(--accent-secondary)' }}>find, create, and organize</span> everything.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <button 
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-10 py-5 glass hover:bg-white/10 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
              >
                Explore Features
              </button>
              <a 
              href="/home"

                className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-[var(--accent)]/30 active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                Try for Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </motion.div>
        </div>

        {/* Screenshot Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
          className="block max-w-6xl mx-auto mt-16 md:mt-24 px-4 md:px-0 relative"
        >
          <div className="w-full h-auto glass rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <img 
              src="/Screenshot.png" 
              alt="Cyberia Space - Your thinking space in action" 
              className="w-full h-auto"
            />
          </div>
          
          <div className="absolute inset-0 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-[var(--accent)]/10 blur-[100px] rounded-full pointer-events-none" />
        </motion.div>
      </section>

      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <div className="max-w-2xl">
<h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
                Redefining <br /><span style={{ color: 'var(--accent)' }}>Thinking Space</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Not a tool. A place for your mind to move. Designed for brains that won't sit still.
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
                        : 'bg-white/5 text-[var(--text-muted)] group-hover:text-slate-300'
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
                        activeFeature === index ? 'text-slate-300 opacity-100' : 'text-[var(--text-muted)] opacity-0 h-0 overflow-hidden group-hover:h-auto group-hover:opacity-60'
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
              Why a <span style={{ color: 'var(--accent)' }}>Spatial Thinking Space</span>?
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
                <span className="text-white font-semibold">Static lists kill momentum.</span> Your brain doesn't think in rows and columns. So why should your space?
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
                Your thinking <span className="text-white font-semibold">has physics.</span> Thoughts drift, collide, and cluster like galaxies. We built a space that respects that.
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
                The AI doesn't just chat. It <span className="text-white font-semibold">lives in your space</span>, reading your docs and connecting the dots you missed.
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
                <span className="text-white font-semibold">Your mind, your space, your data.</span> No cloud lock-in. You own what you create.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Community / Discord Section */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl p-10 border border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/20 flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-8 h-8 text-[var(--accent)]" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-4">
              Join the <span style={{ color: 'var(--accent)' }}>Community</span>
            </h2>
            
            <p className="text-slate-400 font-medium mb-8 max-w-lg mx-auto">
              Help shape Cyberia Space. Share feedback, report bugs, and connect with other thinkers building the future of thinking.
            </p>

            {discordData && (
              <div className="flex items-center justify-center gap-8 mb-6">
                <div className="text-center">
                  <p className="text-2xl font-black text-white">{discordData.member_count.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Members</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-black text-green-400">{discordData.presence_count.toLocaleString()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Online Now</p>
                </div>
              </div>
            )}
            
            <a 
              href={discordData?.instant_invite || "https://discord.gg/YOUR_INVITE_CODE"} 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40"
            >
              Join Discord
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <section id="faq" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Frequently Asked <span style={{ color: 'var(--accent)' }}>Questions</span>
            </h2>
            <p className="text-slate-400 font-medium uppercase tracking-[0.2em] text-[10px]">Everything you need to know about your space</p>
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
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Our team is here to help you build your perfect space.</p>
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
                  <p className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-widest mt-2">We will get back to you shortly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Name</label>
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      value={contactName} 
                      onChange={(e) => setContactName(e.target.value)} 
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-xl px-5 text-sm text-white outline-none focus:border-[var(--accent)]/50 transition-all" 
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Email</label>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">Message</label>
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
              Join a new generation of thinkers who are mapping the future in their space.
            </p>
            <a 
                href="/home"

              className="inline-flex items-center gap-4 px-12 py-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-xs font-black uppercase tracking-[0.4em] transition-all shadow-[0_20px_50px_rgba(99,102,241,0.3)] hover:-translate-y-1 active:translate-y-0"
            >
              Try for Free
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-[var(--accent)]/10 blur-[120px] rounded-full z-0" />
      </section>

      <Footer />
    </div>
  );
};

export default Homepage;