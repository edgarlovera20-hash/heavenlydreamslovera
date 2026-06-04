"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";

type AetherFlowHeroProps = {
  mode?: "full" | "background";
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export default function AetherFlowHero({
  mode = "full",
  eyebrow = "Heavenly Dreams Dynamic Rendering Engine",
  title = "Tu Dream Team comienza aqui",
  description = "Una experiencia digital viva para reclutamiento, operacion y seguimiento de talento en tiempo real.",
  ctaLabel = "Explorar plataforma",
  onCtaClick,
  className,
}: AetherFlowHeroProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let particles: Particle[] = [];
    const mouse: { x: number | null; y: number | null; radius: number } = { x: null, y: null, radius: 200 };

    class Particle {
      x: number;
      y: number;
      directionX: number;
      directionY: number;
      size: number;
      color: string;

      constructor(x: number, y: number, directionX: number, directionY: number, size: number, color: string) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
      }

      update() {
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;

        if (mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          if (distance < mouse.radius + this.size) {
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const force = (mouse.radius - distance) / mouse.radius;
            this.x -= forceDirectionX * force * 5;
            this.y -= forceDirectionY * force * 5;
          }
        }

        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    function init() {
      particles = [];
      const numberOfParticles = Math.min(160, Math.max(42, (canvas.height * canvas.width) / 11000));
      for (let i = 0; i < numberOfParticles; i += 1) {
        const size = Math.random() * 2 + 1;
        const x = Math.random() * (canvas.width - size * 4) + size * 2;
        const y = Math.random() * (canvas.height - size * 4) + size * 2;
        const directionX = Math.random() * 0.4 - 0.2;
        const directionY = Math.random() * 0.4 - 0.2;
        particles.push(new Particle(x, y, directionX, directionY, size, "rgba(73, 215, 255, 0.82)"));
      }
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent?.clientWidth || window.innerWidth;
      canvas.height = parent?.clientHeight || window.innerHeight;
      init();
    };

    const connect = () => {
      for (let a = 0; a < particles.length; a += 1) {
        for (let b = a; b < particles.length; b += 1) {
          const distance =
            (particles[a].x - particles[b].x) * (particles[a].x - particles[b].x) +
            (particles[a].y - particles[b].y) * (particles[a].y - particles[b].y);

          if (distance < (canvas.width / 7) * (canvas.height / 7)) {
            const opacityValue = Math.max(0, 1 - distance / 20000);
            const dxMouse = mouse.x === null ? Number.POSITIVE_INFINITY : particles[a].x - mouse.x;
            const dyMouse = mouse.y === null ? Number.POSITIVE_INFINITY : particles[a].y - mouse.y;
            const mouseDistance = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
            ctx.strokeStyle =
              mouse.x !== null && mouseDistance < mouse.radius
                ? `rgba(255, 255, 255, ${opacityValue})`
                : `rgba(47, 140, 255, ${opacityValue})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      ctx.fillStyle = "rgba(0, 0, 0, 0.92)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.forEach((particle) => particle.update());
      connect();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseout", handleMouseOut);
    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const fadeUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.2 + 0.5,
        duration: 0.8,
        ease: "easeInOut" as const,
      },
    }),
  };

  return (
    <div
      className={cn(
        "relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black",
        mode === "background" && "pointer-events-none absolute inset-0 h-full",
        className,
      )}
      aria-hidden={mode === "background"}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,140,255,0.22),transparent_34%),radial-gradient(circle_at_78%_22%,rgba(255,138,61,0.14),transparent_30%),linear-gradient(90deg,rgba(0,0,0,0.62),rgba(0,0,0,0.28),rgba(0,0,0,0.74))]" />

      {mode === "full" && (
        <div className="relative z-10 max-w-4xl px-6 text-center">
          <motion.div
            custom={0}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 backdrop-blur-sm"
          >
            <Zap className="h-4 w-4 text-cyan-300" />
            <span className="text-sm font-medium text-gray-200">{eyebrow}</span>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-8xl"
          >
            {title}
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUpVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-gray-300"
          >
            {description}
          </motion.p>

          <motion.div custom={3} variants={fadeUpVariants} initial="hidden" animate="visible">
            <button
              type="button"
              onClick={onCtaClick}
              className="mx-auto flex items-center gap-2 rounded-lg bg-white px-8 py-4 font-semibold text-black shadow-lg transition-colors duration-300 hover:bg-gray-200"
            >
              {ctaLabel}
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
