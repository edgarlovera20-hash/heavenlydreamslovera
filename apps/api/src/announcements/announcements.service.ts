import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.announcement.findMany({
      where: { companyId, active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const item = await this.prisma.announcement.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException(`Anuncio ${id} no encontrado`);
    return item;
  }

  create(dto: CreateAnnouncementDto, user: { id: string; companyId: string }) {
    return this.prisma.announcement.create({
      data: {
        ...dto,
        autorId: user.id,
        companyId: user.companyId,
      },
    });
  }

  async update(id: string, dto: Partial<CreateAnnouncementDto>, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.announcement.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.announcement.update({ where: { id }, data: { active: false } });
  }
}
