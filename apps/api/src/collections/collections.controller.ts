import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CollectionsService } from './collections.service';
import { CreateCollectionCaseDto } from './dto/create-case.dto';
import { AddActionDto } from './dto/add-action.dto';

@ApiTags('collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @Roles(Role.COBRANZA, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all collection cases with optional status/priority filters' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.collectionsService.findAll(user.companyId, { status, priority });
  }

  @Get('stats')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get collection statistics for the company' })
  getStats(@CurrentUser() user: { companyId: string }) {
    return this.collectionsService.getStats(user.companyId);
  }

  @Get(':id')
  @Roles(Role.COBRANZA, Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a single collection case by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.collectionsService.findOne(id, user.companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new collection case' })
  create(
    @Body() dto: CreateCollectionCaseDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.collectionsService.create(dto, user.companyId);
  }

  @Post(':id/actions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.COBRANZA, Role.GERENTE)
  @ApiOperation({ summary: 'Add an action log to a collection case' })
  addAction(
    @Param('id') id: string,
    @Body() dto: AddActionDto,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.collectionsService.addAction(id, dto, user.id, user.companyId);
  }

  @Patch(':id/status')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update the status of a collection case' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.collectionsService.updateStatus(id, status, user.companyId);
  }
}
