import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.packageCatalog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const pkg = await this.prisma.packageCatalog.findFirst({ where: { id, companyId } });
    if (!pkg) throw new NotFoundException('Paquete no encontrado');
    return pkg;
  }

  create(companyId: string, dto: CreatePackageDto) {
    return this.prisma.packageCatalog.create({
      data: { ...dto, companyId },
    });
  }

  async update(id: string, companyId: string, dto: UpdatePackageDto) {
    await this.findOne(id, companyId);
    return this.prisma.packageCatalog.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.packageCatalog.delete({ where: { id } });
  }
}
