import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogsService } from './blogs.service';
import { BlogsController } from './blogs.controller';
import { Blog } from './entities/blog.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Blog]),
    UsersModule
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService]
})
export class BlogsModule {}