import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TriggerFlowDto {
  @ApiProperty({ description: 'ID of the flow to trigger' })
  @IsString()
  flowId: string;

  @ApiProperty({ description: 'ID of the target entity' })
  @IsString()
  targetId: string;

  @ApiProperty({ description: 'Type of the target (customer, sale, lead, etc.)' })
  @IsString()
  targetType: string;
}
