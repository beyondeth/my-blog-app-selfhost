import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BlogsService } from "./blogs.service";
import { BlogsController } from "./blogs.controller";
import { BlogStatsController } from "./blog-stats.controller";
import { Blog } from "./entities/blog.entity";
import { OldAlias } from "./entities/old-alias.entity";
import { Follow } from "../follows/entities/follow.entity";
import { UsersModule } from "../users/users.module";
import { CommonModule } from "../common/common.module";
import { EventsModule } from "../common/events/events.module";
import { PostsModule } from "../posts/posts.module";
import { FilesModule } from "../files/files.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Blog, OldAlias, Follow]),
    UsersModule,
    CommonModule, // 공통 서비스 모듈 추가
    EventsModule, // 이벤트 시스템 모듈 추가
    PostsModule, // BlogStatsService를 사용하기 위해 PostsModule 임포트
    FilesModule, // CdnService를 사용하기 위해 FilesModule 임포트
  ],
  controllers: [BlogsController, BlogStatsController],
  providers: [BlogsService],
  exports: [BlogsService],
})
export class BlogsModule {}
