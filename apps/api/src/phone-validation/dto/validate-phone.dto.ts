import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidatePhoneDto {
  @ApiProperty({ description: 'Phone number to validate' })
  @IsString()
  phoneNumber: string;

  @ApiPropertyOptional({ description: 'Sale ID to associate with this validation' })
  @IsOptional()
  @IsString()
  saleId?: string;
}
