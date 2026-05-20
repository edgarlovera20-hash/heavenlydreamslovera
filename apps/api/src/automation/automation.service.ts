import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFlowDto } from './dto/create-flow.dto';
import { TriggerFlowDto } from './dto/trigger-flow.dto';

@Injectable()
export class AutomationService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('automation') private readonly automationQueue: Queue,
  ) {}

  findAll(companyId: string) {
    return this.prisma.automationFlow.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateFlowDto, companyId: string) {
    return this.prisma.automationFlow.create({
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        channel: dto.channel,
        steps: dto.steps as Prisma.InputJsonValue,
        companyId,
        active: false,
      },
    });
  }

  async update(id: string, dto: Partial<CreateFlowDto>, companyId: string) {
    await this.findOneOrFail(id, companyId);

    const data: Prisma.AutomationFlowUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.trigger !== undefined) data.trigger = dto.trigger;
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.steps !== undefined) data.steps = dto.steps as Prisma.InputJsonValue;

    return this.prisma.automationFlow.update({ where: { id }, data });
  }

  async toggle(id: string, companyId: string) {
    const flow = await this.findOneOrFail(id, companyId);

    return this.prisma.automationFlow.update({
      where: { id },
      data: { active: !flow.active },
      select: { id: true, active: true, updatedAt: true },
    });
  }

  async triggerFlow(dto: TriggerFlowDto, companyId: string) {
    const flow = await this.findOneOrFail(dto.flowId, companyId);

    const job = await this.automationQueue.add(
      {
        flowId: dto.flowId,
        targetId: dto.targetId,
        targetType: dto.targetType,
        companyId,
        steps: flow.steps,
        channel: flow.channel,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    return { jobId: job.id, status: 'queued' };
  }

  getLogs(flowId: string, companyId: string) {
    return this.prisma.automationLog.findMany({
      where: { flowId, flow: { companyId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getStats(companyId: string) {
    const [total, success, failed] = await Promise.all([
      this.prisma.automationLog.count({ where: { flow: { companyId } } }),
      this.prisma.automationLog.count({
        where: { flow: { companyId }, status: 'SUCCESS' },
      }),
      this.prisma.automationLog.count({
        where: { flow: { companyId }, status: 'FAILED' },
      }),
    ]);

    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

    return { total, success, failed, successRate };
  }

  private async findOneOrFail(id: string, companyId: string) {
    const flow = await this.prisma.automationFlow.findFirst({
      where: { id, companyId },
    });

    if (!flow) {
      throw new NotFoundException(`Automation flow ${id} not found`);
    }

    return flow;
  }
}
