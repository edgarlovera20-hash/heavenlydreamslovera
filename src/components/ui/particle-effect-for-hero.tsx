import { useEffect, useState } from 'react';
import LiveParticles from './live-particles';
import NeuralGrid from './neural-grid';

type ParticleEffectForHeroProps = {
  isLightMode?: boolean;
};

export default function ParticleEffectForHero({ isLightMode = false }: ParticleEffectForHeroProps) {
  const [renderParticles, setRenderParticles] = useState(false);

  useEffect(() => {
    const isReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const isMobile = window.innerWidth < 768;
    const lowConcurrency = (navigator.hardwareConcurrency || 8) <= 4;
    const lowMemory = typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory === 'number'
      && ((navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8) <= 4;

    if (isReducedMotion || isMobile || lowConcurrency || lowMemory) return;

    const start = () => setRenderParticles(true);
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(start, { timeout: 1200 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = globalThis.setTimeout(start, 700);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="aether-flow-bg hd-neural-hero-bg" data-light={isLightMode ? 'true' : 'false'} aria-hidden="true">
      <div className="aether-flow-gradient" />
      <NeuralGrid variant="hero" />
      {renderParticles && (
        <LiveParticles className="aether-flow-canvas" mode="hero" activity="thinking" density={0.5} interactive={false} showShootingStars />
      )}
      <div className="aether-flow-hologram" />
      <div className="aether-flow-vignette" />
    </div>
  );
}
