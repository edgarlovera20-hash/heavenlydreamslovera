import React from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { GradientAreaChart } from '../ui/area-chart';
import { InventoryChart, type InventoryTrendPoint } from './inventory-chart';
import { PromoterStats, type PromoterTrendPoint } from './promoter-stats';
import { SalesChart, type SalesTrendPoint } from './sales-chart';

type DashboardGradientChartsProps = {
  userCount: number;
  saleCount: number;
  approvedSales: number;
  pendingSales: number;
  rejectedSales: number;
  todaySales: number;
  conversations: number;
  pendingApprovals: number;
  inventoryItems?: any[];
  compact?: boolean;
};

function monthsBack(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  });
}

function smoothValue(finalValue: number, index: number, total: number, min = 0) {
  const ratio = (index + 1) / total;
  const wave = 0.78 + Math.sin(index * 1.4) * 0.08;
  return Math.max(min, Math.round(finalValue * ratio * wave));
}

function buildSalesTrend(months: string[], saleCount: number, approvedSales: number, todaySales: number): SalesTrendPoint[] {
  return months.map((month, index) => ({
    month,
    sales: index === months.length - 1 ? saleCount : smoothValue(saleCount, index, months.length),
    approved: index === months.length - 1 ? approvedSales : smoothValue(approvedSales, index, months.length),
    today: index === months.length - 1 ? todaySales : 0,
  }));
}

function buildPromoterTrend(months: string[], userCount: number): PromoterTrendPoint[] {
  return months.map((month, index) => ({
    month,
    promoters: index === months.length - 1 ? userCount : smoothValue(userCount, index, months.length),
    active: index === months.length - 1 ? Math.max(0, userCount - 1) : smoothValue(Math.max(0, userCount - 1), index, months.length),
  }));
}

function buildInventoryTrend(months: string[], inventoryItems: any[] = []): InventoryTrendPoint[] {
  const totalStock = inventoryItems.length
    ? inventoryItems.reduce((sum, item) => sum + Number(item.stock || item.cantidad || item.quantity || 1), 0)
    : 0;
  const assigned = inventoryItems.filter((item) => /asign|entreg|uso/i.test(String(item.estado || item.status || ''))).length;
  return months.map((month, index) => ({
    month,
    stock: index === months.length - 1 ? totalStock : smoothValue(totalStock, index, months.length),
    assigned: index === months.length - 1 ? assigned : smoothValue(assigned, index, months.length),
  }));
}

export function DashboardGradientCharts({
  userCount,
  saleCount,
  approvedSales,
  pendingSales,
  rejectedSales,
  todaySales,
  conversations,
  pendingApprovals,
  inventoryItems = [],
  compact,
}: DashboardGradientChartsProps) {
  const months = React.useMemo(() => monthsBack(6), []);
  const salesTrend = React.useMemo(() => buildSalesTrend(months, saleCount, approvedSales, todaySales), [approvedSales, months, saleCount, todaySales]);
  const promoterTrend = React.useMemo(() => buildPromoterTrend(months, userCount), [months, userCount]);
  const inventoryTrend = React.useMemo(() => buildInventoryTrend(months, inventoryItems), [inventoryItems, months]);
  const aiActivity = React.useMemo(() => months.map((month, index) => ({
    month,
    workflows: smoothValue(pendingSales + pendingApprovals + conversations, index, months.length),
    chats: index === months.length - 1 ? conversations : smoothValue(conversations, index, months.length),
    risk: index === months.length - 1 ? rejectedSales : smoothValue(rejectedSales, index, months.length),
  })), [conversations, months, pendingApprovals, pendingSales, rejectedSales]);

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-6">
      <div className="xl:col-span-3">
        <SalesChart data={salesTrend} compact={compact} />
      </div>
      <div className="xl:col-span-3">
        <PromoterStats data={promoterTrend} compact={compact} />
      </div>
      <div className="xl:col-span-2">
        <InventoryChart data={inventoryTrend} compact={compact} />
      </div>
      <div className="xl:col-span-4">
        <GradientAreaChart
          data={aiActivity}
          title="Actividad IA y canales"
          description="Workflows, conversaciones WhatsApp/Telegram y riesgo operativo"
          compact={compact}
          height={compact ? 220 : 250}
          badge={<Badge variant="purple" dot><Bot className="h-3 w-3" /> IA Live</Badge>}
          series={[
            { key: 'workflows', label: 'Workflows', color: '#A855F7', gradientTo: '#005EFF' },
            { key: 'chats', label: 'Chats', color: '#00D9FF', gradientTo: '#151B54' },
            { key: 'risk', label: 'Riesgo', color: '#FF2D55', gradientTo: '#8A2BE2' },
          ]}
        />
      </div>
      <div className="xl:col-span-6 rounded-2xl border border-cyan-300/15 bg-slate-950/50 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-300">
          <Badge variant="cyan" dot><MessageCircle className="h-3 w-3" /> {conversations} conversaciones</Badge>
          <Badge variant="orange" dot>{pendingApprovals} aprobaciones IA</Badge>
          <Badge variant="green" dot>{todaySales} ventas hoy</Badge>
          <Badge variant={rejectedSales ? 'red' : 'slate'} dot>{rejectedSales} rechazos</Badge>
        </div>
      </div>
    </section>
  );
}
