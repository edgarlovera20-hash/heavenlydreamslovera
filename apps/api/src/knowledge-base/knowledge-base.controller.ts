import {
  Body,
  Controller,
  Delete,
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
import { KnowledgeBaseService } from './knowledge-base.service';
import { CreateKnowledgeEntryDto } from './dto/create-entry.dto';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.PROMOTOR,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'List all active knowledge base entries, optionally filtered by category' })
  @ApiQuery({ name: 'category', required: false })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('category') category?: string,
  ) {
    return this.knowledgeBaseService.findAll(user.companyId, category);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @Roles(
    Role.SUPER_ADMIN,
    Role.GERENTE,
    Role.ADMINISTRACION,
    Role.SUPERVISOR,
    Role.PROMOTOR,
    Role.COBRANZA,
    Role.SOPORTE,
  )
  @ApiOperation({ summary: 'Search the knowledge base using text matching' })
  search(
    @Body() dto: SearchKnowledgeDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.knowledgeBaseService.search(dto, user.companyId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new knowledge base entry' })
  create(
    @Body() dto: CreateKnowledgeEntryDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.knowledgeBaseService.create(dto, user.companyId);
  }

  @Patch(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a knowledge base entry' })
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateKnowledgeEntryDto>,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.knowledgeBaseService.update(id, dto, user.companyId);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a knowledge base entry' })
  deactivate(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.knowledgeBaseService.deactivate(id, user.companyId);
  }
}
