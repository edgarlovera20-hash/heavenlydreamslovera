import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLeadStatusDto {
  @ApiProperty({
    description: 'NUEVO | CONTACTADO | INTERESADO | CALIFICADO | PERDIDO',
    enum: ['NUEVO', 'CONTACTADO', 'INTERESADO', 'CALIFICADO', 'PERDIDO'],
  })
  @IsString()
  @IsIn(['NUEVO', 'CONTACTADO', 'INTERESADO', 'CALIFICADO', 'PERDIDO'])
  status: string;
}
