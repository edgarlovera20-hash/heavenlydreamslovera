import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SaleStatus } from '@prisma/client';

export class UpdateStatusDto {
  @ApiProperty({ enum: SaleStatus })
  @IsEnum(SaleStatus)
  status: SaleStatus;
}
