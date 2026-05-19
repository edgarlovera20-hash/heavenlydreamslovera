import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { SalesModule } from './sales/sales.module';
import { CustomersModule } from './customers/customers.module';
import { LeadsModule } from './leads/leads.module';
import { TasksModule } from './tasks/tasks.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { TelegramModule } from './telegram/telegram.module';
import { OcrModule } from './ocr/ocr.module';
import { FraudModule } from './fraud/fraud.module';
import { PhoneValidationModule } from './phone-validation/phone-validation.module';
import { EmailValidationModule } from './email-validation/email-validation.module';
import { CollectionsModule } from './collections/collections.module';
import { CustomerSuccessModule } from './customer-success/customer-success.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { AutomationModule } from './automation/automation.module';
import { FlowEngineModule } from './flow-engine/flow-engine.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
      }),
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    SalesModule,
    CustomersModule,
    LeadsModule,
    TasksModule,
    WhatsAppModule,
    TelegramModule,
    OcrModule,
    FraudModule,
    PhoneValidationModule,
    EmailValidationModule,
    CollectionsModule,
    CustomerSuccessModule,
    KnowledgeBaseModule,
    AutomationModule,
    FlowEngineModule,
    NotificationsModule,
    RealtimeModule,
    AuditModule,
  ],
})
export class AppModule {}
