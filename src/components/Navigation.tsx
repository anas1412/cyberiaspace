import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface NavigationProps {
  isHomepage?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isHomepage = false }) => {
  const { user } = useAuthStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const navItems = ['features', 'about', 'faq', 'contact'];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 ${
      isScrolled 
        ? 'bg-[#05060a]/40 backdrop-blur-3xl shadow-sm shadow-white/5 py-3' 
        : 'bg-transparent py-4'
    }`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <a 
          href="/" 
          className="text-2xl font-black tracking-tighter uppercase cursor-pointer text-white no-underline"
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
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center h-10 p-1 rounded-2xl">
            {navItems.map((item) => (
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
            <a 
              href="/pricing"
              className="px-3 h-full rounded-xl transition-all duration-300 flex items-center group/nav"
            >
              <span className={`text-[10px] font-black uppercase tracking-[0.15em] transition-colors ${
                window.location.pathname === '/pricing' ? 'text-[var(--accent)]' : 'text-slate-400 group-hover/nav:text-white'
              }`}>
                pricing
              </span>
            </a>
          </div>

          {user ? (
            <a 
              href="/home" 
              className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
            >
              Access My Space
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </a>
          ) : (
            <a 
              href="/login" 
              className="h-10 px-6 bg-[var(--accent)] hover:bg-[var(--accent-secondary)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-[var(--accent)]/20 hover:shadow-[var(--accent)]/40 flex items-center justify-center border border-white/10 gap-2 group"
            >
              Log In
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </a>
          )}
        </div>

        {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
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
            className="md:hidden glass border-t border-white/5 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
              {navItems.map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item)} 
                  className="text-left text-[12px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-[var(--accent-secondary)] transition-colors"
                >
                  {item}
                </button>
              ))}
              <a 
                href="/pricing"
                className={`text-left text-[12px] font-black uppercase tracking-[0.3em] transition-colors ${
                  window.location.pathname === '/pricing' ? 'text-[var(--accent)]' : 'text-slate-400 hover:text-[var(--accent-secondary)]'
                }`}
              >
                pricing
              </a>
              {user ? (
                <a href="/home" className="w-full py-3 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center flex items-center justify-center gap-2 group">
                  Access My Space
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </a>
              ) : (
                <a href="/login" className="w-full py-3 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all text-center flex items-center justify-center gap-2 group">
                  Log In
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
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
