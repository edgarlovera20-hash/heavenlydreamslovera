import React from 'react';
import { cn } from '../../lib/utils';

type FloatingPanelsProps = {
  children: React.ReactNode;
  className?: string;
};

export default function FloatingPanels({ children, className }: FloatingPanelsProps) {
  return <div className={cn('hd-floating-panels', className)}>{children}</div>;
}
