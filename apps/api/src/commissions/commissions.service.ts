import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.commissionRule.findMany({
      where: { companyId, active: true },
      orderBy: { minVentas: 'asc' },
    });
  }

  async getStats(companyId: string) {
    const [rules, totalSales] = await Promise.all([
      this.prisma.commissionRule.count({ where: { companyId, active: true } }),
      this.prisma.sale.count({ where: { companyId } }),
    ]);
    return { totalRules: rules, totalSales };
  }

  async findOne(id: string, companyId: string) {
    const item = await this.prisma.commissionRule.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException(`Regla de comisión ${id} no encontrada`);
    return item;
  }

  create(dto: CreateCommissionRuleDto, companyId: string) {
    return this.prisma.commissionRule.create({ data: { ...dto, companyId } });
  }

  async update(id: string, dto: Partial<CreateCommissionRuleDto>, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.commissionRule.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.commissionRule.update({ where: { id }, data: { active: false } });
  }
}
