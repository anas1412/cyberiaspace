import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Cpu, Rocket, ChevronDown, MessageCircle, X,
  Quote, Plus, FileText, Layout, Shield, XCircle, CheckCircle2,
  Github, Layers, Bot, Mail, Check
} from 'lucide-react';

import { DISCORD_INVITE_URL } from '../constants';
import HowItWorksVisual from './demo/HowItWorksVisual';
import BackgroundEngine from './background/BackgroundEngine';
import Navigation from './Navigation';
import Footer from './Footer';
import { useStore } from '../store/useStore';

const GITHUB_URL = 'https://github.com/anas1412/cyberia';

const TESTIMONIALS = [
  {
    quote: 'Cyberia completely changed how I organize my research. It\'s like having a whiteboard that never runs out of space.',
    author: 'Nadia G.',
    role: 'Researcher',
    avatar: "NG"
  },
  {
    quote: 'The spatial approach is a game-changer. I can finally see the big picture of my projects.',
    author: 'Marcus C.',
    role: 'Product Designer',
    avatar: "MC"
  },
  {
    quote: 'Finally, a tool that works the way my brain works. The stack system is brilliant for grouping related ideas.',
    author: 'Nina D.',
    role: 'Writer',
    avatar: "ND"
  }
];

const FEATURES = [
  {
    icon: Layers,
    title: 'Unified Workspace',
    description: 'Combine notes, files, links, and AI in one spatial canvas. Drag, connect, and organize anything.',
    iconBg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]'
  },
  {
    icon: Bot,
    title: 'AI-Powered',
    description: 'Access 300+ AI models through OpenRouter. Bring your own API key to use ChatGPT, Claude, Gemini, and more.',
    iconBg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]'
  },
  {
    icon: Shield,
    title: 'Local-First Storage',
    description: 'Everything stays on your machine. No accounts, no cloud uploads — your workspace is yours, completely private.',
    iconBg: 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]'
  }
];

const HOW_IT_WORKS_STEPS = [
  {
    step: 0,
    title: 'Create a Space',
    description: 'Start by creating a workspace for your project. Switch between spaces to keep different ideas organized and separated.',
    icon: Plus
  },
  {
    step: 1,
    title: 'Add Your Thoughts',
    description: 'Click anywhere on the canvas to drop a thought. Each thought is a physical object you can move, resize, and customize.',
    icon: FileText
  },
  {
    step: 2,
    title: 'Switch Views',
    description: 'View your thoughts in spatial, directory, kanban, or calendar mode. Each perspective reveals new connections and patterns.',
    icon: Layout
  },
  {
    step: 3,
    title: 'Think with AI',
    description: 'Use OpenRouter AI models right in your workspace. Ask questions, get summaries, brainstorm — all without leaving your canvas.',
    icon: Cpu
  }
];

const FAQ_ITEMS = [
  {
    question: 'What is Cyberia?',
    answer: 'Cyberia is a spatial-thinking workspace where your thoughts become physical objects you can move, organize, and connect on an infinite canvas. Designed for researchers, writers, designers, and anyone who thinks visually — it\'s a new way to work with ideas.'
  },
  {
    question: 'How does the AI work?',
    answer: 'Cyberia uses OpenRouter to give you access to 300+ AI models including ChatGPT, Claude, Gemini, and more. You bring your own API key — no subscriptions, no usage limits imposed by us. Your data is sent only to the model you choose for inference and is never used for training.'
  },
  {
    question: 'Is my data private?',
    answer: 'Absolutely. Cyberia is 100% local-first. Your workspace lives entirely on your device — nothing is uploaded anywhere without your explicit action. Your thoughts, files, and ideas remain under your control at all times.'
  },
  {
    question: 'Is it really free?',
    answer: 'Yes! Cyberia is completely free and open-source. There are no paid plans, no hidden features behind a paywall, and no account required. You only need an OpenRouter API key if you want to use AI features — and you control that directly.'
  },
  {
    question: 'Where\'s the mobile app?',
    answer: 'Currently, Cyberia is a desktop-only web application optimized for mouse and keyboard. A mobile version is on the roadmap but not yet available. We recommend using it on a laptop or desktop for the best experience.'
  },
  {
    question: 'Can I contribute to the project?',
    answer: 'Absolutely! Cyberia is open-source on GitHub. You can report bugs, request features, submit pull requests, or join our Discord community to help shape the future of the spatial-thinking workspace.'
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

const Homepage: React.FC = () => {
  const { theme } = useStore();
  const [activeHowItWorksStep, setActiveHowItWorksStep] = useState(0);
  const [howItWorksRestartKey, setHowItWorksRestartKey] = useState(0);
  const [activeFAQIndex, setActiveFAQIndex] = useState<number | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isHowItWorksVisible, setIsHowItWorksVisible] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const SUPPORT_EMAIL = 'support@cyberiaspace.app';
  const howItWorksRef = useRef<HTMLElement>(null);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = SUPPORT_EMAIL;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  // Detect when How It Works section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHowItWorksVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (howItWorksRef.current) {
      observer.observe(howItWorksRef.current);
    }

    return () => observer.disconnect();
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
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                The Only Workspace<br />
                <motion.span
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]"
                >
                  You Will Ever Need
                </motion.span>
              </h1>

              <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                Visual thinking. Task management. Calendar planning. AI that takes action. File storage. All connected. All in one place.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/home"
                  className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  Launch Cyberia
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-8 py-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 group border border-[var(--glass-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Github className="w-5 h-5" />
                  View on GitHub
                </a>
              </div>

              {/* Open-source highlights */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-center mt-8"
              >
                <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">Get started instantly</span>
                  </div>
                  <div className="w-px h-3 bg-[var(--glass-border)]" />
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">Local-first</span>
                  </div>
                  <div className="w-px h-3 bg-[var(--glass-border)]" />
                  <div className="flex items-center gap-1.5">
                    <Github className="w-3 h-3 text-[var(--text-muted)]" />
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">Open-source</span>
                  </div>
                </div>
              </motion.div>
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
                alt="Cyberia spatial workspace interface"
                className="w-full h-auto rounded-xl md:rounded-3xl border border-[var(--glass-border)] group-hover:scale-[1.01] transition-transform duration-700 ease-out"
              />
            </div>

            <div className="absolute inset-0 bg-[var(--accent)]/20 blur-[120px] rounded-full pointer-events-none -z-10" />
          </motion.div>
        </section>

        {/* FEATURES SECTION */}
        <section id="features" className="py-24 px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Everything you need for <span className="text-[var(--accent)]">spatial thinking</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">A workspace that adapts to how your mind naturally organizes information.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="glass group relative p-6 md:p-8 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all duration-500 shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/5"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 border transition-all ${feature.iconBg} group-hover:bg-[var(--accent)]/20`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-[var(--text-primary)]">
                    {feature.title}
                  </h3>
                  <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT SECTION */}
        <section id="about" className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16 md:mb-20">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Why <span className="text-[var(--accent)]">Cyberia?</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">Traditional tools were built for folders and lists — not for spatial thinking.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {[
                { pain: 'My notes are scattered across different apps and folders.', solution: 'One infinite canvas where everything lives together, connected naturally.' },
                { pain: 'I spend more time organizing my notes than actually thinking.', solution: 'Thoughts are physical objects. Move them, stack them, connect them — just like things on your desk.' },
                { pain: 'I don\'t want my data uploaded to someone else\'s cloud.', solution: '100% local-first. Your data stays on your device, always under your control.' },
                { pain: 'AI tools are locked behind subscriptions I don\'t need.', solution: 'Bring your own API key. Only pay for what you use, directly to the model provider.' }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass group relative p-8 md:p-10 rounded-xl border border-[var(--glass-border)] hover:border-[var(--accent)]/30 hover:bg-[var(--glass-bg)] transition-all duration-500 overflow-hidden shadow-lg hover:shadow-xl hover:shadow-[var(--accent)]/5"
                >
                  {/* Subtle background glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/0 via-[var(--accent)]/0 to-[var(--accent)]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                  <div className="relative z-10 flex flex-col h-full justify-between">
                    {/* PAIN */}
                    <div className="mb-8">
                      <p className="text-[16px] md:text-[17px] text-[var(--text-muted)] italic leading-relaxed">
                        <XCircle className="w-4 h-4 text-rose-400 inline mr-2 -mt-0.5" />
                        &ldquo;{item.pain}&rdquo;
                      </p>
                    </div>

                    {/* DIVIDER */}
                    <div className="mb-8">
                      <div className="w-full h-px bg-gradient-to-r from-[var(--glass-border)] via-[var(--glass-border)] to-transparent" />
                    </div>

                    {/* SOLUTION */}
                    <div>
                      <p className="text-[16px] md:text-[17px] text-[var(--text-primary)] font-medium leading-relaxed">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 inline mr-2 -mt-0.5" />
                        {item.solution}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section ref={howItWorksRef} id="how-it-works" className="py-24 md:py-32 px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 md:mb-24 text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                How it <span className="text-[var(--accent)]">works</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg md:text-xl">
                From your first thought to a fully organized spatial canvas.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
              {/* Step Cards */}
              <div className="w-full lg:w-5/12 space-y-3">
                {HOW_IT_WORKS_STEPS.map((item) => (
                  <motion.div
                    key={item.step}
                    onClick={() => { setActiveHowItWorksStep(item.step); setHowItWorksRestartKey(k => k + 1); }}
                    className={`w-full text-left relative p-6 rounded-2xl group cursor-pointer transition-all ${
                      activeHowItWorksStep === item.step
                        ? 'bg-[var(--glass-bg)] border border-[var(--accent)]/30 shadow-xl shadow-[var(--accent)]/10 translate-x-0 lg:translate-x-2'
                        : 'border border-transparent hover:bg-[var(--glass-bg)] hover:border-[var(--glass-border)]'
                    }`}
                  >
                    <div className="relative z-10 flex items-start gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        activeHowItWorksStep === item.step
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/30'
                          : 'bg-[var(--bg-main)] border-[var(--glass-border)] text-[var(--text-muted)] group-hover:border-[var(--accent)]/50 group-hover:text-[var(--accent)]'
                      }`}>
                        <item.icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className={`text-lg font-semibold mb-2 transition-colors duration-300 ${
                          activeHowItWorksStep === item.step ? 'text-[var(--text-primary)]' : 'text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)]'
                        }`}>
                          {item.title}
                        </h3>
                        <motion.div
                          initial={false}
                          animate={{
                            height: activeHowItWorksStep === item.step ? 'auto' : 0,
                            opacity: activeHowItWorksStep === item.step ? 1 : 0,
                          }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
                            {item.description}
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
                  <HowItWorksVisual
                    startFromStep={activeHowItWorksStep}
                    restartKey={howItWorksRestartKey}
                    onStepChange={setActiveHowItWorksStep}
                    isVisible={isHowItWorksVisible}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                What people <span className="text-[var(--accent)]">say</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                Early adopters who are already thinking in space.
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
                    &ldquo;{testimonial.quote}&rdquo;
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

        {/* FAQ SECTION */}
        <section id="faq" className="py-24 px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                Frequently asked <span className="text-[var(--accent)]">questions</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">Everything you need to know about Cyberia.</p>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
              {FAQ_ITEMS.map((item, index) => (
                <FAQItem
                  key={index}
                  question={item.question}
                  answer={item.answer}
                  isOpen={activeFAQIndex === index}
                  onToggle={() => setActiveFAQIndex(activeFAQIndex === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* COMMUNITY & CONTACT SECTION */}
        <section id="contact" className="py-24 px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="glass rounded-[2rem] p-10 md:p-16 border border-[var(--glass-border)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent)]/10 blur-[80px] rounded-full pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mx-auto mb-6 border border-[var(--accent)]/20">
                <MessageCircle className="w-8 h-8 text-[var(--accent)]" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Join the Community
              </h2>

              <p className="text-[var(--text-muted)] text-lg mb-10 max-w-lg mx-auto">
                Be part of something new. Share ideas, get help, and help shape the future of spatial thinking.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-[#ffffff] rounded-xl text-base font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                >
                  Join Discord
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-base font-semibold transition-all border border-[var(--glass-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Github className="w-4 h-4" />
                  Star on GitHub
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>

              <div className="mt-10 pt-10 border-t border-[var(--glass-border)]">
                <p className="text-[var(--text-muted)] text-sm mb-4">
                  Or reach out directly via email
                </p>
                <button
                  onClick={handleCopyEmail}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
                >
                  {emailCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Mail className="w-4 h-4" /> {SUPPORT_EMAIL}</>}
                </button>
              </div>
            </div>
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
                Start thinking in space
              </h2>
              <p className="text-[var(--text-muted)] text-lg mb-10 max-w-lg mx-auto">
                Free, open-source, local-first. Your canvas, your data, your AI.
                Get started instantly.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/home"
                  className="inline-flex items-center justify-center gap-2 px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  Launch Cyberia
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-base font-semibold transition-all border border-[var(--glass-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Github className="w-5 h-5" />
                  View Source
                </a>
              </div>
            </motion.div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-[var(--accent)]/10 blur-[120px] rounded-full -z-10 pointer-events-none" />
        </section>
      </main>

      {/* IMAGE ZOOM MODAL */}
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
              alt="Cyberia spatial workspace preview"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
};

export default Homepage;
