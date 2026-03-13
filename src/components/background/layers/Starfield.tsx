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
    this.baseRadius = (Math.random() * 0.6 + 0.1) * (this.z * 0.4);
    this.vx = (Math.random() - 0.5) * 0.03; 
    this.vy = (Math.random() - 0.5) * 0.03;
    this.alpha = Math.random() * 0.6; // Lower initial alpha
    this.targetAlpha = Math.random() > 0.6 ? Math.random() * 0.5 : 0; 
    this.twinkleSpeed = Math.random() * 0.003 + 0.001;
  }

  update(theme: string) {
    if (theme === "rain") {
      this.y += 15 + this.z * 5; // Rain fall speed
      this.x += 2; // Slight wind
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }

    if (this.x < -50) this.x = this.width + 50;
    if (this.x > this.width + 50) this.x = -50;
    if (this.y < -50) this.y = this.height + 50;
    if (this.y > this.height + 50) this.y = -50;

    if (theme !== "rain") {
      if (this.alpha < this.targetAlpha) {
        this.alpha += this.twinkleSpeed;
        if (this.alpha >= this.targetAlpha) {
          this.alpha = this.targetAlpha;
          this.targetAlpha = Math.random() > 0.3 ? Math.random() * 0.5 : 0; 
        }
      } else {
        this.alpha -= this.twinkleSpeed;
        if (this.alpha <= this.targetAlpha) {
          this.alpha = this.targetAlpha;
          this.targetAlpha = Math.random() > 0.3 ? Math.random() * 0.5 : 0; 
        }
      }
    } else {
      this.alpha = 0.3; // Static alpha for rain
    }
  }

  draw(ctx: CanvasRenderingContext2D, mouseX: number, mouseY: number, theme: string) {
    const parallaxFactor = theme === "rain" ? 0.005 : 0.015;
    const offsetX = (mouseX - this.width / 2) * (this.z * parallaxFactor);
    const offsetY = (mouseY - this.height / 2) * (this.z * parallaxFactor);

    ctx.beginPath();
    
    if (theme === "sea") {
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius * 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(144, 224, 239, ${this.alpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (theme === "forest") {
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(45, 206, 137, ${this.alpha * 0.6})`;
      ctx.fill();
    } else if (theme === "rain") {
      ctx.moveTo(this.x + offsetX, this.y + offsetY);
      ctx.lineTo(this.x + offsetX + 1, this.y + offsetY + 25);
      ctx.strokeStyle = `rgba(214, 211, 209, ${this.alpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      // Standard sharp stars
      ctx.arc(this.x + offsetX, this.y + offsetY, this.baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + this.alpha * 0.8})`;
      ctx.fill();
    }
  }
}

const Starfield: React.FC<StarfieldProps> = ({ theme, performanceMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const requestRef = useRef<number>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      mousePos.current.targetX = canvas.width / 2;
      mousePos.current.targetY = canvas.height / 2;
      mousePos.current.x = mousePos.current.targetX;
      mousePos.current.y = mousePos.current.targetY;
      
      const divisor = theme === "rain" ? 3000 : 4000; // Significantly lower density for stars
      const numStars = Math.floor((canvas.width * canvas.height) / divisor); 
      starsRef.current = Array.from({ length: numStars }, () => new Star(canvas.width, canvas.height));
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.targetX = e.clientX;
      mousePos.current.targetY = e.clientY;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Smoothly interpolate mouse for parallax
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      starsRef.current.forEach((star) => {
        if (!performanceMode) star.update(theme);
        star.draw(ctx, mousePos.current.x, mousePos.current.y, theme);
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    resize();
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [performanceMode, theme]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none transition-opacity duration-1000"
      style={{ opacity: theme === "rain" ? 0.5 : 1.0 }}
    />
  );
};

export default Starfield;