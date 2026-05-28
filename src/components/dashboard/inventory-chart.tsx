import { Badge } from '../ui/badge';
import { GradientAreaChart } from '../ui/area-chart';

export type InventoryTrendPoint = {
  month: string;
  stock: number;
  assigned?: number;
};

type InventoryChartProps = {
  data: InventoryTrendPoint[];
  title?: string;
  description?: string;
  compact?: boolean;
};

export function InventoryChart({
  data,
  title = 'Inventario operativo',
  description = 'Stock, asignaciones y capacidad de campo',
  compact,
}: InventoryChartProps) {
  return (
    <GradientAreaChart
      data={data}
      title={title}
      description={description}
      compact={compact}
      badge={<Badge variant="orange" dot>Inventario</Badge>}
      series={[
        { key: 'stock', label: 'Stock', color: '#FF8A1F', gradientTo: '#FACC15' },
        { key: 'assigned', label: 'Asignado', color: '#A855F7', gradientTo: '#005EFF' },
      ]}
    />
  );
}
