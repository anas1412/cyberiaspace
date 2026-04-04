import React from "react";
import { useStore } from "../../store/useStore";
import Starfield from "./layers/Starfield";
import Atmosphere from "./layers/Atmosphere";

const BackgroundEngine: React.FC = () => {
  const theme = useStore((state) => state.theme);
  const customBg = useStore((state) => state.customBg);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none" style={{ backgroundColor: 'var(--bg-page)' }}>
      {customBg && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${customBg})` }}
        />
      )}

      {!customBg && (
        <div className="relative z-10 w-full h-full">
          <Atmosphere />
        </div>
      )}

      <div className="relative z-20 w-full h-full">
        <Starfield theme={theme} />
      </div>

      {customBg && (
        <div 
          className="absolute inset-0 z-30 pointer-events-none"
          style={{ 
            background: `radial-gradient(ellipse at center, transparent 0%, transparent 70%, ${theme === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.25)'} 100%)`
          }}
        />
      )}
    </div>
  );
};

export default BackgroundEngine;
