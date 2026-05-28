import React from 'react';
import { cn } from '../../lib/utils';
import type { NeuralTone } from '../../theme/colors';

type GlassCardProps<T extends React.ElementType = 'div'> = {
  as?: T;
  tone?: NeuralTone;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export default function GlassCard<T extends React.ElementType = 'div'>({
  as,
  tone = 'cyan',
  interactive = true,
  className,
  children,
  ...props
}: GlassCardProps<T>) {
  const Comp = (as || 'div') as React.ElementType;
  return (
    <Comp
      className={cn('hd-glass-card', `hd-glass-card--${tone}`, interactive && 'hd-glass-card--interactive', className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
