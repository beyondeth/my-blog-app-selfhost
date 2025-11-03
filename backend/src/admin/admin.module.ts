import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Dashboard
import { AdminDashboardController } from './dashboard/admin-dashboard.controller';
import { AdminDashboardService } from './dashboard/admin-dashboard.service';

// Users Management
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';

// Posts Management
import { AdminPostsService } from './posts/admin-posts.service';

// Files Management
import { AdminFilesController } from './admin-files.controller';

// Debug
import { AdminDebugController } from './debug/admin-debug.controller';

// Entities
import { User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Report } from '../reports/entities/report.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { File } from '../files/entities/file.entity';
import { EmailApproval } from '../email/entities/email-approval.entity';

// Modules
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Post,
      Comment,
      Report,
      AuditLog,
      File,
      EmailApproval,
    ]),
    AuditModule,
    FilesModule,
    UsersModule,
    RedisModule,  // Redis 상태 모니터링을 위해 필요
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    // AdminFilesController, // Temporarily disabled due to S3 configuration issues
    AdminDebugController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminPostsService,
  ],
  exports: [
    AdminDashboardService,
    AdminUsersService,
    AdminPostsService,
  ],
})
export class AdminModule {}