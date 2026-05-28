import { useEffect, useMemo, useRef } from 'react';
import { neuralColors } from '../../theme/colors';
import { cn } from '../../lib/utils';

export type NeuralActivity = 'idle' | 'active' | 'thinking' | 'message' | 'sale' | 'error';
export type NeuralMode = 'hero' | 'dashboard' | 'mobile';

type NodeParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  layer: number;
};

type ShootingStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  delay: number;
  length: number;
  size: number;
  color: string;
};

type NeuralEventDetail = {
  type?: NeuralActivity;
  intensity?: number;
};

type LiveParticlesProps = {
  mode?: NeuralMode;
  activity?: NeuralActivity;
  className?: string;
  density?: number;
  interactive?: boolean;
  showShootingStars?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const activityColor: Record<NeuralActivity, string> = {
  idle: '255, 255, 255',
  active: '234, 246, 255',
  thinking: '255, 255, 255',
  message: '217, 236, 255',
  sale: '223, 247, 255',
  error: '255, 214, 214',
};

const getNodeCount = (width: number, height: number, mode: NeuralMode, density: number, reducedMotion: boolean) => {
  const area = width * height;
  if (reducedMotion) return mode === 'mobile' ? 10 : 18;

  const base = mode === 'hero'
    ? area / 26000
    : mode === 'mobile'
      ? area / 43000
      : area / 36000;

  const min = mode === 'mobile' ? 16 : mode === 'hero' ? 30 : 24;
  const max = mode === 'mobile' ? 34 : mode === 'hero' ? 66 : 48;
  return clamp(Math.round(base * density), min, max);
};

const getStarCount = (width: number, height: number, mode: NeuralMode, reducedMotion: boolean) => {
  if (reducedMotion) return mode === 'hero' ? 5 : 2;
  if (mode === 'mobile') return clamp(Math.round((width * height) / 72000), 4, 9);
  if (mode === 'hero') return clamp(Math.round((width * height) / 145000), 5, 12);
  return clamp(Math.round((width * height) / 135000), 5, 14);
};

export default function LiveParticles({
  mode = 'dashboard',
  activity = 'active',
  className,
  density = 1,
  interactive = true,
  showShootingStars = true,
}: LiveParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const activityRef = useRef<NeuralActivity>(activity);
  const boostRef = useRef(0.4);
  const accentRef = useRef(activityColor[activity]);
  const modeConfig = useMemo(() => ({
    cellSize: mode === 'mobile' ? 130 : 160,
    linkLimit: mode === 'hero' ? 142 : mode === 'mobile' ? 104 : 124,
    maxLinks: mode === 'hero' ? 3 : 2,
    targetFrameMs: mode === 'mobile' ? 80 : mode === 'hero' ? 58 : 66,
  }), [mode]);

  useEffect(() => {
    activityRef.current = activity;
    accentRef.current = activityColor[activity];
    boostRef.current = Math.max(boostRef.current, activity === 'idle' ? 0.34 : activity === 'active' ? 0.48 : 1);
  }, [activity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frameId = 0;
    let lastPaint = 0;
    let lastTime = 0;
    let nodes: NodeParticle[] = [];
    let stars: ShootingStar[] = [];

    const resetStar = (star: ShootingStar, delay = true) => {
      const dir = Math.random() > 0.16 ? -1 : 1;
      const speed = (mode === 'mobile' ? 120 : 180) + Math.random() * (mode === 'hero' ? 210 : 150);
      star.x = dir < 0 ? width + 80 + Math.random() * width * 0.35 : -90 - Math.random() * width * 0.2;
      star.y = -height * 0.14 + Math.random() * height * 0.88;
      star.vx = dir * speed;
      star.vy = (mode === 'mobile' ? 46 : 64) + Math.random() * 84;
      star.life = 0;
      star.maxLife = 2.4 + Math.random() * 3.2;
      star.delay = delay ? Math.random() * 9 : Math.random() * 1.4;
      star.length = (mode === 'mobile' ? 64 : 96) + Math.random() * (mode === 'hero' ? 180 : 110);
      star.size = 0.85 + Math.random() * 1.35;
      star.color = Math.random() > 0.7 ? '255, 255, 255' : Math.random() > 0.42 ? '234, 246, 255' : '191, 216, 248';
    };

    const seed = () => {
      const nodeCount = getNodeCount(width, height, mode, density, reducedMotion);
      nodes = Array.from({ length: nodeCount }, () => {
        const layer = 0.58 + Math.random() * 1.25;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * (0.055 + layer * 0.038),
          vy: (Math.random() - 0.5) * (0.046 + layer * 0.032),
          size: 0.8 + Math.random() * 2.1 * layer,
          alpha: 0.22 + Math.random() * 0.46,
          phase: Math.random() * Math.PI * 2,
          layer,
        };
      });

      const starCount = showShootingStars ? getStarCount(width, height, mode, reducedMotion) : 0;
      stars = Array.from({ length: starCount }, () => {
        const star: ShootingStar = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 2, delay: 0, length: 130, size: 1.6, color: '0, 209, 255' };
        resetStar(star, true);
        return star;
      });
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, mode === 'mobile' ? 1.05 : 1.25);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!interactive) return;
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      pointerRef.current.active = true;
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    const onNeuralEvent = (event: Event) => {
      const detail = (event as CustomEvent<NeuralEventDetail>).detail || {};
      const eventType = detail.type || 'active';
      activityRef.current = eventType;
      accentRef.current = activityColor[eventType];
      boostRef.current = clamp(boostRef.current + (detail.intensity ?? 0.9), 0.35, 2.3);
    };

    const wrap = (node: NodeParticle) => {
      if (node.x < -32) node.x = width + 32;
      if (node.x > width + 32) node.x = -32;
      if (node.y < -32) node.y = height + 32;
      if (node.y > height + 32) node.y = -32;
    };

    const drawGridConnections = (time: number) => {
      const buckets = new Map<string, number[]>();
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const key = `${Math.floor(node.x / modeConfig.cellSize)}:${Math.floor(node.y / modeConfig.cellSize)}`;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(i);
        else buckets.set(key, [i]);
      }

      const accent = accentRef.current;
      const boost = boostRef.current;
      ctx.lineCap = 'round';
      ctx.shadowBlur = mode === 'mobile' ? 0 : 5 * boost;
      ctx.shadowColor = `rgba(${accent}, 0.28)`;

      let drawn = 0;
      const maxConnections = mode === 'mobile' ? 52 : mode === 'hero' ? 120 : 90;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const cx = Math.floor(a.x / modeConfig.cellSize);
        const cy = Math.floor(a.y / modeConfig.cellSize);
        let local = 0;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const bucket = buckets.get(`${gx}:${gy}`);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i || local >= modeConfig.maxLinks || drawn >= maxConnections) continue;
              const b = nodes[j];
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              const limit = modeConfig.linkLimit + a.layer * 18;
              const distSq = dx * dx + dy * dy;
              if (distSq > limit * limit) continue;
              const distance = Math.sqrt(distSq);
              const strength = (1 - distance / limit) * (0.16 + Math.min(boost, 1.8) * 0.12);
              const pulse = 0.76 + Math.sin(time * 1.18 + a.phase + b.phase) * 0.16;
              ctx.strokeStyle = `rgba(${accent}, ${strength * pulse})`;
              ctx.lineWidth = 0.42 + strength * 1.08;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
              local++;
              drawn++;
            }
          }
        }
      }
      ctx.shadowBlur = 0;
    };

    const drawNodes = (time: number) => {
      const accent = accentRef.current;
      const boost = boostRef.current;
      ctx.shadowColor = `rgba(${accent}, ${0.28 + Math.min(boost, 1.2) * 0.15})`;
      ctx.shadowBlur = mode === 'mobile' ? 3 : 7;
      for (const node of nodes) {
        const pulse = 0.7 + Math.sin(time * 1.35 + node.phase) * 0.22;
        const alpha = node.alpha * pulse * (0.82 + Math.min(boost, 1.4) * 0.22);
        ctx.fillStyle = `rgba(${accent}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const drawStars = (delta: number) => {
      for (const star of stars) {
        if (star.delay > 0) {
          star.delay -= delta;
          continue;
        }
        star.life += delta;
        if (!reducedMotion) {
          star.x += star.vx * delta;
          star.y += star.vy * delta;
        }
        const fade = Math.min(clamp(star.life / 0.38, 0, 1), clamp((star.maxLife - star.life) / 0.72, 0, 1));
        const angle = Math.atan2(star.vy, star.vx);
        const tailX = star.x - Math.cos(angle) * star.length;
        const tailY = star.y - Math.sin(angle) * star.length;
        const gradient = ctx.createLinearGradient(tailX, tailY, star.x, star.y);
        gradient.addColorStop(0, `rgba(${star.color}, 0)`);
        gradient.addColorStop(0.7, `rgba(${star.color}, ${fade * 0.55})`);
        gradient.addColorStop(1, `rgba(255,255,255, ${fade})`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = star.size;
        ctx.shadowBlur = 10 * fade;
        ctx.shadowColor = `rgba(${star.color}, ${fade * 0.42})`;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(star.x, star.y);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (star.x < -star.length - 100 || star.x > width + star.length + 100 || star.y > height + star.length + 120 || star.life > star.maxLife) {
          resetStar(star, true);
        }
      }
    };

    const drawPointerPulse = (time: number) => {
      const pointer = pointerRef.current;
      if (!pointer.active || mode === 'mobile') return;
      const radius = 92 + Math.sin(time * 3) * 10;
      const pulse = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
      pulse.addColorStop(0, `rgba(${accentRef.current}, 0.22)`);
      pulse.addColorStop(0.44, `rgba(${accentRef.current}, 0.08)`);
      pulse.addColorStop(1, `rgba(${accentRef.current}, 0)`);
      ctx.fillStyle = pulse;
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const animate = (now: number) => {
      if (document.hidden) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      const targetFrameMs = reducedMotion ? 90 : modeConfig.targetFrameMs;
      if (now - lastPaint < targetFrameMs) {
        frameId = requestAnimationFrame(animate);
        return;
      }

      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.06) : 0.016;
      lastTime = now;
      lastPaint = now;
      const time = now * 0.001;
      const pointer = pointerRef.current;

      boostRef.current = Math.max(activityRef.current === 'idle' ? 0.28 : 0.44, boostRef.current * 0.982);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'screen';

      for (const node of nodes) {
        if (!reducedMotion) {
          node.x += node.vx * (1 + boostRef.current * 0.16) + Math.sin(time * 0.32 + node.phase) * 0.032 * node.layer;
          node.y += node.vy * (1 + boostRef.current * 0.14) + Math.cos(time * 0.3 + node.phase) * 0.026 * node.layer;
        }

        if (pointer.active && mode !== 'mobile') {
          const dx = pointer.x - node.x;
          const dy = pointer.y - node.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 210 * 210) {
            const distance = Math.sqrt(distSq) || 1;
            const pull = (1 - distance / 210) * 0.026 * node.layer;
            node.x += dx * pull;
            node.y += dy * pull;
          }
        }

        wrap(node);
      }

      drawGridConnections(time);
      drawNodes(time);
      drawStars(delta);
      drawPointerPulse(time);
      ctx.globalCompositeOperation = 'source-over';
      frameId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    if (interactive && mode !== 'mobile') {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave);
    }
    window.addEventListener('hd-neural-activity', onNeuralEvent as EventListener);
    window.addEventListener('hd-sale-created', onNeuralEvent as EventListener);
    window.addEventListener('hd-message-received', onNeuralEvent as EventListener);
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      if (interactive && mode !== 'mobile') {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerleave', onPointerLeave);
      }
      window.removeEventListener('hd-neural-activity', onNeuralEvent as EventListener);
      window.removeEventListener('hd-sale-created', onNeuralEvent as EventListener);
      window.removeEventListener('hd-message-received', onNeuralEvent as EventListener);
    };
  }, [density, interactive, mode, modeConfig.cellSize, modeConfig.linkLimit, modeConfig.maxLinks, modeConfig.targetFrameMs, showShootingStars]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('hd-live-particles', className)}
      data-mode={mode}
      data-accent={neuralColors.cyan}
      aria-hidden="true"
    />
  );
}
