import React from 'react';
import { cn } from '../../lib/utils';

type Tone = 'cyan' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';

const toneStyles: Record<Tone, { text: string; soft: string; border: string; solid: string; dot: string }> = {
  cyan: {
    text: 'text-cyan-300',
    soft: 'bg-cyan-400/10',
    border: 'border-cyan-300/25',
    solid: 'bg-cyan-300 text-slate-950',
    dot: 'bg-cyan-300',
  },
  blue: {
    text: 'text-sky-300',
    soft: 'bg-sky-400/10',
    border: 'border-sky-300/25',
    solid: 'bg-sky-400 text-slate-950',
    dot: 'bg-sky-300',
  },
  emerald: {
    text: 'text-emerald-300',
    soft: 'bg-emerald-400/10',
    border: 'border-emerald-300/25',
    solid: 'bg-emerald-300 text-slate-950',
    dot: 'bg-emerald-300',
  },
  amber: {
    text: 'text-amber-300',
    soft: 'bg-amber-400/10',
    border: 'border-amber-300/25',
    solid: 'bg-amber-300 text-slate-950',
    dot: 'bg-amber-300',
  },
  rose: {
    text: 'text-rose-300',
    soft: 'bg-rose-400/10',
    border: 'border-rose-300/25',
    solid: 'bg-rose-400 text-white',
    dot: 'bg-rose-300',
  },
  purple: {
    text: 'text-violet-300',
    soft: 'bg-violet-400/10',
    border: 'border-violet-300/25',
    solid: 'bg-violet-400 text-white',
    dot: 'bg-violet-300',
  },
  slate: {
    text: 'text-slate-300',
    soft: 'bg-white/5',
    border: 'border-white/10',
    solid: 'bg-slate-200 text-slate-950',
    dot: 'bg-slate-300',
  },
};

export function PremiumPanel({
  children,
  className,
  as: Comp = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return <Comp className={cn('hd-panel', className)}>{children}</Comp>;
}

export function PremiumCard({
  children,
  className,
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return <div className={cn('hd-card', interactive && 'hd-card-interactive', className)}>{children}</div>;
}

export function PremiumButton({
  children,
  className,
  tone = 'cyan',
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const toneClass = toneStyles[tone];
  return (
    <button
      className={cn(
        'hd-button',
        variant === 'primary' && toneClass.solid,
        variant === 'secondary' && ['border', toneClass.border, toneClass.soft, toneClass.text],
        variant === 'ghost' && ['border border-transparent bg-transparent', toneClass.text, 'hover:bg-white/5'],
        variant === 'danger' && 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PremiumBadge({
  children,
  tone = 'cyan',
  className,
  dot = false,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  const toneClass = toneStyles[tone];
  return (
    <span className={cn('hd-badge', toneClass.soft, toneClass.border, toneClass.text, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', toneClass.dot)} />}
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="hd-eyebrow">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function PremiumKpiCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'cyan',
}: {
  title: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ElementType;
  tone?: Tone;
}) {
  const toneClass = toneStyles[tone];
  return (
    <PremiumCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', toneClass.soft, toneClass.border, toneClass.text)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {detail && <p className={cn('mt-4 text-xs font-semibold', toneClass.text)}>{detail}</p>}
    </PremiumCard>
  );
}
