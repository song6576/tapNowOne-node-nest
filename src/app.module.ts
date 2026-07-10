import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { ModelsModule } from './models/models.module';
import { ProjectsModule } from './projects/projects.module';
import { BillingModule } from './billing/billing.module';
import { TeamsModule } from './teams/teams.module';
import { TaptvModule } from './taptv/taptv.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AgentModule,
    ModelsModule,
    ProjectsModule,
    UploadModule,
    UsersModule,
    TaptvModule,
    TeamsModule,
    BillingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
