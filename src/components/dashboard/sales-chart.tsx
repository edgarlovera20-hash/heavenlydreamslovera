import { Badge } from '../ui/badge';
import { GradientAreaChart } from '../ui/area-chart';

export type SalesTrendPoint = {
  month: string;
  sales: number;
  approved?: number;
};

type SalesChartProps = {
  data: SalesTrendPoint[];
  title?: string;
  description?: string;
  compact?: boolean;
};

export function SalesChart({
  data,
  title = 'Ventas y aprobaciones',
  description = 'Tendencia operativa del periodo actual',
  compact,
}: SalesChartProps) {
  return (
    <GradientAreaChart
      data={data}
      title={title}
      description={description}
      compact={compact}
      badge={<Badge variant="green" dot>Ventas</Badge>}
      series={[
        { key: 'sales', label: 'Ventas', color: '#00FF85', gradientTo: '#005EFF' },
        { key: 'approved', label: 'Aprobadas', color: '#00D9FF', gradientTo: '#0041C2' },
      ]}
    />
  );
}
