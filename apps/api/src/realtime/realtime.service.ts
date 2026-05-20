import { Injectable } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  notifyQrUpdate(companyId: string, sessionId: string, qr: string) {
    this.gateway.broadcast(
      'qr-update',
      { sessionId, qr },
      companyId,
    );
  }

  notifySessionStatus(companyId: string, sessionId: string, status: string) {
    this.gateway.broadcast(
      'session-status',
      { sessionId, status },
      companyId,
    );
  }

  notifyNewMessage(
    companyId: string,
    conversationId: string,
    message: Record<string, unknown>,
  ) {
    this.gateway.broadcast(
      'new-message',
      { conversationId, message },
      companyId,
    );
  }

  broadcastDashboard(companyId: string, stats: Record<string, unknown>) {
    this.gateway.broadcast('dashboard-update', stats, companyId);
  }

  broadcast(event: string, data: Record<string, unknown>, room: string) {
    this.gateway.broadcast(event, data, room);
  }
}
