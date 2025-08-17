import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { UserDeletionService } from './services/user-deletion.service';
import { File } from '../files/entities/file.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, File]),
    forwardRef(() => EmailModule),
  ],
  providers: [UsersService, UserDeletionService],
  controllers: [UsersController],
  exports: [UsersService, UserDeletionService],
})
export class UsersModule {} 