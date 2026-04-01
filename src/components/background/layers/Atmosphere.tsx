import React from "react";

interface AtmosphereProps {
  performanceMode: boolean;
}

import { useStore } from "../../../store/useStore";

const Atmosphere: React.FC<AtmosphereProps> = ({ performanceMode }) => {
  const theme = useStore((state) => state.theme);
  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Dynamic Nebulae with Bleed Area to cover scaling gaps */}
      <div
        className={`absolute w-[150%] h-[150%] left-[-25%] top-[-25%] rounded-full ${!performanceMode ? 'animate-float-slow' : ''}`}
        style={{
          background: "radial-gradient(circle at 40% 40%, var(--nebula-1) 0%, var(--nebula-1-soft) 45%, transparent 100%)",
          mixBlendMode: isLight ? 'soft-light' : 'screen',
          opacity: isLight ? 0.5 : 0.3,
        }}
      />
      <div
        className={`absolute w-[160%] h-[160%] right-[-30%] bottom-[-30%] rounded-full ${!performanceMode ? 'animate-float-reverse' : ''}`}
        style={{
          background: "radial-gradient(circle at 60% 60%, var(--nebula-2) 0%, var(--nebula-2-soft) 45%, transparent 100%)",
          mixBlendMode: isLight ? 'soft-light' : 'screen',
          opacity: isLight ? 0.45 : 0.25,
        }}
      />
    </div>
  );
};

export default Atmosphere;