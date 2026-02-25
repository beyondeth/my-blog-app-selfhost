import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommentsService } from "./comments.service";
import { CommentsController } from "./comments.controller";
import { MobileCommentsController } from "./mobile-comments.controller";
import { Comment } from "./entities/comment.entity";
import { CommentLike } from "./entities/comment-like.entity";
import { UsersModule } from "../users/users.module";
import { PostsModule } from "../posts/posts.module";
import { FilesModule } from "../files/files.module";
import { CacheModule } from "../cache/cache.module";
import { MetricsModule } from "../metrics/metrics.module";
import { CommonModule } from "../common/common.module";
import { CommentsReadRepository } from "./repositories/comments-read.repository";
import { CommentsCacheService } from "./services/comments-cache.service";
import { CommentsMapperService } from "./services/comments-mapper.service";
import { CommentsQueryService } from "./services/comments-query.service";
import { CommentsCommandService } from "./services/comments-command.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, CommentLike]),
    UsersModule,
    PostsModule,
    FilesModule, // CDN 서비스를 위해 추가
    CommonModule, // 공통 서비스 모듈 추가
    CacheModule,
    MetricsModule,
  ],
  providers: [
    CommentsService,
    CommentsReadRepository,
    CommentsCacheService,
    CommentsMapperService,
    CommentsQueryService,
    CommentsCommandService,
  ],
  controllers: [CommentsController, MobileCommentsController],
  exports: [CommentsService, CommentsQueryService, CommentsCommandService],
})
export class CommentsModule {}
