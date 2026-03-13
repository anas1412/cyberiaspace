import React, { useEffect } from "react";
import { useMotionValue, useSpring, motion } from "framer-motion";

const MouseGlow: React.FC = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 50, stiffness: 100 });
  const springY = useSpring(mouseY, { damping: 50, stiffness: 100 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="fixed z-0 pointer-events-none w-[100vw] h-[100vw] max-w-[1200px] max-h-[1200px] rounded-full will-change-transform"
      style={{
        left: springX,
        top: springY,
        x: "-50%",
        y: "-50%",
        background: "radial-gradient(circle at center, var(--glow-color) 0%, transparent 70%)",
        opacity: 0.8,
      }}
    />
  );
};

export default MouseGlow;