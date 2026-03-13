import React from "react";

const Atmosphere: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Dynamic Nebulae */}
      <div 
        className="absolute top-[10%] left-[20%] w-[70vw] h-[70vw] rounded-full blur-[120px] opacity-20 mix-blend-screen animate-float-slow"
        style={{ 
          background: "radial-gradient(circle, var(--nebula-1) 0%, transparent 70%)",
        }}
      />
      <div 
        className="absolute bottom-[10%] right-[10%] w-[80vw] h-[80vw] rounded-full blur-[150px] opacity-15 mix-blend-screen animate-float-reverse"
        style={{ 
          background: "radial-gradient(circle, var(--nebula-2) 0%, transparent 70%)",
        }}
      />
    </div>
  );
};

export default Atmosphere;