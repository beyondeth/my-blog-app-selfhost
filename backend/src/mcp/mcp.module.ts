import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PostsModule } from '../posts/posts.module';
import { BlogsModule } from '../blogs/blogs.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Blog, User]),
    ApiKeysModule,
    PostsModule,
    BlogsModule,
  ],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}