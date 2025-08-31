import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserDeletionService } from './services/user-deletion.service';
import { UserDeletionDebugService } from './services/user-deletion-debug.service';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
// import { ApiKey } from '../auth/entities/api-key.entity'; // API Key entity가 없으면 주석처리
import { Report } from '../reports/entities/report.entity';
import { Follow } from '../follows/entities/follow.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, File, Blog, Post, Comment, Report, Follow]),
    forwardRef(() => EmailModule),
  ],
  providers: [UsersService, UserDeletionService, UserDeletionDebugService],
  controllers: [UsersController],
  exports: [UsersService, UserDeletionService, UserDeletionDebugService],
})
export class UsersModule {} 