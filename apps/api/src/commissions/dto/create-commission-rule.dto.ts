import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class CreateCommissionRuleDto {
  @ApiProperty()
  @IsNumber()
  minVentas: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxVentas?: number;

  @ApiProperty()
  @IsNumber()
  tasa: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bonusMeta?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
