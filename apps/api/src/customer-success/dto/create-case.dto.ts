import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CsType {
  SOPORTE = 'SOPORTE',
  RETENCION = 'RETENCION',
  UPSELL = 'UPSELL',
  RECUPERACION = 'RECUPERACION',
}

export enum CsPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export class CreateCsCase {
  @ApiProperty({ description: 'Customer ID for this case' })
  @IsString()
  customerId: string;

  @ApiProperty({ enum: CsType, description: 'Type of customer success case' })
  @IsEnum(CsType)
  type: CsType;

  @ApiProperty({ enum: CsPriority, description: 'Priority level of the case' })
  @IsEnum(CsPriority)
  priority: CsPriority;

  @ApiProperty({ description: 'Description of the issue or opportunity' })
  @IsString()
  description: string;
}
