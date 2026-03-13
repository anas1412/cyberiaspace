import React from "react";

interface AtmosphereProps {
  performanceMode: boolean;
}

const Atmosphere: React.FC<AtmosphereProps> = ({ performanceMode }) => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Dynamic Nebulae */}
      <div 
        className={`absolute top-[10%] left-[20%] w-[70vw] h-[70vw] rounded-full blur-[120px] opacity-25 mix-blend-screen ${!performanceMode ? 'animate-float-slow' : ''}`}
        style={{ 
          background: "radial-gradient(circle, var(--nebula-1) 0%, transparent 80%)",
        }}
      />
      <div 
        className={`absolute bottom-[10%] right-[10%] w-[80vw] h-[80vw] rounded-full blur-[150px] opacity-20 mix-blend-screen ${!performanceMode ? 'animate-float-reverse' : ''}`}
        style={{ 
          background: "radial-gradient(circle, var(--nebula-2) 0%, transparent 80%)",
        }}
      />
    </div>
  );
};

export default Atmosphere;