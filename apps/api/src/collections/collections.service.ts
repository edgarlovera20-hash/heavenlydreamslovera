import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCollectionCaseDto } from './dto/create-case.dto';
import { AddActionDto } from './dto/add-action.dto';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(
    companyId: string,
    filters?: { status?: string; priority?: string },
  ) {
    return this.prisma.collectionCase.findMany({
      where: {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
      },
      include: {
        customer: { select: { id: true, nombres: true, telefono: true } },
        sale: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const caseRecord = await this.prisma.collectionCase.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, nombres: true, telefono: true, email: true } },
        sale: { select: { id: true, status: true } },
        actions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!caseRecord) {
      throw new NotFoundException(`Collection case ${id} not found`);
    }

    return caseRecord;
  }

  create(dto: CreateCollectionCaseDto, companyId: string) {
    return this.prisma.collectionCase.create({
      data: {
        ...dto,
        companyId,
        status: 'OPEN',
      },
    });
  }

  async addAction(
    caseId: string,
    dto: AddActionDto,
    agentId: string,
    companyId: string,
  ) {
    await this.findOne(caseId, companyId);

    return this.prisma.collectionAction.create({
      data: {
        caseId,
        agentId,
        type: dto.type,
        notes: dto.notes,
        result: dto.result,
      },
    });
  }

  async updateStatus(id: string, status: string, companyId: string) {
    await this.findOne(id, companyId);

    return this.prisma.collectionCase.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async getStats(companyId: string) {
    const [total, byStatus, amountAgg] = await Promise.all([
      this.prisma.collectionCase.count({ where: { companyId } }),
      this.prisma.collectionCase.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.collectionCase.aggregate({
        where: { companyId },
        _sum: { amountDue: true },
      }),
    ]);

    const statusCounts = byStatus.reduce(
      (acc, row) => ({ ...acc, [row.status]: row._count._all }),
      {} as Record<string, number>,
    );

    return {
      total,
      byStatus: statusCounts,
      totalAmountDue: amountAgg._sum.amountDue ?? 0,
    };
  }
}
