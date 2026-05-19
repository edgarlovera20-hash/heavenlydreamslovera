import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OcrCleanupDto {
  @ApiProperty({ description: 'Raw OCR text to clean up' })
  @IsString()
  rawText: string;

  @ApiProperty({ description: 'Document type for context-aware cleanup' })
  @IsString()
  documentType: string;
}
