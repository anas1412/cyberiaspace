import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-20 px-6 border-t border-white/5 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Cyberia AI Studio" className="w-8 h-8 opacity-50" />
          <span className="font-black uppercase tracking-widest text-[var(--text-muted)] text-[10px]">Cyberia AI Studio</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Sale (CGV)</a>
          <a href="/legal" className="hover:text-white transition-colors">Legal Notice</a>
          <a href="/contact" className="hover:text-white transition-colors">Contact</a>
        </div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          © {new Date().getFullYear()} CYBERIA AI STUDIO
        </div>
      </div>
    </footer>
  );
};

export default Footer;
