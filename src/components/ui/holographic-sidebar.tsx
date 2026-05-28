import React from 'react';
import { cn } from '../../lib/utils';

type HolographicSidebarProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export default function HolographicSidebar({ children, className, ...props }: HolographicSidebarProps) {
  return (
    <aside className={cn('hd-holographic-sidebar', className)} {...props}>
      {children}
    </aside>
  );
}
