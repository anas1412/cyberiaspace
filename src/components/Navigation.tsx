import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useStore } from '../store/useStore';

interface NavigationProps {
  isHomepage?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isHomepage = false }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { theme, setTheme, language, setLanguage } = useStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'fr' : 'en';
    setLanguage(newLang);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    if (isHomepage) {
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = `/#${id}`;
    }
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'features', label: t('nav.features') },
    { id: 'about', label: t('nav.about') },
    { id: 'faq', label: t('nav.faq') },
    { id: 'contact', label: t('nav.contact') },
    { id: 'pricing', label: t('nav.pricing'), isLink: true },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
      isScrolled
        ? 'bg-[var(--bg-page)]/80 backdrop-blur-3xl shadow-sm shadow-[var(--glass-border)] py-3'
        : 'bg-transparent py-4'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <a
            href="/"
            className="text-2xl font-black tracking-tighter uppercase cursor-pointer text-[var(--text-primary)] no-underline"
            onClick={(e) => {
              if (isHomepage) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
        >
          Cyberia <span style={{ color: 'var(--accent)' }}>Space</span>
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="group relative h-10 w-10 flex items-center justify-center transition-all hover:opacity-70"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-[var(--text-muted)]" />
            ) : (
              <Sun className="w-5 h-5 text-[var(--text-muted)]" />
            )}
          </button>

          <button
            onClick={toggleLanguage}
            className="group relative h-10 w-10 flex items-center justify-center transition-all hover:opacity-70"
            aria-label="Toggle language"
          >
            <span className="text-xs font-bold text-[var(--text-muted)]">{language.toUpperCase()}</span>
          </button>

          {user ? (
            <a 
              href="/home" 
              className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
            >
              {t('nav.launch')}
            </a>
          ) : (
            <a 
              href="/login" 
              className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-[var(--accent-contrast)] rounded-xl text-sm font-semibold tracking-wide transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
            >
              {t('nav.login')}
            </a>
          )}
        </div>

        <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-1">
          <div className="flex items-center h-10 p-1 rounded-2xl">
            {navItems.map((item) => (
              item.isLink ? (
                <a 
                  key={item.id}
                  href="/pricing"
                  className="px-3 h-full rounded-xl transition-all duration-300 flex items-center group/nav"
                >
                  <span className={`text-sm font-semibold tracking-wide transition-colors ${
                    window.location.pathname === '/pricing' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] group-hover/nav:text-[var(--text-primary)]'
                  }`}>
                    {item.label}
                  </span>
                </a>
              ) : (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id)} 
                  className="px-3 h-full rounded-xl transition-all duration-300 flex items-center group/nav"
                >
                  <span className="text-sm font-semibold tracking-wide text-[var(--text-muted)] group-hover/nav:text-[var(--text-primary)] transition-colors">
                    {item.label}
                  </span>
                </button>
              )
            ))}
          </div>
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
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
            className="md:hidden glass border-t border-[var(--glass-border)] overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
          {navItems.filter(item => !item.isLink).map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className="text-left text-sm font-medium text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              {item.label}
            </button>
          ))}
          <a
            href="/pricing"
            className={`text-left text-sm font-medium transition-colors ${
              window.location.pathname === '/pricing' ? 'text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--accent-secondary)]'
            }`}
          >
            {t('nav.pricing')}
          </a>
              <button
                onClick={toggleTheme}
                className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-5 h-5" />
                    {t('nav.dark_mode')}
                  </>
                ) : (
                  <>
                    <Sun className="w-5 h-5" />
                    {t('nav.light_mode')}
                  </>
                )}
              </button>

              <button
                onClick={toggleLanguage}
                className="w-full py-3 flex items-center justify-center gap-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                <span className="text-xs font-bold">{language.toUpperCase()}</span>
                <span>{language === 'en' ? 'Français' : 'English'}</span>
              </button>

              {user ? (
                <a href="/home" className="w-full py-3 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl text-sm font-semibold transition-all text-center flex items-center justify-center gap-2 group">
                  Launch
                  
                </a>
              ) : (
                <a href="/login" className="w-full py-3 bg-[var(--accent)] text-[var(--accent-contrast)] rounded-xl text-sm font-semibold transition-all text-center flex items-center justify-center gap-2 group">
                  Log In
                  
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navigation;
