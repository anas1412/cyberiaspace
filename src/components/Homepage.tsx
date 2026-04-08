import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Cpu, Rocket, Send, Loader2, CheckCircle, ChevronDown, MessageCircle, X, Play, Quote, Plus, FileText, Layout } from 'lucide-react';

import { YOUTUBE_VIDEO_ID, DISCORD_INVITE_URL } from '../constants';

import HowItWorksVisual from './demo/HowItWorksVisual';

import BackgroundEngine from './background/BackgroundEngine';
import Navigation from './Navigation';
import Footer from './Footer';
import { useStore } from '../store/useStore';

interface ActiveUser {
  name: string;
  avatar: string | null;
}

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
];

const FALLBACK_USERS: ActiveUser[] = [
  { name: 'Anas B.', avatar: null },
  { name: 'Nydhal G.', avatar: null },
  { name: 'Zied B.', avatar: null },
  { name: 'Natsu D.', avatar: null },
  { name: 'Nadia D.', avatar: null },
  { name: 'Bessem O.', avatar: null },
];

const AvatarCircle: React.FC<{ user: ActiveUser; index: number; delay: number }> = React.memo(
  ({ user, index, delay }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);
    const initials = user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    const hasAvatar = user.avatar && !error;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-6 h-6 rounded-full border-2 border-[var(--bg-page)] overflow-hidden relative -ml-2 first:ml-0"
        title={user.name}
      >
        {hasAvatar && (
          <img
            src={user.avatar!}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        )}
        {(!hasAvatar || error) && (
          <div className={`w-full h-full ${AVATAR_COLORS[index % AVATAR_COLORS.length]} flex items-center justify-center text-white text-[7px] font-bold`}>
            {initials}
          </div>
        )}
      </motion.div>
    );
  }
);

const ActiveUsersStack: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<ActiveUser[]>(FALLBACK_USERS);
  

  useEffect(() => {
    fetch('/api/public-stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.users && data.users.length > 0) {
          setUsers(data.users.slice(0, 6));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-center mt-8"
    >
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full
                      bg-[var(--glass-bg)] backdrop-blur-md
                      border border-[var(--glass-border)]">
        <div className="flex items-center">
          {users.map((user, i) => (
            <AvatarCircle key={user.name + i} user={user} index={i} delay={0.5 + i * 0.05} />
          ))}
        </div>

        <div className="w-px h-3 bg-[var(--glass-border)]" />

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-[var(--text-muted)] whitespace-nowrap">
            {/* {activeCount} */}
            {t('homepage.social_proof.adopters')}
          </span>
        </div>
      </div>
    </motion.div>
  );
});

const TESTIMONIALS = [
  {
    quote: "Cyberia changed how I interact with my tasks. Seeing my notes as floating entities helped me stay productive all day.",
    author: "Nidhal G.",
    role: "Senior Software Developper",
    avatar: "NG"
  },
  {
    quote: "The canvas view is a game-changer for researching. I can finally map out my entire thesis visually with the AI aware of all my notes.",
    author: "Mohamed C.",
    role: "University Student",
    avatar: "MD"
  },
  {
    quote: "The transition between freeform canvas and calendar is seamless. Adding AI-awareness helped me optimize my workflow ",
    author: "Nadia D.",
    role: "UI/UX Designer",
    avatar: "ND"
  }
];

const FAQ_ITEMS = [
  {
    questionKey: 'homepage.faq.items.0.question',
    answerKey: 'homepage.faq.items.0.answer'
  },
  {
    questionKey: 'homepage.faq.items.1.question',
    answerKey: 'homepage.faq.items.1.answer'
  },
  {
    questionKey: 'homepage.faq.items.2.question',
    answerKey: 'homepage.faq.items.2.answer'
  },
  {
    questionKey: 'homepage.faq.items.3.question',
    answerKey: 'homepage.faq.items.3.answer'
  },
  {
    questionKey: 'homepage.faq.items.4.question',
    answerKey: 'homepage.faq.items.4.answer'
  },
  {
    questionKey: 'homepage.faq.items.5.question',
    answerKey: 'homepage.faq.items.5.answer'
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
  const { t } = useTranslation();
  const { theme } = useStore();
  const [activeHowItWorksStep, setActiveHowItWorksStep] = useState(0);
  const [howItWorksRestartKey, setHowItWorksRestartKey] = useState(0);
  const [activeFAQIndex, setActiveFAQIndex] = useState<number | null>(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isHowItWorksVisible, setIsHowItWorksVisible] = useState(false);
  const howItWorksRef = useRef<HTMLElement>(null);
  
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [contactSubmitStatus, setContactSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
                {t('homepage.hero.title')}<br />
                <motion.span
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                  className="bg-clip-text text-transparent bg-gradient-to-r from-[var(--accent)] to-[var(--accent-secondary)]"
                >
                  {t('homepage.hero.subtitle')}
                </motion.span>
              </h1>
              
              <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                {t('homepage.hero.description')}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="/home"
                  className="w-full sm:w-auto px-10 py-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  {t('homepage.hero.cta_free')}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <button
                  onClick={() => setIsVideoOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-[var(--glass-bg)] hover:bg-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 group border border-[var(--glass-border)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                >
                  <Play className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                  {t('homepage.hero.cta_demo')}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Active Users Social Proof */}
          <ActiveUsersStack />

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

        {/* HOW IT WORKS SECTION */}
        <section ref={howItWorksRef} id="how-it-works" className="py-24 md:py-32 px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="mb-16 md:mb-24 text-center">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                {t('homepage.how_it_works.title_start')}<span className="text-[var(--accent)]">{t('homepage.how_it_works.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg md:text-xl">
                {t('homepage.how_it_works.subtitle')}
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 items-start">
              {/* Step Cards */}
              <div className="w-full lg:w-5/12 space-y-3">
                {[
                  { step: 0, title: t('homepage.how_it_works.steps.0.title'), desc: t('homepage.how_it_works.steps.0.description'), icon: Plus },
                  { step: 1, title: t('homepage.how_it_works.steps.1.title'), desc: t('homepage.how_it_works.steps.1.description'), icon: FileText },
                  { step: 2, title: t('homepage.how_it_works.steps.2.title'), desc: t('homepage.how_it_works.steps.2.description'), icon: Layout },
                  { step: 3, title: t('homepage.how_it_works.steps.3.title'), desc: t('homepage.how_it_works.steps.3.description'), icon: Cpu }
                ].map((item) => (
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
                            {item.desc}
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

        {/* ABOUT SECTION */}
        <section id="about" className="py-24 px-6 relative z-10 bg-[var(--accent)]/[0.02]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                {t('homepage.about.title_start')}<span className="text-[var(--accent)]">{t('homepage.about.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">{t('homepage.about.subtitle')}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: t('homepage.about.scattered.title'), desc: t('homepage.about.scattered.description') },
                { title: t('homepage.about.visual.title'), desc: t('homepage.about.visual.description') },
                { title: t('homepage.about.agentic_action.title'), desc: t('homepage.about.agentic_action.description') },
                { title: t('homepage.about.ownership.title'), desc: t('homepage.about.ownership.description') }
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
                {t('homepage.demo.title_start')}<span className="text-[var(--accent)]">{t('homepage.demo.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                {t('homepage.demo.description')}
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
                {t('homepage.testimonials.title_start')}<span className="text-[var(--accent)]">{t('homepage.testimonials.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg max-w-2xl mx-auto">
                {t('homepage.testimonials.description')}
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
                {t('homepage.community.title')}
              </h2>
              
              <p className="text-[var(--text-muted)] text-lg mb-10 max-w-lg mx-auto">
                {t('homepage.community.description')}
              </p>
              
              <a 
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-[#ffffff] rounded-xl text-base font-semibold transition-all shadow-lg hover:shadow-xl active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
              >
                {t('homepage.community.cta')}
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
                {t('homepage.faq.title_start')}<span className="text-[var(--accent)]">{t('homepage.faq.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">{t('homepage.faq.subtitle')}</p>
            </div>

            <div className="glass rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
              {FAQ_ITEMS.map((item, index) => (
                <FAQItem 
                  key={index} 
                  question={t(item.questionKey)}
                  answer={t(item.answerKey)}
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
                {t('homepage.contact.title_start')}<span className="text-[var(--accent)]">{t('homepage.contact.title_accent')}</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg">{t('homepage.contact.subtitle')}</p>
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
                    <p className="text-xl font-bold text-emerald-500">{t('homepage.contact.form.success')}</p>
                    <p className="text-[var(--text-muted)] mt-2">{t('homepage.contact.form.success_desc')}</p>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium text-[var(--text-dimmed)]">{t('homepage.contact.form.name')}</label>
                      <input 
                        id="name"
                        type="text" 
                        placeholder={t('homepage.contact.form.placeholder_name')} 
                        value={contactName} 
                        onChange={(e) => setContactName(e.target.value)} 
                        className="w-full h-12 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl px-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium text-[var(--text-dimmed)]">{t('homepage.contact.form.email')} <span className="text-rose-400">*</span></label>
                      <input 
                        id="email"
                        type="email" 
                        required 
                        placeholder={t('homepage.contact.form.placeholder_email')} 
                        value={contactEmail} 
                        onChange={(e) => setContactEmail(e.target.value)} 
                        className="w-full h-12 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl px-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium text-[var(--text-dimmed)]">{t('homepage.contact.form.message')} <span className="text-rose-400">*</span></label>
                    <textarea 
                      id="message"
                      required 
                      value={contactMessage} 
                      onChange={(e) => setContactMessage(e.target.value)} 
                      placeholder={t('homepage.contact.form.placeholder_message')} 
                      className="w-full h-32 bg-[var(--bg-main)] border border-[var(--glass-border)] rounded-xl p-4 text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]/50 focus:bg-[var(--glass-bg)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all resize-none" 
                    />
                  </div>
                  {contactSubmitStatus === 'error' && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-medium text-center">
                      {t('homepage.contact.form.error')}
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
                        {t('homepage.contact.form.submit')}
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
                {t('homepage.cta_section.title')}
              </h2>
              <p className="text-[var(--text-muted)] text-lg mb-10">
                {t('homepage.cta_section.description')}
              </p>
              <a
                  href="/home"
                  className="inline-flex items-center gap-3 px-10 py-5  bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-contrast)] rounded-xl text-base font-semibold transition-all shadow-lg shadow-[var(--accent)]/25 active:scale-95 flex items-center justify-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)] focus-visible:ring-[var(--accent)]"
                >
                  {t('homepage.cta_section.cta')}
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