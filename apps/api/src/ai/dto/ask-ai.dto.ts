import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AiModel {
  PHI3 = 'phi3',
  MISTRAL7B = 'mistral7b',
}

export class AskAiDto {
  @ApiProperty({ description: 'Question to ask the AI' })
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: 'Additional context for the question' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ default: true, description: 'Use RAG knowledge base' })
  @IsOptional()
  @IsBoolean()
  useRag?: boolean = true;

  @ApiPropertyOptional({ enum: AiModel, default: AiModel.PHI3 })
  @IsOptional()
  @IsEnum(AiModel)
  model?: AiModel = AiModel.PHI3;
}
