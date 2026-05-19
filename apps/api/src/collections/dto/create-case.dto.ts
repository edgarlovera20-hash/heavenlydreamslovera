import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum CasePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateCollectionCaseDto {
  @ApiPropertyOptional({ description: 'Sale ID associated with this case' })
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional({ description: 'Customer ID for this collection case' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiProperty({ description: 'Total amount due in MXN' })
  @IsNumber()
  @Min(0)
  amountDue: number;

  @ApiProperty({ description: 'Number of months overdue' })
  @IsNumber()
  @Min(0)
  monthsOverdue: number;

  @ApiProperty({ enum: CasePriority, description: 'Case priority level' })
  @IsEnum(CasePriority)
  priority: CasePriority;
}
