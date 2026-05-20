import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateKnowledgeEntryDto } from './dto/create-entry.dto';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, category?: string) {
    return this.prisma.knowledgeBase.findMany({
      where: {
        companyId,
        active: true,
        ...(category && { category }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  search(dto: SearchKnowledgeDto, companyId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: {
        companyId,
        active: true,
        ...(dto.category && { category: dto.category }),
        OR: [
          { title: { contains: dto.query, mode: 'insensitive' } },
          { content: { contains: dto.query, mode: 'insensitive' } },
        ],
      },
      take: dto.limit ?? 5,
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateKnowledgeEntryDto, companyId: string) {
    return this.prisma.knowledgeBase.create({
      data: {
        ...dto,
        companyId,
        active: true,
        embedding: [],
      },
    });
  }

  async update(id: string, dto: Partial<CreateKnowledgeEntryDto>, companyId: string) {
    await this.findOneOrFail(id, companyId);

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string, companyId: string) {
    await this.findOneOrFail(id, companyId);

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true, updatedAt: true },
    });
  }

  private async findOneOrFail(id: string, companyId: string) {
    const entry = await this.prisma.knowledgeBase.findFirst({
      where: { id, companyId },
    });

    if (!entry) {
      throw new NotFoundException(`Knowledge base entry ${id} not found`);
    }

    return entry;
  }
}
