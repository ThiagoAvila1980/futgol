import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { AccountsModule } from './accounts/accounts.module';
import { CommentsModule } from './comments/comments.module';
import { RestModule } from './rest/rest.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    AdminModule,
    AccountsModule,
    CommentsModule,
    RestModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
