import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService, NotificationType } from './notifications.service';

class SendNotificationDto {
  @ApiProperty({ description: 'Target user ID' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message body' })
  @IsString()
  message: string;

  @ApiProperty({ enum: ['INFO', 'ALERT', 'SUCCESS', 'WARNING'] })
  @IsEnum(['INFO', 'ALERT', 'SUCCESS', 'WARNING'])
  type: NotificationType;
}

class BroadcastNotificationDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Notification message body' })
  @IsString()
  message: string;

  @ApiProperty({ enum: ['INFO', 'ALERT', 'SUCCESS', 'WARNING'] })
  @IsEnum(['INFO', 'ALERT', 'SUCCESS', 'WARNING'])
  type: NotificationType;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Send a notification to a specific user via Socket.IO' })
  sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.notificationsService.sendNotification(
      dto.userId,
      dto.title,
      dto.message,
      dto.type,
      user.companyId,
    );
  }

  @Post('broadcast')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.GERENTE, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Broadcast a notification to all users in the company' })
  broadcastToCompany(
    @Body() dto: BroadcastNotificationDto,
    @CurrentUser() user: { companyId: string },
  ) {
    return this.notificationsService.broadcastToCompany(
      user.companyId,
      dto.title,
      dto.message,
      dto.type,
    );
  }
}
