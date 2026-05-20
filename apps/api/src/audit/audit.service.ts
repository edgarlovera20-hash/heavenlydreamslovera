import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface AuditLogData {
  companyId?: string;
  accion: string;
  entidad?: string;
  entidadId?: string;
  userId?: string;
  userNombre?: string;
  detalle?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(data: AuditLogData) {
    return this.prisma.auditLog.create({
      data: {
        companyId: data.companyId,
        accion: data.accion,
        entidad: data.entidad,
        entidadId: data.entidadId,
        userId: data.userId,
        userNombre: data.userNombre,
        detalle: data.detalle as Prisma.InputJsonValue | undefined,
        ip: data.ip,
      },
    });
  }

  findAll(companyId: string, limit = 200) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findByEntity(entidad: string, entidadId: string, companyId: string) {
    return this.prisma.auditLog.findMany({
      where: { entidad, entidadId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
