import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCsCase } from './dto/create-case.dto';
import { ResolveCsCase } from './dto/resolve-case.dto';

@Injectable()
export class CustomerSuccessService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, filters?: { status?: string; type?: string }) {
    return this.prisma.customerSuccessCase.findMany({
      where: {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.type && { type: filters.type }),
      },
      include: {
        customer: { select: { id: true, nombre: true, telefono: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const caseRecord = await this.prisma.customerSuccessCase.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, nombre: true, telefono: true, email: true } },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Customer success case ${id} not found`);
    }

    return caseRecord;
  }

  create(dto: CreateCsCase, companyId: string) {
    return this.prisma.customerSuccessCase.create({
      data: {
        ...dto,
        companyId,
        status: 'OPEN',
      },
    });
  }

  async resolve(id: string, dto: ResolveCsCase, companyId: string) {
    await this.findOne(id, companyId);

    return this.prisma.customerSuccessCase.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution: dto.resolution,
        satisfScore: dto.satisfScore,
        resolvedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        resolution: true,
        satisfScore: true,
        resolvedAt: true,
      },
    });
  }

  async getStats(companyId: string) {
    const [open, resolved, satisfAgg] = await Promise.all([
      this.prisma.customerSuccessCase.count({
        where: { companyId, status: 'OPEN' },
      }),
      this.prisma.customerSuccessCase.count({
        where: { companyId, status: 'RESOLVED' },
      }),
      this.prisma.customerSuccessCase.aggregate({
        where: { companyId, status: 'RESOLVED', satisfScore: { not: null } },
        _avg: { satisfScore: true },
      }),
    ]);

    return {
      open,
      resolved,
      avgSatisfaction: satisfAgg._avg.satisfScore ?? 0,
    };
  }
}
