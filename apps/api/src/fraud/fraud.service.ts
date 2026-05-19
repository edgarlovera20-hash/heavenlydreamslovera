import { Injectable, NotFoundException } from '@nestjs/common';
import { FraudRisk } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateFlagDto } from './dto/create-flag.dto';

interface FraudCheckResult {
  type: string;
  description: string;
  riskLevel: FraudRisk;
  score: number;
}

@Injectable()
export class FraudService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkDuplicateCurp(
    curp: string,
    companyId: string,
    excludeSaleId: string,
  ): Promise<FraudCheckResult | null> {
    if (!curp) return null;
    const count = await this.prisma.sale.count({
      where: { companyId, curp, NOT: { id: excludeSaleId } },
    });
    if (count === 0) return null;
    return {
      type: 'CURP_DUPLICADO',
      description: `CURP ${curp} encontrada en ${count} venta(s) previas`,
      riskLevel: FraudRisk.HIGH,
      score: 80,
    };
  }

  private async checkDuplicatePhone(
    telefono: string,
    companyId: string,
    excludeSaleId: string,
  ): Promise<FraudCheckResult | null> {
    if (!telefono) return null;
    const count = await this.prisma.sale.count({
      where: { companyId, telefono, NOT: { id: excludeSaleId } },
    });
    if (count === 0) return null;
    return {
      type: 'TELEFONO_REPETIDO',
      description: `Teléfono ${telefono} encontrado en ${count} venta(s) previas`,
      riskLevel: count >= 3 ? FraudRisk.HIGH : FraudRisk.MEDIUM,
      score: Math.min(40 + count * 10, 75),
    };
  }

  private async checkOcrConsistency(
    saleId: string,
  ): Promise<FraudCheckResult | null> {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { documents: true },
    });
    if (!sale || sale.documents.length === 0) return null;

    const inconsistencies: string[] = [];
    for (const doc of sale.documents) {
      if (!doc.ocrData) continue;
      const ocr = doc.ocrData as Record<string, any>;

      if (
        ocr.curp &&
        sale.curp &&
        ocr.curp.toString().toUpperCase() !== sale.curp.toUpperCase()
      ) {
        inconsistencies.push('CURP no coincide con documento OCR');
      }
      if (
        ocr.nombre &&
        sale.nombres &&
        !ocr.nombre
          .toString()
          .toLowerCase()
          .includes(sale.nombres.toLowerCase())
      ) {
        inconsistencies.push('Nombre no coincide con documento OCR');
      }
    }

    if (inconsistencies.length === 0) return null;
    return {
      type: 'OCR_INCONSISTENTE',
      description: inconsistencies.join('; '),
      riskLevel: FraudRisk.MEDIUM,
      score: 50,
    };
  }

  private calculateScore(flags: FraudCheckResult[]): {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    if (flags.length === 0) return { score: 0, level: 'LOW' };
    const composite = Math.min(
      flags.reduce((sum, f) => sum + f.score, 0),
      100,
    );
    const level =
      composite >= 71 ? 'HIGH' : composite >= 31 ? 'MEDIUM' : 'LOW';
    return { score: composite, level };
  }

  async analyzeSale(saleId: string, companyId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, companyId },
    });
    if (!sale) throw new NotFoundException(`Venta ${saleId} no encontrada`);

    const [curpFlag, phoneFlag, ocrFlag] = await Promise.all([
      this.checkDuplicateCurp(sale.curp ?? '', companyId, saleId),
      this.checkDuplicatePhone(sale.telefono ?? '', companyId, saleId),
      this.checkOcrConsistency(saleId),
    ]);

    const flags = [curpFlag, phoneFlag, ocrFlag].filter(
      (f): f is FraudCheckResult => f !== null,
    );

    const { score, level } = this.calculateScore(flags);

    // Persist flags and update fraud score:
    // Delete unresolved flags of same types then recreate with fresh data
    await this.prisma.fraudFlag.deleteMany({
      where: {
        saleId,
        companyId,
        resolved: false,
        type: { in: flags.map((f) => f.type) },
      },
    });

    await Promise.all([
      flags.length > 0
        ? this.prisma.fraudFlag.createMany({
            data: flags.map((flag) => ({
              saleId,
              companyId,
              type: flag.type,
              description: flag.description,
              riskLevel: flag.riskLevel,
              score: flag.score,
            })),
          })
        : Promise.resolve(),
      this.prisma.sale.update({
        where: { id: saleId },
        data: { fraudScore: score },
      }),
    ]);

    return { saleId, score, level, flags };
  }

  getFlags(saleId: string, companyId: string) {
    return this.prisma.fraudFlag.findMany({
      where: { saleId, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFlag(dto: CreateFlagDto, companyId: string) {
    return this.prisma.fraudFlag.create({
      data: {
        saleId: dto.saleId,
        companyId,
        type: dto.type,
        description: dto.description,
        riskLevel: dto.riskLevel,
        score: dto.score,
      },
    });
  }

  async resolveFlag(flagId: string, companyId: string) {
    const flag = await this.prisma.fraudFlag.findFirst({
      where: { id: flagId, companyId },
    });
    if (!flag) throw new NotFoundException(`Flag ${flagId} no encontrado`);
    return this.prisma.fraudFlag.update({
      where: { id: flagId },
      data: { resolved: true, resolvedAt: new Date() },
      select: { id: true, resolved: true, resolvedAt: true, type: true },
    });
  }
}
