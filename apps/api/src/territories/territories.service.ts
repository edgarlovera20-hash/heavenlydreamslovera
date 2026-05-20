import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTerritoryDto } from './dto/create-territory.dto';

@Injectable()
export class TerritoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.territory.findMany({
      where: { companyId },
      orderBy: { nombre: 'asc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const item = await this.prisma.territory.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException(`Territorio ${id} no encontrado`);
    return item;
  }

  create(dto: CreateTerritoryDto, companyId: string) {
    return this.prisma.territory.create({ data: { ...dto, companyId } });
  }

  async update(id: string, dto: Partial<CreateTerritoryDto>, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.territory.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.territory.delete({ where: { id } });
  }
}
