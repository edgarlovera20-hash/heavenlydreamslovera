import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-colors',
  {
    variants: {
      variant: {
        // Colors mapped to RHDREAMSAPP2026 electric CSS vars
        cyan: '[border-color:color-mix(in_srgb,var(--electric-cyan)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-cyan)_10%,transparent)] [color:var(--electric-cyan)]',
        blue: '[border-color:color-mix(in_srgb,var(--electric-blue)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-blue)_10%,transparent)] [color:var(--electric-blue)]',
        green: '[border-color:color-mix(in_srgb,var(--electric-mint)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-mint)_10%,transparent)] [color:var(--electric-mint)]',
        purple: '[border-color:color-mix(in_srgb,var(--electric-violet)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-violet)_10%,transparent)] [color:var(--electric-violet)]',
        gold: '[border-color:color-mix(in_srgb,var(--electric-amber)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-amber)_10%,transparent)] [color:var(--electric-amber)]',
        orange: '[border-color:color-mix(in_srgb,var(--electric-orange)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-orange)_10%,transparent)] [color:var(--electric-orange)]',
        red: '[border-color:color-mix(in_srgb,var(--electric-rose)_25%,transparent)] [background-color:color-mix(in_srgb,var(--electric-rose)_10%,transparent)] [color:var(--electric-rose)]',
        slate: 'border-white/10 bg-white/5 text-slate-200',
      },
      dot: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'cyan',
      dot: false,
    },
  },
);

// Dot uses currentColor from the variant so it inherits the electric CSS var
const dotClass: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  cyan: '[background-color:var(--electric-cyan)]',
  blue: '[background-color:var(--electric-blue)]',
  green: '[background-color:var(--electric-mint)]',
  purple: '[background-color:var(--electric-violet)]',
  gold: '[background-color:var(--electric-amber)]',
  orange: '[background-color:var(--electric-orange)]',
  red: '[background-color:var(--electric-rose)]',
  slate: 'bg-slate-300',
};

export type BadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className'> &
  VariantProps<typeof badgeVariants> & {
    children?: ReactNode;
    className?: string;
  };

export function Badge({ className, variant = 'cyan', dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, dot }), className)} {...props}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full shadow-[0_0_10px_currentColor]', dotClass[variant || 'cyan'])} />}
      {children}
    </span>
  );
}
