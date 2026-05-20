import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateNominaDto } from './dto/create-nomina.dto';

@Injectable()
export class NominaService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, periodo?: string) {
    return this.prisma.nomina.findMany({
      where: {
        companyId,
        ...(periodo && { periodo }),
      },
      include: {
        asesor: { select: { id: true, nombre: true, username: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.nomina.findFirst({ where: { id } });
    if (!item) throw new NotFoundException(`Nómina ${id} no encontrada`);
    return item;
  }

  async create(dto: CreateNominaDto, companyId: string) {
    const ventasCount = dto.ventasCount ?? await this.prisma.sale.count({
      where: { companyId, asesorId: dto.asesorId },
    });

    const comisiones = dto.comisiones ?? 0;
    const bonos = dto.bonos ?? 0;
    const montoBase = dto.montoBase ?? 0;
    const total = montoBase + comisiones + bonos;

    return this.prisma.nomina.create({
      data: {
        ...dto,
        companyId,
        ventasCount,
        montoBase,
        comisiones,
        bonos,
        total,
      },
      include: {
        asesor: { select: { id: true, nombre: true, username: true } },
      },
    });
  }

  async approve(id: string) {
    await this.findOne(id);
    return this.prisma.nomina.update({ where: { id }, data: { status: 'APROBADA' } });
  }

  async markPaid(id: string) {
    await this.findOne(id);
    return this.prisma.nomina.update({ where: { id }, data: { status: 'PAGADA' } });
  }
}
