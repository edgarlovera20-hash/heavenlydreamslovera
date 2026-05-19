import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProcessDocumentDto } from './dto/process-document.dto';

@Injectable()
export class OcrService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
  ) {}

  async queueOcr(dto: ProcessDocumentDto, companyId: string) {
    const job = await this.ocrQueue.add(
      {
        documentUrl: dto.documentUrl,
        documentType: dto.documentType,
        saleId: dto.saleId,
        companyId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    return { jobId: job.id, status: 'queued' };
  }

  async getOcrResult(saleId: string, companyId: string) {
    const document = await this.prisma.document.findFirst({
      where: { saleId, sale: { companyId } },
      select: {
        id: true,
        saleId: true,
        url: true,
        type: true,
        ocrData: true,
        confidence: true,
        fraudRisk: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!document) {
      throw new NotFoundException(`OCR result for sale ${saleId} not found`);
    }
    return document;
  }

  async saveOcrResult(
    saleId: string,
    ocrData: Record<string, unknown>,
    confidence: number,
    fraudRisk: string,
  ) {
    return this.prisma.document.updateMany({
      where: { saleId },
      data: {
        ocrData,
        confidence,
        fraudRisk,
      },
    });
  }
}
