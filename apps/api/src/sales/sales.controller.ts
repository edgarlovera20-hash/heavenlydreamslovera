import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, SaleStatus } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @ApiQuery({ name: 'status', enum: SaleStatus, required: false })
  @ApiQuery({ name: 'asesorId', required: false })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('status') status?: SaleStatus,
    @Query('asesorId') asesorId?: string,
  ) {
    return this.salesService.findAll(user.companyId, { status, asesorId });
  }

  @Get('stats')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  getStats(@CurrentUser() user: { companyId: string }) {
    return this.salesService.getStats(user.companyId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.salesService.findOne(id, user.companyId);
  }

  @Post()
  @Roles(
    Role.PROMOTOR,
    Role.SUPERVISOR,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPER_ADMIN,
  )
  create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.salesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(
    Role.PROMOTOR,
    Role.SUPERVISOR,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPER_ADMIN,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.salesService.update(id, dto, user.companyId);
  }

  @Patch(':id/status')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.salesService.updateStatus(id, dto.status, user.companyId);
  }

  @Delete(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  delete(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.salesService.delete(id, user.companyId);
  }
}
