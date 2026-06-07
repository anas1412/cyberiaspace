import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-20 px-6 border-t border-[var(--glass-border)] relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Cyberia AI Studio" className="w-8 h-8 opacity-70" />
          <span className="font-semibold tracking-wide text-[var(--text-muted)] text-sm">Cyberia AI Studio</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-semibold tracking-wide text-[var(--text-muted)]">
          <a href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms of Service</a>
          <a href="/legal" className="hover:text-[var(--text-primary)] transition-colors">Legal Notice</a>
        </div>
        <div className="text-sm font-semibold tracking-wide text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} Cyberia AI Studio
        </div>
      </div>
    </footer>
  );
};

export default Footer;
