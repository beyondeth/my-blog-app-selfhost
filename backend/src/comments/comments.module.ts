import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import { FilesModule } from '../files/files.module';
import { CacheModule } from '../cache/cache.module';
import { MetricsModule } from '../metrics/metrics.module';
import { CommonModule } from '../common/common.module';

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
  providers: [CommentsService],
  controllers: [CommentsController],
  exports: [CommentsService],
})
export class CommentsModule {} 