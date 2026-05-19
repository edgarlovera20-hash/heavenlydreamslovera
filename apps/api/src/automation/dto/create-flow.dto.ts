import { IsArray, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FlowTrigger {
  INACTIVITY_48H = 'INACTIVITY_48H',
  NEW_SALE = 'NEW_SALE',
  PAYMENT_DUE = 'PAYMENT_DUE',
  CUSTOM = 'CUSTOM',
}

export enum FlowChannel {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  MULTI = 'MULTI',
}

export class CreateFlowDto {
  @ApiProperty({ description: 'Name of the automation flow' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Description of what this flow does' })
  @IsString()
  description: string;

  @ApiProperty({ enum: FlowTrigger, description: 'Event that triggers this flow' })
  @IsEnum(FlowTrigger)
  trigger: FlowTrigger;

  @ApiProperty({ enum: FlowChannel, description: 'Communication channel for this flow' })
  @IsEnum(FlowChannel)
  channel: FlowChannel;

  @ApiProperty({ type: 'array', description: 'Ordered list of flow steps as JSON' })
  @IsArray()
  steps: Record<string, unknown>[];
}
