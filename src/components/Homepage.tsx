import React, { lazy, Suspense, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Layout, Database, Sparkles, ArrowRight, Zap, Shield, Globe, Check, Rocket, Menu, X, Send, Loader2, CheckCircle } from 'lucide-react';
import { PLAN_CONFIG } from '../constants';

const DemoWorkspace = lazy(() => import('./demo/DemoWorkspace'));

const Homepage: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
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

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  const proPrice = PLAN_CONFIG.pro.PRICE!;
  const savingsUsd = proPrice.monthly.usd * 12 - proPrice.yearly.usd;

  return (
    <div className="min-h-screen bg-[#020408] text-[#e2e8f0] overflow-y-auto selection:bg-blue-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="stars-layer stars-1" />
        <div className="stars-layer stars-2" />
        <div className="stars-layer stars-twinkle" />
        <div className="nebula-cloud" />
        <div className="grain" />
      </div>

      <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
        isScrolled 
          ? 'bg-[#020408]/80 backdrop-blur-2xl border-b border-white/10 py-3' 
          : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="relative">
              <img src="/logo.png" alt="Cyberia Workspace" className="w-10 h-10 object-contain relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-700" />
            </div>
            <span className="text-2xl font-black tracking-tighter uppercase">
              Cyberia <span className="text-blue-500">Workspace</span>
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            {['features', 'pricing', 'about', 'contact'].map((item) => (
              <button 
                key={item}
                onClick={() => scrollToSection(item)} 
                className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 hover:text-blue-400 transition-all relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-blue-500 transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
            <a href="https://app.cyberia.tn" className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 active:scale-95">
              Launch App
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
                {['features', 'pricing', 'about', 'contact'].map((item) => (
                  <button 
                    key={item}
                    onClick={() => scrollToSection(item)} 
                    className="text-left text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-400 transition-colors"
                  >
                    {item}
                  </button>
                ))}
                <a href="https://app.cyberia.tn" className="w-full py-4 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all text-center">
                  Launch App
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              <Sparkles className="w-3 h-3" />
              Kinetic Information Workspace
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
              Your Mind, <br />
              <span className="text-blue-500">In Motion</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
              Organize your mind in an infinite workspace where thoughts have <span className="text-white font-bold">mass and gravity</span>. 
              Feel the inertia as you map your ideas across dimensions. <span className="text-blue-400">Powered by AI agents that research and connect your thoughts.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
              <a 
                href="https://app.cyberia.tn"
                className="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] transition-all shadow-2xl shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-3 group"
              >
                Access Workspace
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <button 
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-10 py-5 glass hover:bg-white/10 rounded-[1.5rem] text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
              >
                Explore Flux
              </button>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
          className="hidden md:block max-w-6xl mx-auto mt-24 relative"
        >
          <Suspense fallback={
            <div className="w-full h-[600px] glass rounded-[3rem] animate-pulse flex items-center justify-center">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing Core Engine...</span>
            </div>
          }>
            <DemoWorkspace />
          </Suspense>
          
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
        </motion.div>
      </section>

      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
                Redefining <br /><span className="text-blue-500">Thinking Architecture</span>
              </h2>
              <p className="text-slate-400 font-medium leading-relaxed">
                Designed for non-linear thinkers, visionaries, and digital architects. We believe that productivity shouldn't feel like a spreadsheet. It should feel like a world.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: MousePointer2,
                title: 'Spatial Flux',
                description: 'Organize your mind in an infinite workspace where thoughts have mass and physical inertia.'
              },
              {
                icon: Layout,
                title: 'Dynamic Stacks',
                description: 'Link related thoughts into physical clusters. Morph space into Kanban or Timelines instantly.'
              },
              {
                icon: Database,
                title: 'Cloud Persistence',
                description: 'Supabase-powered storage for research assets, PDFs, and media synced across all devices.'
              },
              {
                icon: Sparkles,
                title: 'Oracle AI',
                description: 'Deploy advanced agents to research the web and automate your workspace connections.'
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.8, 
                  delay: index * 0.1,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }}
                viewport={{ once: true, margin: "-50px" }}
                className="glass p-8 rounded-[2.5rem] border-white/5 hover:border-blue-500/40 transition-all duration-500 group relative overflow-hidden hover:-translate-y-2"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-8 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-500 shadow-lg shadow-blue-500/0 group-hover:shadow-blue-500/10">
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-[14px] font-black uppercase tracking-[0.2em] text-white mb-4 group-hover:text-blue-400 transition-colors">{feature.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed uppercase font-bold tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">{feature.description}</p>
                </div>

                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-32 px-6 relative z-10 bg-blue-500/[0.02]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Unlock <span className="text-blue-500">Maximum Flow</span>
            </h2>
            <p className="text-slate-400 font-medium">Start for free, upgrade when you're ready.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-[3rem] border-white/5 flex flex-col hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="mb-8">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white mb-2 group-hover:text-blue-400 transition-colors">Explorer</h3>
                <div className="text-4xl font-black text-white group-hover:scale-105 transition-transform origin-left duration-500">$0 <span className="text-sm text-slate-500 font-bold uppercase tracking-widest">/ Forever</span></div>
              </div>
              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_SPACES} Cognitive Spaces`} />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_THOUGHTS_PER_SPACE} Thoughts per Space`} />
                <PricingFeature text={`${PLAN_CONFIG.free.AI_DAILY_LIMIT} AI Interactions / Day`} />
                <PricingFeature text={`${PLAN_CONFIG.free.MAX_STORAGE_MB}MB Cloud Storage`} />
                <PricingFeature text="Infinite Workspace" />
              </div>
              <a href="https://app.cyberia.tn" className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center">
                Get Started Free
              </a>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass p-10 rounded-[3rem] border-blue-500/30 bg-blue-500/5 flex flex-col relative overflow-hidden hover:-translate-y-2 transition-all duration-500 group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full translate-x-10 -translate-y-10 group-hover:scale-150 transition-transform duration-1000" />

              <div className="absolute top-6 right-6 z-10">
                <div className="px-3 py-1 bg-blue-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                  Recommended
                </div>
              </div>

              <div className="mb-8 relative z-10">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-blue-400 mb-2">Cyberia Pro</h3>
                <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left duration-500">
                  <div className="text-4xl font-black text-white">${proPrice.monthly.usd}</div>
                  <div className="text-xl text-slate-500 font-bold uppercase tracking-widest">/ Month</div>
                </div>
                <div className="mt-2 text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">
                  Save ${savingsUsd} Yearly — Local Price: {proPrice.monthly.tnd} DT
                </div>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_SPACES} Priority Spaces`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.MAX_THOUGHTS_PER_SPACE} High-Frequency Thoughts`} pro />
                <PricingFeature text={`${PLAN_CONFIG.pro.AI_DAILY_LIMIT} Oracle AI Interactions`} pro />
                <PricingFeature text="50GB Secure Cloud Storage" pro />
                <PricingFeature text="Early Access to Premium Models" pro />
                <PricingFeature text="Shared Team Spaces (Coming Soon)" pro />
              </div>

              <a href="https://app.cyberia.tn" className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all text-center shadow-xl shadow-blue-500/20 active:scale-95">
                Unlock in App
              </a>

              <div className="mt-6 flex items-center justify-center gap-3 opacity-60">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Secure local & global payments via Flouci
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="about" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            {[
              {
                icon: Zap,
                title: 'High Inertia',
                description: 'Lightning-fast performance that keeps up with your thoughts. No lag, no waiting.'
              },
              {
                icon: Shield,
                title: 'Data Sovereignty',
                description: 'Your thoughts stay yours. Complete privacy with military-grade encryption.'
              },
              {
                icon: Globe,
                title: 'Works Everywhere',
                description: 'Seamless experience across all your devices. Works offline, syncs everywhere.'
              }
            ].map((item) => (
              <div key={item.title} className="group">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-blue-500/5 border border-white/5 flex items-center justify-center group-hover:bg-blue-500/10 transition-all">
                  <item.icon className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-4">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="py-32 px-6 relative z-10 bg-blue-500/[0.02]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase mb-6">
              Get In <span className="text-blue-500">Touch</span>
            </h2>
            <p className="text-slate-400 font-medium">Have questions or feedback? We'd love to hear from you.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass p-10 rounded-[3rem] border-white/5"
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
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" 
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
                      className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" 
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
                    className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-5 text-sm text-white outline-none focus:border-blue-500/50 transition-all resize-none" 
                  />
                </div>
                {contactSubmitStatus === 'error' && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest text-center">
                    Failed to send message. Please try again.
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={isContactSubmitting || !contactMessage.trim()} 
                  className="w-full h-14 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
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
            <Rocket className="w-12 h-12 text-blue-500 mx-auto mb-8 animate-pulse" />
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase mb-8">
              Begin Your <br /><span className="text-blue-500">Cognitive Journey</span>
            </h2>
            <p className="text-slate-400 mb-12 font-medium">
              Join a new generation of thinkers who are mapping the future in Cyberia Workspace.
            </p>
            <a 
              href="https://app.cyberia.tn"
              className="inline-flex items-center gap-4 px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.4em] transition-all shadow-[0_20px_50px_rgba(59,130,246,0.3)] hover:-translate-y-1 active:translate-y-0"
            >
              Start Thinking Spatial
              <ArrowRight className="w-5 h-5" />
            </a>
          </motion.div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-blue-600/10 blur-[120px] rounded-full z-0" />
      </section>

      <footer className="py-20 px-6 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Cyberia Workspace" className="w-8 h-8 opacity-50" />
            <span className="font-black uppercase tracking-widest text-slate-500">Cyberia Workspace</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <a href="https://cyberia.tn/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="https://cyberia.tn/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="https://cyberia.tn/sales-conditions" className="hover:text-white transition-colors">Terms of Sale & Refund Policy</a>
            <a href="https://cyberia.tn/legal-notice" className="hover:text-white transition-colors">Legal Notice</a>
            <a href="https://cyberia.tn/contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
            © 2026 CYBERIA WORKSPACE
          </div>
        </div>
      </footer>
    </div>
  );
};

const PricingFeature: React.FC<{ text: string; pro?: boolean }> = ({ text, pro }) => (
  <div className="flex items-center gap-3">
    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${pro ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
      <Check className="w-3 h-3" />
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-widest ${pro ? 'text-slate-300' : 'text-slate-500'}`}>{text}</span>
  </div>
);

export default Homepage;
