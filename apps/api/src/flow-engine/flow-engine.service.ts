import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { StartFlowDto } from './dto/start-flow.dto';
import { ProcessMessageDto } from './dto/process-message.dto';
import { TransferAgentDto } from './dto/transfer-agent.dto';

type ConversationState =
  | 'WAITING_NAME'
  | 'WAITING_CURP'
  | 'WAITING_PHONE'
  | 'WAITING_EMAIL'
  | 'WAITING_ADDRESS'
  | 'WAITING_INE'
  | 'WAITING_COMPROBANTE'
  | 'WAITING_CONFIRMATION'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'TRANSFERRED';

const STATE_TRANSITIONS: Record<ConversationState, ConversationState> = {
  IN_PROGRESS: 'WAITING_NAME',
  WAITING_NAME: 'WAITING_CURP',
  WAITING_CURP: 'WAITING_PHONE',
  WAITING_PHONE: 'WAITING_EMAIL',
  WAITING_EMAIL: 'WAITING_ADDRESS',
  WAITING_ADDRESS: 'WAITING_INE',
  WAITING_INE: 'WAITING_COMPROBANTE',
  WAITING_COMPROBANTE: 'WAITING_CONFIRMATION',
  WAITING_CONFIRMATION: 'COMPLETED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  TRANSFERRED: 'TRANSFERRED',
};

const STATE_PROMPTS: Record<ConversationState, string> = {
  IN_PROGRESS: 'Hola, bienvenido. Por favor escribe tu nombre completo.',
  WAITING_NAME: 'Gracias. Ahora proporciona tu CURP.',
  WAITING_CURP: 'Perfecto. ¿Cuál es tu número de teléfono?',
  WAITING_PHONE: 'Excelente. ¿Cuál es tu correo electrónico?',
  WAITING_EMAIL: 'Muy bien. ¿Cuál es tu dirección completa?',
  WAITING_ADDRESS: 'Ahora necesito que envíes una foto de tu INE.',
  WAITING_INE: 'Gracias. Por favor envía tu comprobante de domicilio.',
  WAITING_COMPROBANTE: 'Excelente. Por favor confirma que todos tus datos son correctos (escribe SÍ para confirmar).',
  WAITING_CONFIRMATION: 'Tu solicitud ha sido completada exitosamente.',
  COMPLETED: 'Esta conversación ya fue completada.',
  CANCELLED: 'Esta conversación fue cancelada.',
  TRANSFERRED: 'Has sido transferido a un agente.',
};

@Injectable()
export class FlowEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async startConversation(dto: StartFlowDto, companyId: string) {
    const conversation = await this.prisma.conversation.create({
      data: {
        companyId,
        channel: dto.channel,
        externalId: dto.externalId,
        whatsappSessionId: dto.channel === 'WHATSAPP' ? dto.sessionId : undefined,
        telegramSessionId: dto.channel === 'TELEGRAM' ? dto.sessionId : undefined,
        state: 'IN_PROGRESS',
        context: {},
      },
    });

    return {
      conversationId: conversation.id,
      state: conversation.state,
      nextMessage: STATE_PROMPTS['IN_PROGRESS'],
    };
  }

  async processMessage(dto: ProcessMessageDto, companyId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, companyId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${dto.conversationId} not found`,
      );
    }

    await this.prisma.conversationMessage.create({
      data: {
        conversationId: dto.conversationId,
        content: dto.message,
        mediaUrl: dto.mediaUrl,
        fromAgent: false,
      },
    });

    const currentState = conversation.state as ConversationState;
    const context = (conversation.context as Record<string, unknown>) ?? {};

    switch (currentState) {
      case 'IN_PROGRESS':
        context.name = dto.message;
        break;
      case 'WAITING_NAME':
        context.curp = dto.message;
        break;
      case 'WAITING_CURP':
        context.phone = dto.message;
        break;
      case 'WAITING_PHONE':
        context.email = dto.message;
        break;
      case 'WAITING_EMAIL':
        context.address = dto.message;
        break;
      case 'WAITING_ADDRESS':
        context.ineUrl = dto.mediaUrl ?? dto.message;
        break;
      case 'WAITING_INE':
        context.comprobanteUrl = dto.mediaUrl ?? dto.message;
        break;
      case 'WAITING_COMPROBANTE':
        context.confirmed = dto.message.toLowerCase().includes('si');
        break;
    }

    const nextState = STATE_TRANSITIONS[currentState] ?? currentState;

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { state: nextState, context: context as Prisma.InputJsonValue },
    });

    return {
      conversationId: dto.conversationId,
      previousState: currentState,
      newState: nextState,
      nextMessage: STATE_PROMPTS[nextState],
    };
  }

  async getConversation(id: string, companyId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return conversation;
  }

  getActiveConversations(companyId: string, channel?: string) {
    return this.prisma.conversation.findMany({
      where: {
        companyId,
        state: { notIn: ['COMPLETED', 'CANCELLED'] },
        ...(channel && { channel }),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async transferToAgent(dto: TransferAgentDto, companyId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, companyId },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation ${dto.conversationId} not found`,
      );
    }

    return this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { state: 'TRANSFERRED', assignedAgentId: dto.agentId },
      select: { id: true, state: true, assignedAgentId: true, updatedAt: true },
    });
  }

  async completeConversation(id: string, companyId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, companyId },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { state: 'COMPLETED', resolvedAt: new Date() },
      select: { id: true, state: true, resolvedAt: true },
    });
  }
}
