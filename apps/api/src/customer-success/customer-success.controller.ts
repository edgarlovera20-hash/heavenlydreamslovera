import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerSuccessService } from './customer-success.service';
import { CreateCsCase } from './dto/create-case.dto';
import { ResolveCsCase } from './dto/resolve-case.dto';

@ApiTags('customer-success')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customer-success')
export class CustomerSuccessController {
  constructor(
    private readonly customerSuccessService: CustomerSuccessService,
  ) {}

  @Get()
  @Roles(Role.SOPORTE, Role.SUPERVISOR, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all customer success cases with optional filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.customerSuccessService.findAll(user.companyId, { status, type });
  }

  @Get('stats')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get customer success statistics (open, resolved, avg satisfaction)' })
  getStats(@CurrentUser() user: { companyId: string }) {
    return this.customerSuccessService.getStats(user.companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    Role.SOPORTE,
    Role.SUPERVISOR,
    Role.ADMINISTRACION,
    Role.GERENTE,
    Role.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Create a new customer success case' })
  create(
    @Body() dto: CreateCsCase,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.customerSuccessService.create(dto, user.companyId);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @Roles(
    Role.SOPORTE,
    Role.SUPERVISOR,
    Role.ADMINISTRACION,
    Role.GERENTE,
    Role.SUPER_ADMIN,
  )
  @ApiOperation({ summary: 'Resolve a customer success case with satisfaction score' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveCsCase,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.customerSuccessService.resolve(id, dto, user.companyId);
  }
}
