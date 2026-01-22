import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { Report } from "./entities/report.entity";
import { ReportActionLog } from "./entities/report-action.entity";
import { Post } from "../posts/entities/post.entity";
import { Comment } from "../comments/entities/comment.entity";
import { User } from "../users/entities/user.entity";
import { CommunityPost, CommunityComment } from "../communities/entities";
import { CommunitiesModule } from "../communities/communities.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      ReportActionLog,
      Post,
      Comment,
      User,
      CommunityPost,
      CommunityComment,
    ]),
    CommunitiesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
