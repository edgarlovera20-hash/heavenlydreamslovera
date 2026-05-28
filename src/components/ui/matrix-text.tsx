import React from 'react';
import { cn } from '../../lib/utils';

interface MatrixTextProps {
  text?: string;
  className?: string;
  initialDelay?: number;
  letterAnimationDuration?: number;
  letterInterval?: number;
}

export const MatrixText = React.memo(function MatrixText({
  text = 'HelloWorld!',
  className,
}: MatrixTextProps) {
  return (
    <span
      className={cn('hd-matrix-text inline-block text-white', className)}
      aria-label={text}
    >
      {text}
    </span>
  );
});
