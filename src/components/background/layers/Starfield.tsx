import React, { useEffect, useRef } from "react";

interface StarfieldProps {
  theme: string;
  performanceMode: boolean;
}

class Star {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  baseRadius: number = 0;
  vx: number = 0;
  vy: number = 0;
  alpha: number = 0;
  targetAlpha: number = 0;
  twinkleSpeed: number = 0;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.width;
    this.y = Math.random() * this.height;
    this.z = Math.random() * 3 + 1; 
    this.baseRadius = (Math.random() * 0.5 + 0.1) * (this.z * 0.4);
    this.vx = (Math.random() - 0.5) * 0.05; 
    this.vy = (Math.random() - 0.5) * 0.05;
    this.alpha = Math.random();
    this.targetAlpha = Math.random() > 0.4 ? Math.random() : 0; 
    this.twinkleSpeed = Math.random() * 0.005 + 0.002;
  }

  update(theme: string) {
    if (theme === "rain") {
      this.y += 15 * (this.z * 0.4); // Faster rain for particles closer to "camera"
      this.x += this.vx * 2; // Slight wind-blown effect
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }

    if (this.x < -20) this.x = this.width + 20;
    if (this.x > this.width + 20) this.x = -20;
    
    // Rain resets to top, stars loop in both directions
    if (theme === "rain") {
      if (this.y > this.height + 20) {
        this.y = -20;
        this.x = Math.random() * this.width;
      }
    } else {
      if (this.y < -20) this.y = this.height + 20;
      if (this.y > this.height + 20) this.y = -20;
    }

    if (this.alpha < this.targetAlpha) {
      this.alpha += this.twinkleSpeed;
      if (this.alpha >= this.targetAlpha) {
        this.alpha = this.targetAlpha;
        this.targetAlpha = Math.random() > 0.3 ? Math.random() : 0; 
      }
    } else {
      this.alpha -= this.twinkleSpeed;
      if (this.alpha <= this.targetAlpha) {
        this.alpha = this.targetAlpha;
        this.targetAlpha = Math.random() > 0.3 ? Math.random() : 0; 
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number, theme: string) {
    const offsetX = (mouseX - this.width / 2) * (this.z * 0.02);
    const offsetY = (mouseY - this.height / 2) * (this.z * 0.02);

    ctx.beginPath();
    
    if (theme === "sea") {
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(144, 224, 239, ${this.alpha * 0.4})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (theme === "forest") {
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45, 206, 137, ${this.alpha})`;
      ctx.fill();
    } else if (theme === "rain") {
      ctx.moveTo(this.x + offsetX, this.y + offsetY);
      ctx.lineTo(this.x + offsetX + 1, this.y + offsetY + 15);
      ctx.strokeStyle = `rgba(255, 255, 255, ${this.alpha * 0.8})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Standard sharp stars
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
      ctx.fill();
    }
  }
}

const Starfield: React.FC<StarfieldProps> = ({ theme, performanceMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const mouseOffset = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateDimensions = (width: number, height: number) => {
      // Senior Practice: Use a safety buffer for scaled environments
      const buffer = 1.2;
      const w = Math.ceil(width * buffer);
      const h = Math.ceil(height * buffer);
      
      canvas.width = w;
      canvas.height = h;
      
      // Auto-Sense the offset of the canvas relative to its parent (the scaled body)
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect() || rect;
      
      // Store the internal pixel offset for mouse movement
      const resScaleX = canvas.width / (rect.width || 1);
      const resScaleY = canvas.height / (rect.height || 1);
      mouseOffset.current = {
        x: (parentRect.left - rect.left) * resScaleX,
        y: (parentRect.top - rect.top) * resScaleY
      };
      
      mousePos.current.targetX = w / 2;
      mousePos.current.targetY = h / 2;
      mousePos.current.x = mousePos.current.targetX;
      mousePos.current.y = mousePos.current.targetY;
      
      const numStars = Math.floor((w * h) / 1000); 
      starsRef.current = Array.from({ length: numStars }, () => new Star(w, h));
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          updateDimensions(width, height);
        }
      }
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const handleMouseMove = (e: MouseEvent) => {
      // Senior Fix: Use the auto-sensed offset to center the parallax
      mousePos.current.targetX = e.clientX + (mouseOffset.current.x / (canvas.width / canvas.clientWidth || 1));
      mousePos.current.targetY = e.clientY + (mouseOffset.current.y / (canvas.height / canvas.clientHeight || 1));
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      starsRef.current.forEach((star) => {
        if (!performanceMode) star.update(theme);
        star.draw(ctx, mousePos.current.x, mousePos.current.y, theme);
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove);
    animate();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [performanceMode, theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000 w-full h-full"
      style={{ 
        opacity: theme === "rain" ? 0.3 : 0.6,
        left: '-10%',
        top: '-10%',
        width: '120%',
        height: '120%'
      }}
    />
  );
};

export default Starfield;