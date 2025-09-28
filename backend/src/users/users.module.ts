import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserIdentity } from './entities/user-identity.entity';
import { UserDeletionService } from './services/user-deletion.service';
import { UserDeletionDebugService } from './services/user-deletion-debug.service';
import { IdentityService } from './services/identity.service';
import { File } from '../files/entities/file.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Report } from '../reports/entities/report.entity';
import { Follow } from '../follows/entities/follow.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserIdentity, File, Blog, Post, Comment, Report, Follow]),
    forwardRef(() => EmailModule),
  ],
  providers: [UsersService, UserDeletionService, UserDeletionDebugService, IdentityService],
  controllers: [UsersController],
  exports: [UsersService, UserDeletionService, UserDeletionDebugService, IdentityService],
})
export class UsersModule {} 