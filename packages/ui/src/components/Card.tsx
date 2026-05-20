import React from 'react';
import { cn } from '../utils';

interface CardProps { children: React.ReactNode; className?: string }

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-gray-900 border border-gray-800 rounded-xl', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4 border-b border-gray-800', className)}>{children}</div>;
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4 border-t border-gray-800', className)}>{children}</div>;
}
