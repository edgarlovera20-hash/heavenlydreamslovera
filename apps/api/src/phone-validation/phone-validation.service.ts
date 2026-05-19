import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ValidatePhoneDto } from './dto/validate-phone.dto';

interface PhoneValidationResult {
  valid: boolean;
  carrier: string;
  lineType: string;
  fraudScore: number;
  riskLevel: string;
  portability: boolean;
}

@Injectable()
export class PhoneValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(dto: ValidatePhoneDto, companyId: string) {
    const existing = await this.prisma.phoneValidation.findFirst({
      where: { phoneNumber: dto.phoneNumber, companyId },
    });

    if (existing) {
      return existing;
    }

    const result: PhoneValidationResult = {
      valid: true,
      carrier: 'Telcel',
      lineType: 'MOVIL',
      fraudScore: 5,
      riskLevel: 'LOW',
      portability: false,
    };

    const saved = await this.prisma.phoneValidation.create({
      data: {
        phoneNumber: dto.phoneNumber,
        saleId: dto.saleId,
        companyId,
        valid: result.valid,
        carrier: result.carrier,
        lineType: result.lineType,
        fraudScore: result.fraudScore,
        riskLevel: result.riskLevel,
        portability: result.portability,
      },
    });

    return saved;
  }

  async getValidation(saleId: string, companyId: string) {
    const validation = await this.prisma.phoneValidation.findFirst({
      where: { saleId, companyId },
    });

    if (!validation) {
      throw new NotFoundException(
        `Phone validation for sale ${saleId} not found`,
      );
    }

    return validation;
  }
}
