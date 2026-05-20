import { Injectable } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service';
import { AuditService } from '../audit/audit.service';

export type NotificationType = 'INFO' | 'ALERT' | 'SUCCESS' | 'WARNING';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly auditService: AuditService,
  ) {}

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    companyId?: string,
  ) {
    this.realtimeService.broadcast(
      'notification',
      { userId, title, message, type },
      userId,
    );

    await this.auditService.log({
      companyId,
      accion: 'NOTIFICATION_SENT',
      entidad: 'User',
      entidadId: userId,
      detalle: { title, message, type },
    });

    return { sent: true, userId, title };
  }

  async broadcastToCompany(
    companyId: string,
    title: string,
    message: string,
    type: NotificationType,
  ) {
    this.realtimeService.broadcast(
      'notification',
      { title, message, type },
      companyId,
    );

    await this.auditService.log({
      companyId,
      accion: 'NOTIFICATION_BROADCAST',
      detalle: { title, message, type },
    });

    return { sent: true, companyId, title };
  }
}
