import React from 'react';
import { cn } from '../lib/utils';
import LiveParticles, { type NeuralActivity, type NeuralMode } from '../components/ui/live-particles';
import AetherFlowBackground from '../components/ui/aether-flow-background';

type NeuralLayoutProps = {
  children: React.ReactNode;
  mode?: NeuralMode;
  activity?: NeuralActivity;
  className?: string;
  contentClassName?: string;
  interactive?: boolean;
  showParticles?: boolean;
  showShootingStars?: boolean;
};

export default function NeuralLayout({
  children,
  mode = 'dashboard',
  activity = 'active',
  className,
  contentClassName,
  interactive = true,
  showParticles = false,
  showShootingStars = true,
}: NeuralLayoutProps) {
  return (
    <div className={cn('hd-neural-layout', `hd-neural-layout--${mode}`, className)}>
      <div className="hd-neural-gradient" aria-hidden="true" />
      <AetherFlowBackground
        className="z-[1]"
        density={mode === 'mobile' ? 0.58 : 0.82}
        interactive={interactive}
      />
      {showParticles && (
        <LiveParticles mode={mode} activity={activity} interactive={interactive} showShootingStars={showShootingStars} />
      )}
      <div className="hd-neural-orbs" aria-hidden="true" />
      <div className={cn('hd-neural-content', contentClassName)}>{children}</div>
    </div>
  );
}
