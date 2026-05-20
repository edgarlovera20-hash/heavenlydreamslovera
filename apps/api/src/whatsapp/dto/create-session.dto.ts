import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    enum: ['OPERACIONES', 'CUSTOMER_SUCCESS', 'COBRANZA'],
    default: 'OPERACIONES',
  })
  @IsOptional()
  @IsString()
  @IsIn(['OPERACIONES', 'CUSTOMER_SUCCESS', 'COBRANZA'])
  purpose?: string = 'OPERACIONES';
}
