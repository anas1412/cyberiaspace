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

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < -20) this.x = this.width + 20;
    if (this.x > this.width + 20) this.x = -20;
    if (this.y < -20) this.y = this.height + 20;
    if (this.y > this.height + 20) this.y = -20;

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
      ctx.strokeStyle = `rgba(214, 211, 209, ${this.alpha * 0.3})`;
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
      
      const numStars = Math.floor((canvas.width * canvas.height) / 1200); // Increased density
      starsRef.current = Array.from({ length: numStars }, () => new Star(canvas.width, canvas.height));
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.targetX = e.clientX;
      mousePos.current.targetY = e.clientY;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05;

      starsRef.current.forEach((star) => {
        if (!performanceMode) star.update();
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
      style={{ opacity: theme === "rain" ? 0.3 : 0.6 }}
    />
  );
};

export default Starfield;