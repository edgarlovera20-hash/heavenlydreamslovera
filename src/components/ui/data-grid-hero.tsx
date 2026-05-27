import React, { useEffect, useRef } from 'react';

type AnimationType = 'pulse' | 'wave' | 'random';

type DataGridHeroProps = {
  rows: number;
  cols: number;
  spacing: number;
  duration: number;
  color: string;
  animationType: AnimationType;
  pulseEffect: boolean;
  mouseGlow: boolean;
  opacityMin: number;
  opacityMax: number;
  background: string;
  className?: string;
  contentClassName?: string;
  children?: React.ReactNode;
};

export default function DataGridHero({
  rows,
  cols,
  spacing,
  duration,
  color,
  animationType,
  pulseEffect,
  mouseGlow,
  opacityMin,
  opacityMax,
  background,
  className = '',
  contentClassName = '',
  children,
}: DataGridHeroProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    container.style.gap = `${spacing}px`;
    container.style.setProperty('--mouse-glow-opacity', mouseGlow ? '1' : '0');

    const total = rows * cols;
    const centerRow = Math.floor(rows / 2);
    const centerCol = Math.floor(cols / 2);

    for (let i = 0; i < total; i += 1) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.style.backgroundColor = color;
      cell.style.setProperty('--opacity-min', String(opacityMin));
      cell.style.setProperty('--opacity-max', String(opacityMax));
      cell.style.setProperty('--cell-shift-x', `${((Math.random() - 0.5) * 18).toFixed(2)}px`);
      cell.style.setProperty('--cell-shift-y', `${((Math.random() - 0.5) * 18).toFixed(2)}px`);
      cell.style.setProperty('--cell-hue', `${Math.round(Math.random() * 54 - 18)}deg`);
      cell.style.setProperty('--cell-scale', `${(1 + Math.random() * 0.18).toFixed(2)}`);

      if (pulseEffect) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        let delay = 0;

        if (animationType === 'wave') {
          delay = (r + c) * 0.1;
        } else if (animationType === 'random') {
          delay = Math.random() * duration;
        } else {
          const dr = Math.abs(r - centerRow);
          const dc = Math.abs(c - centerCol);
          delay = Math.sqrt(dr * dr + dc * dc) * 0.2;
        }

        cell.style.animation = `cell-pulse ${duration}s ease-in-out infinite alternate, cell-drift ${duration * 2.15}s ease-in-out infinite alternate, cell-blue-shift ${duration * 1.45}s ease-in-out infinite alternate`;
        cell.style.animationDelay = `${delay.toFixed(3)}s`;
      }

      container.appendChild(cell);
    }
  }, [
    rows,
    cols,
    spacing,
    color,
    animationType,
    pulseEffect,
    duration,
    opacityMin,
    opacityMax,
    mouseGlow,
  ]);

  useEffect(() => {
    const container = gridRef.current;
    if (!mouseGlow || !container) return;

    const handler = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      container.style.setProperty('--mouse-x', `${x}px`);
      container.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [mouseGlow]);

  return (
    <div className={`data-grid-hero ${className}`} style={{ background }}>
      <div ref={gridRef} className="grid-container" aria-hidden="true" />
      <div className={`hero-content ${contentClassName}`} role="region" aria-label="Contenido de modulo">
        {children}
      </div>
    </div>
  );
}
