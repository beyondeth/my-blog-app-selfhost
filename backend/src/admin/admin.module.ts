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

// Nonce Management
import { AdminNonceController } from './nonce/admin-nonce.controller';

// Entities
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Report } from '../reports/entities/report.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { File } from '../files/entities/file.entity';

// Modules
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Post,
      Comment,
      Report,
      AuditLog,
      File,
    ]),
    AuditModule,
    FilesModule,
    UsersModule,
    McpModule,  // MCP 논스 관리를 위해 필요
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    AdminFilesController,
    AdminDebugController,
    AdminNonceController,  // 논스 관리 컨트롤러
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