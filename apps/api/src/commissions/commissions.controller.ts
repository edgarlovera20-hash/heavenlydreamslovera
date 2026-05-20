import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CommissionsService } from './commissions.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';

@ApiTags('commissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get()
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.service.findAll(user.companyId);
  }

  @Get('stats')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  getStats(@CurrentUser() user: { companyId: string }) {
    return this.service.getStats(user.companyId);
  }

  @Post()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  create(
    @Body() dto: CreateCommissionRuleDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.service.create(dto, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCommissionRuleDto>,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.service.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.service.remove(id, user.companyId);
  }
}
