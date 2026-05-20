import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FraudRisk } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateFlagDto {
  @ApiProperty()
  @IsUUID()
  saleId: string;

  @ApiProperty({
    description:
      'CURP_DUPLICADO | TELEFONO_REPETIDO | EMAIL_SOSPECHOSO | OCR_INCONSISTENTE | DOCUMENTO_ALTERADO | PATRON_MASIVO',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: FraudRisk })
  @IsEnum(FraudRisk)
  riskLevel: FraudRisk;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  score: number;
}
