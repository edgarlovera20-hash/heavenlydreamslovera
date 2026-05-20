import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(companyId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [totalVentas, ventasHoy, pendientes, instaladas, ingresos] =
      await Promise.all([
        this.prisma.sale.count({ where: { companyId } }),
        this.prisma.sale.count({
          where: { companyId, createdAt: { gte: startOfDay } },
        }),
        this.prisma.sale.count({
          where: { companyId, status: SaleStatus.PENDIENTE },
        }),
        this.prisma.sale.count({
          where: { companyId, status: SaleStatus.INSTALADA },
        }),
        this.prisma.sale.aggregate({
          where: { companyId },
          _sum: { rentaMensual: true },
        }),
      ]);

    return {
      totalVentas,
      ventasHoy,
      pendientes,
      instaladas,
      totalIngresos: ingresos._sum.rentaMensual ?? 0,
    };
  }
}
