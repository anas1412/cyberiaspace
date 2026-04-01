import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Layout, Database, ArrowRight, Cpu, Rocket, Send, Loader2, CheckCircle, ChevronDown, MessageCircle, X, Play, Quote } from 'lucide-react';

import { YOUTUBE_VIDEO_ID } from '../constants';

import SpatialThinkingVisual from './demo/SpatialThinkingVisual';
import DynamicViewsVisual from './demo/DynamicViewsVisual';
import CloudSyncVisual from './demo/CloudSyncVisual';
import AgenticWorkspaceVisual from './demo/AgenticWorkspaceVisual';

import BackgroundEngine from './background/BackgroundEngine';
import Navigation from './Navigation';
import Footer from './Footer';
import { useStore } from '../store/useStore';

const FEATURES = [
  {
    id: 'agentic',
    icon: Cpu,
    title: 'AI that understands your files',
    description: 'Upload PDFs, images, and documents. Ask questions and get instant answers based on your content. The AI reads and remembers everything.'
  },
  {
    id: 'spatial',
    icon: MousePointer2,
    title: 'Everything in one place',
    description: 'Notes, files, tables, and links in a visual space. See everything at a glance and find what you need instantly.'
  },
  {
    id: 'views',
    icon: Layout,
    title: 'Work your way',
    description: 'Switch between freeform canvas, organized boards, or calendar view. Same content, different perspectives to match your workflow.'
  },
  {
    id: 'cloud',
    icon: Database,
    title: 'Access anywhere',
    description: 'Your space syncs across all devices automatically. Work offline on the plane, pick up seamlessly on your desktop.'
  }
];

const TESTIMONIALS = [
  {
    quote: "Cyberia changed how I architect complex systems. Seeing my thoughts as physical entities helped me spot connections I never saw in a linear list.",
    author: "Nidhal G.",
    role: "Senior Software Developper",
    avatar: "NG"
  },
  {
    quote: "The spatial engine is a game-changer for research. I can finally map out my entire thesis visually without feeling constrained by a grid.",
    author: "Mohamed C.",
    role: "University Student",
    avatar: "MD"
  },
  {
    quote: "Finally, a tool that matches the way my brain actually works. The transition between freeform canvas and boards is seamless.",
    author: "Nadia D.",
    role: "UI/UX Designer",
    avatar: "ND"
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
    <div className={`border-b border-[var(--border)] transition-colors duration-300 ${isOpen ? 'bg-[var(--glass-bg)]' : 'hover:bg-[var(--glass-bg)]'}`}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full py-6 px-6 md:px-10 flex items-center justify-between group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset"
      >
        <span className={`text-[15px] md:text-[16px] font-medium tracking-wide transition-colors duration-300 pr-8 ${isOpen ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)] group-hover:text-[var(--accent)]'}`}>
          {question}
        </span>
        <div className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 shrink-0 ${isOpen ? 'rotate-180 bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-md shadow-[var(--accent)]/30' : 'border-[var(--glass-border)] text-[var(--text-muted)] group-hover:border-[var(--accent)]/50 group-hover:text-[var(--text-primary)]'}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-6 md:px-10 pb-8 text-[15px] text-[var(--text-secondary)] leading-relaxed max-w-3xl pt-2">
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
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
  const { theme } = useStore();
  const [activeFeature, setActiveFeature] = useState(0);
  const [activeFAQIndex, setActiveFAQIndex] = useState<number | null>(null);
  const [discordData, setDiscordData] = useState<{ member_count: number; presence_count: number; instant_invite: string } | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  
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

  return (
    <div className="min-h-screen text-[var(--text-primary)] selection:bg-[var(--accent)]/30 relative flex flex-col">
      <BackgroundEngine />
      <Navigation isHomepage />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="pt-32 md:pt-48 pb-20 px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 100 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                The AI space for<br />
                <motion.span
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]"
                >
                  your thoughts
                </motion.span>
              </h1>
              
              <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                Upload documents, chat with AI, and organize everything in one place. Your personal knowledge base that actually understands your content.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/home"
                  className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  Try it for Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 group border border-[var(--glass-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Play className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                  Watch Demo
                </button>
              </div>
            </motion.div>
          </div>

          

          {/* Screenshot Preview */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="block max-w-6xl mx-auto mt-20 md:mt-28 px-4 md:px-0 relative"
          >
            <div 
              onClick={() => setIsImageZoomed(true)}
              className="w-full h-auto glass rounded-2xl md:rounded-[2rem] p-2 md:p-3 overflow-hidden shadow-2xl shadow-[var(--accent)]/5 cursor-zoom-in group bg-[var(--bg-main)]"
            >
              <img 
                src={theme === 'light' ? '/LightScreenshot.png' : '/DarkScreenshot.png'}
                alt="Cyberia Space Interface" 
                className="w-full h-auto rounded-xl md:rounded-3xl border border-[var(--glass-border)] group-hover:scale-[1.01] transition-transform duration-700 ease-out"
              />
            </div>
            
            <div className="absolute inset-0 bg-[var(--accent)]/20 blur-[120px] rounded-full pointer-events-none -z-10" />
          </motion.div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="py-24 md:py-32 px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 md:mb-24 text-center lg:text-left">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Everything you need to <span className="text-[var(--accent)]">think better</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg md:text-xl max-w-2xl mx-auto lg:mx-0">
                Four powerful features to capture, organize, and leverage your knowledge effortlessly.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
              {/* Feature Selection Cards */}
              <div className="w-full lg:w-5/12 space-y-3">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    key={feature.id}
                    onMouseEnter={() => setActiveFeature(index)}
                    className={`w-full text-left relative p-6 rounded-2xl group cursor-pointer ${
                      activeFeature === index 
                        ? 'bg-[var(--glass-bg)] border border-[var(--accent)]/30 shadow-xl shadow-[var(--accent)]/10 translate-x-0 lg:translate-x-2' 
                        : 'border border-transparent hover:bg-[var(--glass-bg)]'
                    }`}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="relative z-10 flex items-start gap-5">
                      <motion.div 
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                          activeFeature === index 
                            ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/30'
                            : 'bg-[var(--bg-main)] border-[var(--glass-border)] text-[var(--text-muted)] group-hover:border-[var(--accent)]/50 group-hover:text-[var(--text-primary)]'
                        }`}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <feature.icon className="w-6 h-6" />
                      </motion.div>
                      
                      <div className="flex-1 pt-1">
                        <h3 className={`text-lg font-semibold mb-2 transition-colors duration-300 ${
                          activeFeature === index ? 'text-[var(--text-primary)]' : 'text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]'
                        }`}>
                          {feature.title}
                        </h3>
                        <motion.div
                          initial={false}
                          animate={{
                            height: activeFeature === index ? 'auto' : 0,
                            opacity: activeFeature === index ? 1 : 0,
                          }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
                            {feature.description}
                          </p>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Visual Display Stage */}
              <div className="hidden lg:block lg:w-7/12 sticky top-32">
                <div className="bg-[var(--bg-page)] h-[500px] xl:h-[600px] rounded-3xl border border-[var(--glass-border)] overflow-hidden relative shadow-2xl shadow-[var(--accent)]/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 via-transparent to-transparent opacity-50 pointer-events-none" />
                  <FeatureVisual activeFeature={activeFeature} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Why it <span className="text-[var(--accent)]">works</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">Your brain isn't a spreadsheet. Your space shouldn't be either.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Scattered information', desc: 'Notes, documents, and ideas everywhere. Switching between apps wastes time and breaks your flow.' },
                { title: 'Visual organization', desc: 'See everything at a glance. Arrange documents and ideas visually, just like on a desk, but better.' },
                { title: 'AI that understands', desc: 'Chat with your documents. Upload files and ask questions. The AI reads and connects information for you.' },
                { title: 'You own your data', desc: 'Your work belongs to you. Export everything anytime. No vendor lock-in, no tricks.' }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-8 hover:-translate-y-1 transition-transform duration-300 shadow-xl border border-[var(--glass-border)]"
                >
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{item.title}</h3>
                  <p className="text-[15px] text-[var(--text-muted)] leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMO SECTION */}
        <section className="py-24 px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                See it in <span className="text-[var(--accent)]">action</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                Watch Oracle AI build a complex research space organizing documents, images, and maps in real-time.
              </p>
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="glass bg-[var(--bg-main)] rounded-2xl md:rounded-[2rem] p-2 border border-[var(--glass-border)] shadow-2xl aspect-video overflow-hidden"
            >
              <iframe 
                className="w-full h-full rounded-xl md:rounded-3xl"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}`}
                title="Cyberia Space Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Loved by <span className="text-[var(--accent)]">thinkers</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                Join other researchers, designers, and engineers who have upgraded their mental space.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass p-8 rounded-2xl border border-[var(--glass-border)] flex flex-col relative group hover:-translate-y-1 transition-transform duration-300 shadow-xl"
                >
                  <Quote className="w-10 h-10 text-[var(--accent)]/20 absolute top-6 right-8 group-hover:text-[var(--accent)]/40 transition-colors" />
                  
                  <p className="text-[15px] text-[var(--text-primary)] leading-relaxed mb-8 relative z-10 italic">
                    "{testimonial.quote}"
                  </p>

                  <div className="flex items-center gap-4 mt-auto">
                    <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-bold text-xs uppercase">
                      {testimonial.avatar}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{testimonial.author}</p>
                      <p className="text-xs text-[var(--text-muted)]">{testimonial.role}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* COMMUNITY SECTION */}
        <section className="py-24 px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="glass rounded-[2rem] p-10 md:p-16 border border-[var(--glass-border)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/10 blur-[80px] rounded-full pointer-events-none" />
              
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6 border border-[var(--accent)]/20">
                <MessageCircle className="w-8 h-8 text-[var(--accent)]" />
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Join the community
              </h2>
              
              <p className="text-[var(--text-muted)] text-lg mb-10 max-w-lg mx-auto">
                Help shape the platform. Share feedback, report bugs, and connect with other thinkers.
              </p>

              {/*{discordData && (
                <div className="flex items-center justify-center gap-10 mb-10">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[var(--text-primary)]">{discordData.member_count.toLocaleString()}</p>
                    <p className="text-sm text-[var(--text-muted)] font-medium mt-1">Members</p>
                  </div>
                  <div className="w-px h-12 bg-[var(--glass-border)]" />
                  <div className="text-center">
                    <p className="text-3xl font-bold text-emerald-500">{discordData.presence_count.toLocaleString()}</p>
                    <p className="text-sm text-[var(--text-muted)] font-medium mt-1">Online now</p>
                  </div>
                </div>
              )}*/}
              
              <a 
                href={discordData?.instant_invite || "https://discord.gg/YOUR_INVITE_CODE"} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-[#ffffff] rounded-xl text-base font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                Join Discord
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="py-24 px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Questions & <span className="text-[var(--accent)]">Answers</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">Everything you need to know about the platform.</p>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
              {FAQ_ITEMS.map((item, index) => (
                <FAQItem 
                  key={index} 
                  {...item} 
                  isOpen={activeFAQIndex === index}
                  onToggle={() => setActiveFAQIndex(activeFAQIndex === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT SECTION */}
        <section id="contact" className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Get in <span className="text-[var(--accent)]">touch</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">Have questions or feedback? We'd love to hear from you.</p>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass p-8 md:p-10 rounded-2xl border border-[var(--glass-border)] shadow-xl"
            >
              {contactSubmitStatus === 'success' ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-16 text-center space-y-4">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
                  <div>
                    <p className="text-xl font-bold text-emerald-500">Message sent successfully</p>
                    <p className="text-[var(--text-muted)] mt-2">We'll get back to you shortly.</p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium text-[var(--text-dimmed)]">Name</label>
                      <input 
                        id="name"
                        type="text" 
                        placeholder="Jane Doe" 
                        value={contactName} 
                        onChange={(e) => setContactName(e.target.value)} 
                        className="w-full h-12 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl px-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium text-[var(--text-dimmed)]">Email <span className="text-rose-400">*</span></label>
                      <input 
                        id="email"
                        type="email" 
                        required 
                        placeholder="jane@example.com" 
                        value={contactEmail} 
                        onChange={(e) => setContactEmail(e.target.value)} 
                        className="w-full h-12 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl px-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium text-[var(--text-dimmed)]">Message <span className="text-rose-400">*</span></label>
                    <textarea 
                      id="message"
                      required 
                      value={contactMessage} 
                      onChange={(e) => setContactMessage(e.target.value)} 
                      placeholder="How can we help?" 
                      className="w-full h-32 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl p-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all resize-none" 
                    />
                  </div>
                  {contactSubmitStatus === 'error' && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium text-center">
                      Failed to send message. Please try again.
                    </div>
                  )}
                  <button 
                    type="submit" 
                    disabled={isContactSubmitting || !contactMessage.trim() || !contactEmail.trim()} 
                    className="w-full h-12 mt-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--accent-contrast)] rounded-xl font-semibold text-[15px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
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

        {/* CTA SECTION */}
        <section className="py-32 px-6 relative z-10 text-center overflow-hidden">
          <div className="max-w-2xl mx-auto relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Rocket className="w-12 h-12 text-[var(--accent)] mx-auto mb-6 drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
              <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
                Start building <span className="text-[var(--accent)]">today</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg mb-10">
                Join a new generation of thinkers mapping the future in their digital space.
              </p>
              <a
                  href="/home"
                  className="inline-flex items-center gap-3 px-10 py-5  bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  Try it for Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
              
              
            </motion.div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-[var(--accent)]/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
        </section>
      </main>

      {/* MODALS */}
      <AnimatePresence>
        {isImageZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[var(--bg-page)]/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsImageZoomed(false)}
          >
            <button
              onClick={() => setIsImageZoomed(false)}
              className="absolute top-6 right-6 p-2 bg-[var(--glass-bg)] rounded-full border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-border)] transition-all backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={theme === 'light' ? '/LightScreenshot.png' : '/DarkScreenshot.png'}
              alt="Cyberia Space Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVideoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[var(--bg-page)]/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
            onClick={() => setIsVideoOpen(false)}
          >
            <button
              onClick={() => setIsVideoOpen(false)}
              className="absolute top-6 right-6 p-2 bg-[var(--glass-bg)] rounded-full border border-[var(--glass-border)] text-[var(--text-primary)] hover:bg-[var(--glass-border)] transition-all backdrop-blur-md z-20"
            >
              <X className="w-5 h-5" />
            </button>
            
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-6xl aspect-video bg-[var(--bg-main)] rounded-2xl md:rounded-3xl border border-[var(--glass-border)] overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe 
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1`}
                title="Cyberia Space Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default Homepage;