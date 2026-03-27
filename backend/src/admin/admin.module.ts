import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

// Dashboard
import { AdminDashboardController } from "./dashboard/admin-dashboard.controller";
import { AdminDashboardService } from "./dashboard/admin-dashboard.service";

// Users Management
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";

// Posts Management
import { AdminPostsService } from "./posts/admin-posts.service";
import { AdminPostsController } from "./posts/admin-posts.controller";

// Files Management
import { AdminFilesController } from "./admin-files.controller";
import { AdminCommunitiesController } from "./communities/admin-communities.controller";

// Debug
import { AdminDebugController } from "./debug/admin-debug.controller";

// Entities
import { User } from "../users/entities/user.entity";
import { Profile } from "../users/entities/profile.entity";
import { Post } from "../posts/entities/post.entity";
import { Comment } from "../comments/entities/comment.entity";
import { Report } from "../reports/entities/report.entity";
import { AuditLog } from "../audit/entities/audit-log.entity";
import { File } from "../files/entities/file.entity";
import { EmailApproval } from "../email/entities/email-approval.entity";

// Modules
import { AuditModule } from "../audit/audit.module";
import { FilesModule } from "../files/files.module";
import { UsersModule } from "../users/users.module";
import { RedisModule } from "../redis/redis.module";
import { CommunitiesModule } from "../communities/communities.module";
import { AdminCommunitiesService } from "./communities/admin-communities.service";

// Feedback Management
import { AdminFeedbackController } from "./feedback/admin-feedback.controller";
import { AdminFeedbackService } from "./feedback/admin-feedback.service";
import { FeedbackTicket } from "../feedback/entities/feedback-ticket.entity";

// Marketplace Admin
import { AdminMarketplaceController } from "./controllers/admin-marketplace.controller";
import { AdminMarketplaceService } from "./services/admin-marketplace.service";
import { ProductDetail } from "../marketplace/entities/product-detail.entity";
import { Order } from "../marketplace/entities/order.entity";
import { RefundRequest } from "../marketplace/entities/refund-request.entity";
import { HttpModule } from "@nestjs/axios";
import { TossApiClient } from "../payment/providers/toss-api.client";

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
      FeedbackTicket,
      ProductDetail,
      Order,
      RefundRequest,
    ]),
    HttpModule,
    AuditModule,
    FilesModule,
    UsersModule,
    RedisModule, // Redis 상태 모니터링을 위해 필요
    CommunitiesModule,
  ],
  controllers: [
    AdminDashboardController,
    AdminUsersController,
    // AdminFilesController, // Temporarily disabled due to S3 configuration issues
    AdminDebugController,
    AdminCommunitiesController,
    AdminPostsController,
    AdminFeedbackController,
    AdminMarketplaceController,
  ],
  providers: [
    AdminDashboardService,
    AdminUsersService,
    AdminPostsService,
    AdminCommunitiesService,
    AdminFeedbackService,
    AdminMarketplaceService,
    TossApiClient,
  ],
  exports: [AdminDashboardService, AdminUsersService, AdminPostsService, AdminFeedbackService],
})
export class AdminModule {}
