import React from 'react';
import { cn } from '../lib/utils';
import NeuralLayout from './neural-layout';
import type { NeuralActivity } from '../components/ui/live-particles';

type DashboardLayoutProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  activity?: NeuralActivity;
};

export default function DashboardLayout({
  children,
  className,
  contentClassName,
  activity = 'active',
}: DashboardLayoutProps) {
  return (
    <NeuralLayout
      mode="dashboard"
      activity={activity}
      interactive={false}
      showParticles={false}
      showShootingStars={false}
      className={cn('hd-dashboard-layout', className)}
      contentClassName={cn('flex min-h-0 flex-1 flex-col', contentClassName)}
    >
      {children}
    </NeuralLayout>
  );
}
