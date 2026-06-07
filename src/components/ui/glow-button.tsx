import React from 'react';
import { cn } from '../../lib/utils';

type HdButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function HdButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: HdButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-md border transition-all duration-200',
        'hover:-translate-y-px active:translate-y-px active:scale-[0.995]',
        // size
        size === 'sm' && 'px-3 py-1.5 text-sm gap-1.5',
        size === 'md' && 'px-4 py-2 text-sm gap-2',
        size === 'lg' && 'px-6 py-3 text-base gap-2.5',
        // variant
        variant === 'primary' && [
          'bg-[var(--electric-cyan)] text-black border-[var(--electric-cyan)]',
          'hover:bg-[color-mix(in_srgb,var(--electric-cyan)_85%,white)] hover:shadow-[0_0_18px_rgba(34,211,238,0.42)]',
        ],
        variant === 'secondary' && [
          'bg-[rgba(34,211,238,0.10)] text-[var(--electric-cyan)] border-[rgba(34,211,238,0.32)]',
          'hover:bg-[rgba(34,211,238,0.18)] hover:border-[rgba(34,211,238,0.52)] hover:shadow-[0_0_14px_rgba(34,211,238,0.22)]',
        ],
        variant === 'ghost' && [
          'bg-transparent text-[rgba(255,255,255,0.72)] border-transparent',
          'hover:bg-[rgba(255,255,255,0.06)] hover:text-white',
        ],
        variant === 'danger' && [
          'bg-[rgba(251,113,133,0.12)] text-[var(--electric-rose)] border-[rgba(251,113,133,0.32)]',
          'hover:bg-[rgba(251,113,133,0.22)] hover:border-[rgba(251,113,133,0.52)] hover:shadow-[0_0_14px_rgba(251,113,133,0.22)]',
        ],
        props.disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Backward-compat alias
export default HdButton;
export { HdButton as GlowButton };
