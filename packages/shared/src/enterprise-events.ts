export type EnterpriseEventName =
  | 'email.received'
  | 'email.attachment.detected'
  | 'sync.started'
  | 'sync.completed'
  | 'sync.failed'
  | 'customer.updated'
  | 'payment.updated'
  | 'morosity.updated'
  | 'ocr.completed'
  | 'ocr.failed'
  | 'ai.risk.detected'
  | 'notification.sent';

export type EnterpriseRole =
  | 'DIRECTOR'
  | 'GERENTE'
  | 'SUPERVISOR'
  | 'PROMOTOR'
  | 'COBRANZA'
  | 'ADMINISTRACION'
  | 'AUDITOR';

export type EnterpriseEvent<TPayload = Record<string, unknown>> = {
  id: string;
  tenantId: string;
  name: EnterpriseEventName;
  payload: TPayload;
  actorId?: string | null;
  createdAt: string;
};

export type SyncFileType =
  | 'siac'
  | 'morosidad'
  | 'seguimiento'
  | 'pagos'
  | 'ventas'
  | 'portabilidad'
  | 'desconocido';

export type SyncResult = {
  jobId: string;
  type: SyncFileType;
  imported: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};
