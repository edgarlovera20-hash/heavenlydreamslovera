import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('message-sending') private readonly messageSendingQueue: Queue,
    @InjectQueue('campaigns') private readonly campaignsQueue: Queue,
  ) {}

  getSessions(companyId: string) {
    return this.prisma.whatsAppSession.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        purpose: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getSession(id: string, companyId: string) {
    const session = await this.prisma.whatsAppSession.findFirst({
      where: { id, companyId },
    });
    if (!session)
      throw new NotFoundException(`Sesión WhatsApp ${id} no encontrada`);
    return session;
  }

  createSession(dto: CreateSessionDto, companyId: string) {
    return this.prisma.whatsAppSession.create({
      data: {
        name: dto.name,
        purpose: dto.purpose ?? 'OPERACIONES',
        status: 'CONNECTING',
        companyId,
      },
      select: {
        id: true,
        name: true,
        purpose: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async getQR(sessionId: string, companyId: string) {
    const session = await this.getSession(sessionId, companyId);
    if (!session.qrCode) {
      throw new BadRequestException(
        'QR no disponible. La sesión aún no ha generado un código QR.',
      );
    }
    return { sessionId: session.id, qrCode: session.qrCode, status: session.status };
  }

  async sendMessage(dto: SendMessageDto, companyId: string) {
    const session = await this.getSession(dto.sessionId, companyId);
    if (session.status !== 'CONNECTED') {
      throw new BadRequestException(
        `La sesión no está conectada. Estado actual: ${session.status}`,
      );
    }

    const job = await this.messageSendingQueue.add('send', {
      sessionId: dto.sessionId,
      to: dto.to,
      message: dto.message,
      type: dto.type ?? 'TEXT',
      companyId,
    });

    return { queued: true, jobId: job.id };
  }

  async sendCampaign(
    targets: string[],
    message: string,
    sessionId: string,
    companyId: string,
  ) {
    const session = await this.getSession(sessionId, companyId);
    if (session.status !== 'CONNECTED') {
      throw new BadRequestException(
        `La sesión no está conectada. Estado actual: ${session.status}`,
      );
    }

    const job = await this.campaignsQueue.add('broadcast', {
      sessionId,
      targets,
      message,
      companyId,
    });

    return {
      queued: true,
      jobId: job.id,
      totalTargets: targets.length,
    };
  }

  async disconnectSession(id: string, companyId: string) {
    await this.getSession(id, companyId);
    return this.prisma.whatsAppSession.update({
      where: { id },
      data: { status: 'DISCONNECTED' },
      select: { id: true, status: true, updatedAt: true },
    });
  }

  async getRecentMessages(sessionId: string, companyId: string) {
    await this.getSession(sessionId, companyId);
    return this.prisma.conversationMessage.findMany({
      where: {
        conversation: {
          companyId,
          whatsappSessionId: sessionId,
        },
      },
      include: {
        conversation: {
          select: { id: true, externalId: true, state: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
