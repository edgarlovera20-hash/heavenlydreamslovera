import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ocr-processing' }),
  ],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
