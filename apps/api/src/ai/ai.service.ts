import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { AskAiDto } from './dto/ask-ai.dto';
import { AnalyzeFraudDto } from './dto/analyze-fraud.dto';
import { OcrCleanupDto } from './dto/ocr-cleanup.dto';

@Injectable()
export class AiService {
  private readonly aiServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:3003',
    );
  }

  async askQuestion(dto: AskAiDto, companyId: string) {
    let ragContext: unknown[] = [];

    if (dto.useRag !== false) {
      const entries = await this.prisma.knowledgeBase.findMany({
        where: { companyId, active: true },
        select: { title: true, content: true, category: true },
        take: 5,
      });
      ragContext = entries;
    }

    try {
      const response = await fetch(`${this.aiServiceUrl}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: dto.question,
          context: dto.context,
          ragContext,
          model: dto.model ?? 'phi3',
          companyId,
        }),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('AI service request failed');
      }

      return response.json();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        'Failed to communicate with AI service',
      );
    }
  }

  async analyzeFraud(dto: AnalyzeFraudDto) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/fraud-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw new InternalServerErrorException(
          'AI service fraud analysis failed',
        );
      }

      return response.json();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        'Failed to communicate with AI service',
      );
    }
  }

  async cleanupOcrText(dto: OcrCleanupDto) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/ocr-cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...dto, model: 'phi3' }),
      });

      if (!response.ok) {
        throw new InternalServerErrorException('AI service OCR cleanup failed');
      }

      return response.json();
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      throw new InternalServerErrorException(
        'Failed to communicate with AI service',
      );
    }
  }
}
