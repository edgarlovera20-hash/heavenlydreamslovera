import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ActionType {
  LLAMADA = 'LLAMADA',
  WHATSAPP = 'WHATSAPP',
  VISITA = 'VISITA',
  ACUERDO = 'ACUERDO',
  PAGO = 'PAGO',
}

export class AddActionDto {
  @ApiProperty({ enum: ActionType, description: 'Type of collection action taken' })
  @IsEnum(ActionType)
  type: ActionType;

  @ApiPropertyOptional({ description: 'Notes about the action' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Result or outcome of the action' })
  @IsOptional()
  @IsString()
  result?: string;
}
