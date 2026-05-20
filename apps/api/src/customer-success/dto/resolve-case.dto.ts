import { IsInt, IsString, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveCsCase {
  @ApiProperty({ description: 'Resolution description' })
  @IsString()
  resolution: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: 'Customer satisfaction score (1-5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  satisfScore: number;
}
