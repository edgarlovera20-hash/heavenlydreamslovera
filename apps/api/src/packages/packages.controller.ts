import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@ApiTags('packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.packagesService.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.packagesService.findOne(id, user.companyId);
  }

  @Post()
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  create(@CurrentUser() user: { companyId: string }, @Body() dto: CreatePackageDto) {
    return this.packagesService.create(user.companyId, dto);
  }

  @Patch(':id')
  @Roles(Role.GERENTE, Role.ADMINISTRACION, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packagesService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.packagesService.remove(id, user.companyId);
  }
}
