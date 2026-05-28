import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

type AetherNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

type AetherFlowBackgroundProps = {
  className?: string;
  density?: number;
  interactive?: boolean;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function AetherFlowBackground({
  className,
  density = 1,
  interactive = true,
}: AetherFlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let nodes: AetherNode[] = [];
    let width = 0;
    let height = 0;
    const reduceMotion = prefersReducedMotion();
    const mouse = { x: -9999, y: -9999, active: false };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const base = width < 768 ? 34 : width < 1200 ? 58 : 82;
      const count = reduceMotion ? Math.round(base * 0.35) : Math.round(base * density);
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (width < 768 ? 0.16 : 0.24),
        vy: (Math.random() - 0.5) * (width < 768 ? 0.16 : 0.24),
        size: 1.2 + Math.random() * 2.2,
        alpha: 0.34 + Math.random() * 0.46,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const node of nodes) {
        if (!reduceMotion) {
          node.x += node.vx;
          node.y += node.vy;
        }

        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;

        if (interactive && mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && dist < 170) {
            const push = (170 - dist) / 170;
            node.x += (dx / dist) * push * 0.85;
            node.y += (dy / dist) * push * 0.85;
          }
        }
      }

      const maxDistance = width < 768 ? 128 : 178;
      const maxDistanceSq = maxDistance * maxDistance;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > maxDistanceSq) continue;

          const opacity = (1 - distSq / maxDistanceSq) * 0.58;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineWidth = width < 768 ? 0.9 : 1.15;
          ctx.strokeStyle = `rgba(214, 241, 255, ${opacity})`;
          ctx.shadowBlur = 9;
          ctx.shadowColor = 'rgba(0, 194, 255, 0.42)';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      for (const node of nodes) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235, 250, 255, ${node.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(125, 249, 255, 0.42)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      raf = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.active = true;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [density, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('hd-aether-flow-bg pointer-events-none absolute inset-0 h-full w-full', className)}
      aria-hidden="true"
    />
  );
}
