import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSaleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombres: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  apellidos: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  curp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colonia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  municipio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  codigoPostal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipoCliente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipoServicio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  rentaMensual?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zona?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaSolicitud?: Date;
}
