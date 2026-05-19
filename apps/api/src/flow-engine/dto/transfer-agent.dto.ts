import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferAgentDto {
  @ApiProperty({ description: 'Conversation ID to transfer' })
  @IsString()
  conversationId: string;

  @ApiProperty({ description: 'Agent user ID to transfer conversation to' })
  @IsString()
  agentId: string;
}
