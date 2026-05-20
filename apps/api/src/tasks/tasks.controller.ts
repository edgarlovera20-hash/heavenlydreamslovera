import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiQuery({ name: 'userId', required: false })
  findAll(
    @CurrentUser() user: { companyId: string },
    @Query('userId') userId?: string,
  ) {
    return this.tasksService.findAll(user.companyId, userId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.tasksService.findOne(id, user.companyId);
  }

  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: { id: string; companyId: string },
  ) {
    return this.tasksService.create(dto, user.id, user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.tasksService.update(id, dto, user.companyId);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.tasksService.complete(id, user.companyId);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.tasksService.cancel(id, user.companyId);
  }
}
