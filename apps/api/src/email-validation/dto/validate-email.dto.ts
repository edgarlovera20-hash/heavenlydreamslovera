import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateEmailDto {
  @ApiProperty({ description: 'Email address to validate' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ description: 'Sale ID to associate with this validation' })
  @IsOptional()
  @IsString()
  saleId?: string;
}
