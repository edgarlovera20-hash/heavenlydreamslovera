import React from 'react';
import { cn } from '../../lib/utils';
import type { NeuralTone } from '../../theme/colors';

type GlowButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: NeuralTone;
  variant?: 'solid' | 'ghost' | 'outline';
};

export default function GlowButton({
  tone = 'cyan',
  variant = 'solid',
  className,
  children,
  ...props
}: GlowButtonProps) {
  return (
    <button
      className={cn('hd-glow-button', `hd-glow-button--${tone}`, `hd-glow-button--${variant}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}
