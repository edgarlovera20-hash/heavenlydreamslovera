import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreatePackageDto {
  @IsString()
  nombre: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  megas?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
