import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { Post } from './entities/post.entity';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, File, Blog]), UsersModule, FilesModule],
  providers: [PostsService, MarkdownRendererService],
  controllers: [PostsController],
  exports: [PostsService],
})
export class PostsModule {} 