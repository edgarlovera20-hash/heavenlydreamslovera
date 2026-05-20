import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NominaService } from './nomina.service';
import { CreateNominaDto } from './dto/create-nomina.dto';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class NominaController {
  constructor(private readonly service: NominaService) {}

  @Get()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('periodo') periodo?: string,
  ) {
    return this.service.findAll(user.companyId, periodo);
  }

  @Post()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  create(
    @Body() dto: CreateNominaDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.service.create(dto, user.companyId);
  }

  @Patch(':id/approve')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Patch(':id/pay')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  markPaid(@Param('id') id: string) {
    return this.service.markPaid(id);
  }
}
