import React from 'react';
import { cn } from '../../lib/utils';

type MovingBorderProps = React.HTMLAttributes<HTMLDivElement> & {
  active?: boolean;
};

export function MovingBorder({ active = true, className, children, ...props }: MovingBorderProps) {
  return (
    <div
      {...props}
      data-avatar-active={active ? 'true' : 'false'}
      className={cn('hd-moving-border', className)}
    >
      {children}
    </div>
  );
}
