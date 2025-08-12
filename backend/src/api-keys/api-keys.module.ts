import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKey } from './entities/api-key.entity';
import { Blog } from '../blogs/entities/blog.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, Blog])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}