import ParticleEffectForHero from './particle-effect-for-hero';

interface ShaderBackgroundProps {
  isLightMode?: boolean;
}

export default function ShaderBackground({ isLightMode = false }: ShaderBackgroundProps) {
  return <ParticleEffectForHero isLightMode={isLightMode} />;
}
