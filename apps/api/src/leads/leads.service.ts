import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.lead.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, companyId },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} no encontrado`);
    return lead;
  }

  create(dto: CreateLeadDto, companyId: string) {
    return this.prisma.lead.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, dto: UpdateLeadDto, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.lead.update({
      where: { id },
      data: dto,
    });
  }

  async updateStatus(id: string, status: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.lead.update({
      where: { id },
      data: { status },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async convertToSale(id: string, companyId: string, userId: string) {
    const lead = await this.findOne(id, companyId);

    const sale = await this.prisma.sale.create({
      data: {
        companyId,
        asesorId: userId,
        nombres: lead.nombres ?? undefined,
        apellidos: lead.apellidos ?? undefined,
        telefono: lead.telefono ?? undefined,
        email: lead.email ?? undefined,
        notas: lead.notas ?? undefined,
      },
    });

    await this.prisma.lead.update({
      where: { id },
      data: { status: 'CALIFICADO', metadata: { convertedSaleId: sale.id } as any },
    });

    return { lead: { id: lead.id, status: 'CALIFICADO' }, sale };
  }
}
