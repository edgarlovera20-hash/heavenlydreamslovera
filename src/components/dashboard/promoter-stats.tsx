import { Badge } from '../ui/badge';
import { GradientAreaChart } from '../ui/area-chart';

export type PromoterTrendPoint = {
  month: string;
  promoters: number;
  active?: number;
};

type PromoterStatsProps = {
  data: PromoterTrendPoint[];
  title?: string;
  description?: string;
  compact?: boolean;
};

export function PromoterStats({
  data,
  title = 'Promotores activos',
  description = 'Crecimiento y actividad del equipo comercial',
  compact,
}: PromoterStatsProps) {
  return (
    <GradientAreaChart
      data={data}
      title={title}
      description={description}
      compact={compact}
      badge={<Badge variant="cyan" dot>Equipo</Badge>}
      series={[
        { key: 'promoters', label: 'Promotores', color: '#00D9FF', gradientTo: '#005EFF' },
        { key: 'active', label: 'Activos', color: '#7DF9FF', gradientTo: '#151B54' },
      ]}
    />
  );
}
