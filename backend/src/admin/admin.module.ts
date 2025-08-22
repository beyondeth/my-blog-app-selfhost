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

// Entities
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Report } from '../reports/entities/report.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';

// Modules
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      Report,
      AuditLog,
    ]),
    AuditModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
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