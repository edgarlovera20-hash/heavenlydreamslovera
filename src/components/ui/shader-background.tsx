import { useEffect, useRef } from 'react';

interface ShaderBackgroundProps {
  isLightMode?: boolean;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  phase: number;
  layer: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ShaderBackground = ({ isLightMode = false }: ShaderBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frameId = 0;
    let particles: Particle[] = [];

    const createParticles = () => {
      const area = width * height;
      const count = reducedMotion ? 72 : clamp(Math.round(area / 10500), 130, 220);

      particles = Array.from({ length: count }, () => {
        const layer = 0.45 + Math.random() * 1.3;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * (0.16 + layer * 0.1),
          vy: (Math.random() - 0.5) * (0.12 + layer * 0.08),
          size: 0.75 + Math.random() * 2.6 * layer,
          baseAlpha: 0.25 + Math.random() * 0.52,
          phase: Math.random() * Math.PI * 2,
          layer,
        };
      });
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      createParticles();
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, active: true };
    };

    const handlePointerLeave = () => {
      pointerRef.current.active = false;
    };

    const drawAmbientLight = (time: number) => {
      const leftGlow = ctx.createRadialGradient(
        width * (0.18 + Math.sin(time * 0.18) * 0.04),
        height * 0.22,
        0,
        width * 0.18,
        height * 0.22,
        width * 0.72,
      );
      leftGlow.addColorStop(0, 'rgba(0, 229, 255, 0.18)');
      leftGlow.addColorStop(0.42, 'rgba(31, 81, 255, 0.12)');
      leftGlow.addColorStop(1, 'rgba(21, 27, 84, 0)');

      const rightGlow = ctx.createRadialGradient(
        width * 0.82,
        height * (0.32 + Math.cos(time * 0.16) * 0.04),
        0,
        width * 0.82,
        height * 0.32,
        width * 0.68,
      );
      rightGlow.addColorStop(0, 'rgba(123, 97, 255, 0.18)');
      rightGlow.addColorStop(0.48, 'rgba(0, 65, 194, 0.1)');
      rightGlow.addColorStop(1, 'rgba(21, 27, 84, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = leftGlow;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = rightGlow;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    };

    const drawPointerRipple = (time: number) => {
      const pointer = pointerRef.current;
      if (!pointer.active) return;

      const radius = 86 + Math.sin(time * 4.2) * 12;
      const ripple = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
      ripple.addColorStop(0, 'rgba(125, 249, 255, 0.28)');
      ripple.addColorStop(0.38, 'rgba(0, 229, 255, 0.12)');
      ripple.addColorStop(0.72, 'rgba(123, 97, 255, 0.05)');
      ripple.addColorStop(1, 'rgba(0, 0, 255, 0)');

      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = ripple;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    };

    const animate = (now: number) => {
      const time = now * 0.001;
      ctx.clearRect(0, 0, width, height);
      drawAmbientLight(time);

      const pointer = pointerRef.current;
      for (const particle of particles) {
        if (!reducedMotion) {
          particle.x += particle.vx + Math.sin(time * 0.72 + particle.phase) * 0.075 * particle.layer;
          particle.y += particle.vy + Math.cos(time * 0.64 + particle.phase) * 0.058 * particle.layer;
        }

        if (pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 210) {
            const pull = (1 - distance / 210) * 0.016 * particle.layer;
            particle.x += dx * pull;
            particle.y += dy * pull;
          }
        }

        if (particle.x < -30) particle.x = width + 30;
        if (particle.x > width + 30) particle.x = -30;
        if (particle.y < -30) particle.y = height + 30;
        if (particle.y > height + 30) particle.y = -30;
      }

      ctx.globalCompositeOperation = 'screen';
      ctx.lineCap = 'round';
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const linkDistance = 118 + a.layer * 34;

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > linkDistance) continue;

          const strength = (1 - distance / linkDistance) * 0.52;
          const pulse = 0.68 + Math.sin(time * 2.2 + a.phase + b.phase) * 0.22;
          ctx.strokeStyle = `rgba(120, 170, 255, ${strength * pulse})`;
          ctx.lineWidth = 0.55 + strength * 1.6;
          ctx.shadowColor = 'rgba(0, 229, 255, 0.55)';
          ctx.shadowBlur = 8 + strength * 12;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }

        if (pointer.active) {
          const dx = pointer.x - a.x;
          const dy = pointer.y - a.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 250) {
            const strength = (1 - distance / 250) * 0.86;
            ctx.strokeStyle = `rgba(0, 229, 255, ${strength * 0.46})`;
            ctx.lineWidth = 0.8 + strength * 1.9;
            ctx.shadowColor = 'rgba(125, 249, 255, 0.9)';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      for (const particle of particles) {
        const pulse = 0.68 + Math.sin(time * 2.6 + particle.phase) * 0.32;
        const alpha = particle.baseAlpha * pulse;
        ctx.shadowColor = 'rgba(125, 249, 255, 0.86)';
        ctx.shadowBlur = 10 + particle.layer * 8;
        ctx.fillStyle = `rgba(125, 249, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        if (particle.layer > 1.35) {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.58})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 0.36, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      drawPointerRipple(time);
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      frameId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div className="aether-flow-bg" data-light={isLightMode ? 'true' : 'false'} aria-hidden="true">
      <div className="aether-flow-gradient" />
      <canvas ref={canvasRef} className="aether-flow-canvas" />
      <div className="aether-flow-hologram" />
      <div className="aether-flow-vignette" />
    </div>
  );
};

export default ShaderBackground;
