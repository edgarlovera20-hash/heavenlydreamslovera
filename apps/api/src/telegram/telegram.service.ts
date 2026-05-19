import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTelegramSessionDto } from './dto/create-session.dto';
import { SendTelegramMessageDto } from './dto/send-message.dto';

@Injectable()
export class TelegramService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('message-sending') private readonly messageSendingQueue: Queue,
  ) {}

  getSessions(companyId: string) {
    return this.prisma.telegramSession.findMany({
      where: { companyId },
      select: {
        id: true,
        botName: true,
        purpose: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSession(dto: CreateTelegramSessionDto, companyId: string) {
    return this.prisma.telegramSession.create({
      data: {
        ...dto,
        companyId,
        active: true,
      },
      select: {
        id: true,
        botName: true,
        purpose: true,
        active: true,
        createdAt: true,
      },
    });
  }

  async sendMessage(dto: SendTelegramMessageDto, companyId: string) {
    const session = await this.prisma.telegramSession.findFirst({
      where: { id: dto.sessionId, companyId, active: true },
    });

    if (!session) {
      throw new NotFoundException(
        `Telegram session ${dto.sessionId} not found or inactive`,
      );
    }

    const job = await this.messageSendingQueue.add(
      {
        channel: 'telegram',
        sessionId: dto.sessionId,
        chatId: dto.chatId,
        message: dto.message,
        companyId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );

    return { jobId: job.id, status: 'queued' };
  }

  async getMessages(sessionId: string, companyId: string) {
    const session = await this.prisma.telegramSession.findFirst({
      where: { id: sessionId, companyId },
    });

    if (!session) {
      throw new NotFoundException(`Telegram session ${sessionId} not found`);
    }

    return this.prisma.conversationMessage.findMany({
      where: { conversation: { sessionId, companyId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async deactivateSession(id: string, companyId: string) {
    const session = await this.prisma.telegramSession.findFirst({
      where: { id, companyId },
    });

    if (!session) {
      throw new NotFoundException(`Telegram session ${id} not found`);
    }

    return this.prisma.telegramSession.update({
      where: { id },
      data: { active: false },
      select: { id: true, active: true, updatedAt: true },
    });
  }
}
