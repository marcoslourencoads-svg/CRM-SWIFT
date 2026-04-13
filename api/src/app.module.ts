import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { LeadsModule } from './modules/leads/leads.module';
import { CustomFieldsModule } from './modules/custom-fields/custom-fields.module';
import { TagsModule } from './modules/tags/tags.module';
import { LeadSourcesModule } from './modules/lead-sources/lead-sources.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { NotesModule } from './modules/notes/notes.module';
import { LeadTasksModule } from './modules/lead-tasks/lead-tasks.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { LeadScoringModule } from './modules/lead-scoring/lead-scoring.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { LeadTrackingModule } from './modules/lead-tracking/lead-tracking.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { validateEnv } from './common/config/env.validation';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { OrgMemberGuard } from './common/guards/org-member.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
    PipelinesModule,
    LeadsModule,
    CustomFieldsModule,
    TagsModule,
    LeadSourcesModule,
    ActivitiesModule,
    NotesModule,
    LeadTasksModule,
    MembershipsModule,
    NotificationsModule,
    AutomationsModule,
    LeadScoringModule,
    InvestmentsModule,
    DashboardModule,
    WebhooksModule,
    ApiKeysModule,
    LeadTrackingModule,
    PublicApiModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: OrgMemberGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
