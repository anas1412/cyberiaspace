import React from "react";

interface AtmosphereProps {
  performanceMode: boolean;
}

const Atmosphere: React.FC<AtmosphereProps> = ({ performanceMode }) => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Dynamic Nebulae with Bleed Area to cover scaling gaps */}
      <div 
        className={`absolute w-[150%] h-[150%] left-[-25%] top-[-25%] rounded-full opacity-30 mix-blend-screen ${!performanceMode ? 'animate-float-slow' : ''}`}
        style={{ 
          background: "radial-gradient(circle at 40% 40%, var(--nebula-1) 0%, var(--nebula-1-soft) 45%, transparent 100%)",
        }}
      />
      <div 
        className={`absolute w-[160%] h-[160%] right-[-30%] bottom-[-30%] rounded-full opacity-25 mix-blend-screen ${!performanceMode ? 'animate-float-reverse' : ''}`}
        style={{ 
          background: "radial-gradient(circle at 60% 60%, var(--nebula-2) 0%, var(--nebula-2-soft) 45%, transparent 100%)",
        }}
      />
    </div>
  );
};

export default Atmosphere;