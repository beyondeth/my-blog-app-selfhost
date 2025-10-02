import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './entities/bookmark.entity';
import { Post } from '../posts/entities/post.entity';

/**
 * 북마크 모듈
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Bookmark, Post]),
  ],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],  // 다른 모듈에서 사용할 수 있도록 export
})
export class BookmarksModule {}