import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, userId?: string) {
    return this.prisma.task.findMany({
      where: {
        companyId,
        ...(userId && { assigneeId: userId }),
      },
      include: {
        assignee: { select: { id: true, nombre: true, username: true } },
        creator: { select: { id: true, nombre: true, username: true } },
        sale: { select: { id: true, nombres: true, apellidos: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId },
      include: {
        assignee: { select: { id: true, nombre: true, username: true } },
        creator: { select: { id: true, nombre: true, username: true } },
        sale: { select: { id: true, nombres: true, apellidos: true, status: true } },
      },
    });
    if (!task) throw new NotFoundException(`Tarea ${id} no encontrada`);
    return task;
  }

  create(dto: CreateTaskDto, creatorId: string, companyId: string) {
    return this.prisma.task.create({
      data: {
        ...dto,
        creatorId,
        companyId,
      },
      include: {
        assignee: { select: { id: true, nombre: true, username: true } },
        creator: { select: { id: true, nombre: true, username: true } },
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.task.update({
      where: { id },
      data: dto,
    });
  }

  async complete(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.task.update({
      where: { id },
      data: { status: 'COMPLETADA', completedAt: new Date() },
      select: { id: true, status: true, completedAt: true, updatedAt: true },
    });
  }

  async cancel(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.task.update({
      where: { id },
      data: { status: 'CANCELADA' },
      select: { id: true, status: true, updatedAt: true },
    });
  }
}
