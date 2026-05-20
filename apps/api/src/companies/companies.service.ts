import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        rfc: true,
        logo: true,
        plan: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        rfc: true,
        logo: true,
        plan: true,
        active: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!company) throw new NotFoundException(`Empresa ${id} no encontrada`);
    return company;
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: dto,
      select: {
        id: true,
        name: true,
        rfc: true,
        logo: true,
        plan: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        rfc: true,
        logo: true,
        plan: true,
        active: true,
        updatedAt: true,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.company.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true, updatedAt: true },
    });
  }
}
