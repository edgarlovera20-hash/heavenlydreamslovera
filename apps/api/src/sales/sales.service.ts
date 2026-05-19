import { Injectable, NotFoundException } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    companyId: string,
    filters?: { status?: SaleStatus; asesorId?: string },
  ) {
    return this.prisma.sale.findMany({
      where: {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.asesorId && { asesorId: filters.asesorId }),
      },
      include: {
        asesor: {
          select: { id: true, nombre: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, companyId },
      include: {
        asesor: {
          select: { id: true, nombre: true, username: true, role: true },
        },
        documents: true,
        fraudFlags: { where: { resolved: false } },
      },
    });
    if (!sale) throw new NotFoundException(`Venta ${id} no encontrada`);
    return sale;
  }

  async create(dto: CreateSaleDto, user: { id: string; companyId: string }) {
    return this.prisma.sale.create({
      data: {
        ...dto,
        asesorId: user.id,
        companyId: user.companyId,
      },
      include: {
        asesor: {
          select: { id: true, nombre: true, username: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateSaleDto, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.sale.update({
      where: { id },
      data: dto,
    });
  }

  async updateStatus(id: string, status: SaleStatus, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.sale.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async getStats(companyId: string) {
    const [total, byStatus] = await Promise.all([
      this.prisma.sale.count({ where: { companyId } }),
      this.prisma.sale.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.values(SaleStatus).reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<SaleStatus, number>,
    );

    byStatus.forEach((row) => {
      statusCounts[row.status] = row._count._all;
    });

    return { total, byStatus: statusCounts };
  }

  async delete(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.sale.delete({ where: { id } });
  }
}
