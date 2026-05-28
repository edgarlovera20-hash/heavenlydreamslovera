import { cn } from '../../lib/utils';

type NeuralGridProps = {
  variant?: 'hero' | 'dashboard' | 'mobile';
  className?: string;
};

export default function NeuralGrid({ variant = 'dashboard', className }: NeuralGridProps) {
  return <div className={cn('hd-neural-grid', `hd-neural-grid--${variant}`, className)} aria-hidden="true" />;
}
