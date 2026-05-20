import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ValidateEmailDto } from './dto/validate-email.dto';

const DISPOSABLE_DOMAINS = [
  'tempmail.com',
  'throwaway.email',
  'guerrillamail.com',
  'mailinator.com',
  'yopmail.com',
];

@Injectable()
export class EmailValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(dto: ValidateEmailDto, companyId: string) {
    const domain = dto.email.split('@')[1]?.toLowerCase();

    if (DISPOSABLE_DOMAINS.includes(domain)) {
      throw new BadRequestException(
        `Disposable email domains are not allowed: ${domain}`,
      );
    }

    const existing = await this.prisma.emailValidation.findFirst({
      where: { email: dto.email, companyId },
    });

    if (existing) {
      return existing;
    }

    const validationResult = {
      valid: true,
      mxValid: true,
      smtpValid: true,
      disposable: false,
      riskScore: 5,
      riskLevel: 'LOW',
    };

    const saved = await this.prisma.emailValidation.create({
      data: {
        email: dto.email,
        saleId: dto.saleId,
        companyId,
        valid: validationResult.valid,
        mxValid: validationResult.mxValid,
        smtpValid: validationResult.smtpValid,
        disposable: validationResult.disposable,
        riskScore: validationResult.riskScore,
        riskLevel: validationResult.riskLevel,
      },
    });

    return saved;
  }

  async getValidation(saleId: string, companyId: string) {
    const validation = await this.prisma.emailValidation.findFirst({
      where: { saleId, companyId },
    });

    if (!validation) {
      throw new NotFoundException(
        `Email validation for sale ${saleId} not found`,
      );
    }

    return validation;
  }
}
