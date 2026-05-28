import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] transition-colors',
  {
    variants: {
      variant: {
        cyan: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-200',
        blue: 'border-blue-300/25 bg-blue-400/10 text-blue-200',
        green: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
        purple: 'border-violet-300/25 bg-violet-400/10 text-violet-200',
        gold: 'border-yellow-300/25 bg-yellow-400/10 text-yellow-200',
        orange: 'border-orange-300/25 bg-orange-400/10 text-orange-200',
        red: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
        slate: 'border-white/10 bg-white/6 text-slate-200',
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

const dotClass: Record<NonNullable<VariantProps<typeof badgeVariants>['variant']>, string> = {
  cyan: 'bg-cyan-300',
  blue: 'bg-blue-300',
  green: 'bg-emerald-300',
  purple: 'bg-violet-300',
  gold: 'bg-yellow-300',
  orange: 'bg-orange-300',
  red: 'bg-rose-300',
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
