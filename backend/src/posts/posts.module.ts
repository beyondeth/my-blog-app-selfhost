import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './entities/post.entity';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { TagsModule } from '../tags/tags.module';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';
import { ViewCountService } from './view-count.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, File, Blog]), UsersModule, FilesModule, TagsModule],
  providers: [PostsService, MarkdownRendererService, ViewCountService],
  controllers: [PostsController],
  exports: [PostsService, ViewCountService],
})
export class PostsModule {} 