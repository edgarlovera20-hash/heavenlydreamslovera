import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeFraudDto {
  @ApiProperty({ description: 'Sale ID to analyze for fraud' })
  @IsString()
  saleId: string;

  @ApiProperty({ description: 'Data payload for fraud analysis' })
  @IsObject()
  data: Record<string, unknown>;
}
