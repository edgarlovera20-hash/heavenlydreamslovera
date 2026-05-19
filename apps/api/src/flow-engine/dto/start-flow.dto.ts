import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FlowChannel {
  WHATSAPP = 'WHATSAPP',
  TELEGRAM = 'TELEGRAM',
  APP = 'APP',
}

export class StartFlowDto {
  @ApiProperty({ enum: FlowChannel, description: 'Communication channel for this conversation' })
  @IsEnum(FlowChannel)
  channel: FlowChannel;

  @ApiProperty({ description: 'External identifier (phone number, telegram chat ID, etc.)' })
  @IsString()
  externalId: string;

  @ApiPropertyOptional({ description: 'Optional session ID to resume an existing session' })
  @IsOptional()
  @IsString()
  sessionId?: string;
}
