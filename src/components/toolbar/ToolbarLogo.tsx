import React from 'react';

export const ToolbarLogo: React.FC = () => (
  <div className="hidden lg:flex pointer-events-auto items-center h-[48px] flex-shrink-0">
    <a href="/" className="text-lg md:text-2xl font-bold tracking-tighter text-[var(--text-primary)] hover:opacity-70 transition-opacity">CYBERIA<span style={{ color: 'var(--accent)' }}> WORKSPACE</span></a>
  </div>
);
