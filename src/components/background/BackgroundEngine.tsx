import React, { useEffect, useState } from "react";
import { useStore } from "../../store/useStore";
import Starfield from "./layers/Starfield";
import Atmosphere from "./layers/Atmosphere";
import NoiseOverlay from "./layers/NoiseOverlay";

const BackgroundEngine: React.FC = () => {
  const theme = useStore((state) => state.theme);
  const performanceMode = useStore((state) => state.performanceMode);
  const customBg = useStore((state) => state.customBg);
  
  const [staticBg, setStaticBg] = useState<string | null>(null);

  // Handle GIF static frame for performance
  useEffect(() => {
    if (performanceMode && customBg && (customBg.includes('image/gif') || customBg.toLowerCase().endsWith('.gif'))) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = customBg;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            setStaticBg(canvas.toDataURL('image/webp', 0.8));
          } catch (e) {
            setStaticBg(null);
          }
        }
      };
    } else {
      setStaticBg(null);
    }
  }, [performanceMode, customBg]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#05060a] select-none">
      {/* 1. Base Background Image Layer */}
      {customBg && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 animate-in fade-in"
          style={{ 
            backgroundImage: `url(${staticBg || customBg})`,
            opacity: performanceMode ? 1.0 : 0.8 
          }}
        />
      )}

      {/* 2. Base Atmosphere (Nebulae) */}
      <div className="relative z-10 w-full h-full">
        <Atmosphere performanceMode={performanceMode} />
      </div>

      {/* 3. Particle System (Canvas) */}
      <div className="relative z-20 w-full h-full">
        <Starfield theme={theme} performanceMode={performanceMode} />
      </div>

      {/* 4. Texture & Noise */}
      <div className="relative z-30 w-full h-full">
        <NoiseOverlay />
      </div>

      {/* 5. Depth Overlay for Custom Background */}
      {customBg && !performanceMode && (
        <div 
          className="absolute inset-0 z-40 mix-blend-multiply opacity-10"
          style={{ backgroundColor: "#000" }}
        />
      )}
    </div>
  );
};

export default BackgroundEngine;