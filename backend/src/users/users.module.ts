import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { User } from "./entities/user.entity";
import { Profile } from "./entities/profile.entity";
import { Subscription } from "./entities/subscription.entity";
import { AccountSettings } from "./entities/account-settings.entity";
import { UserIdentity } from "./entities/user-identity.entity";
import { UserDeletionLog } from "./entities/user-deletion-log.entity";
import { UserDeletionService } from "./services/user-deletion.service";
import { UserDeletionDebugService } from "./services/user-deletion-debug.service";
import { DataRetentionService } from "./services/data-retention.service";
import { IdentityService } from "./services/identity.service";
import { File } from "../files/entities/file.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { Post } from "../posts/entities/post.entity";
import { Comment } from "../comments/entities/comment.entity";
import { Report } from "../reports/entities/report.entity";
import { Follow } from "../follows/entities/follow.entity";
import { EmailApproval } from "../email/entities/email-approval.entity";
import { EmailModule } from "../email/email.module";
import { FilesModule } from "../files/files.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Profile,
      Subscription,
      AccountSettings,
      UserIdentity,
      UserDeletionLog,
      EmailApproval,
      File,
      Blog,
      Post,
      Comment,
      Report,
      Follow,
    ]),
    EventEmitterModule,
    forwardRef(() => EmailModule),
    FilesModule,
    AuditModule,
  ],
  providers: [
    UsersService,
    UserDeletionService,
    UserDeletionDebugService,
    DataRetentionService,
    IdentityService,
  ],
  controllers: [UsersController],
  exports: [
    UsersService,
    UserDeletionService,
    UserDeletionDebugService,
    DataRetentionService,
    IdentityService,
  ],
})
export class UsersModule {}
