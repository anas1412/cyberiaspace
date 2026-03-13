import React from "react";
import { useStore } from "../../store/useStore";
import MouseGlow from "./layers/MouseGlow";
import Starfield from "./layers/Starfield";
import Atmosphere from "./layers/Atmosphere";
import NoiseOverlay from "./layers/NoiseOverlay";

const BackgroundEngine: React.FC = () => {
  const theme = useStore((state) => state.theme);
  const performanceMode = useStore((state) => state.performanceMode);
  const customBg = useStore((state) => state.customBg);

  return (
    <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-[#05060a] select-none">
      {/* 1. Base Atmosphere (Nebulae) */}
      {!performanceMode && <Atmosphere />}

      {/* 2. Particle System (Canvas) */}
      <Starfield theme={theme} performanceMode={performanceMode} />

      {/* 3. Interactive Lighting */}
      {!performanceMode && <MouseGlow />}

      {/* 4. Texture & Noise */}
      <NoiseOverlay />

      {/* 5. Custom Background Blend */}
      {customBg && (
        <div 
          className="fixed inset-0 z-10 transition-opacity duration-700 mix-blend-overlay opacity-20"
          style={{ backgroundColor: "var(--bg-page)" }}
        />
      )}
    </div>
  );
};

export default BackgroundEngine;