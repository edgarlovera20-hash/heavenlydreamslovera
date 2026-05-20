import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateNominaDto {
  @ApiProperty()
  @IsString()
  asesorId: string;

  @ApiProperty()
  @IsString()
  periodo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  ventasCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  montoBase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  comisiones?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  bonos?: number;
}
