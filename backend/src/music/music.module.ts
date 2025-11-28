import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Music } from './entities/music.entity';
import { MusicService, MusicMetadataService } from './services';
import { MusicController, AdminMusicController } from './controllers';
import { CacheModule } from '../cache/cache.module';
import { FilesModule } from '../files/files.module';

/**
 * 음악 모듈
 * BGM 플레이어 기능을 위한 음악 파일 관리
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Music]),
    ConfigModule,
    CacheModule,
    FilesModule, // S3Service 사용을 위해 추가
  ],
  controllers: [MusicController, AdminMusicController],
  providers: [MusicService, MusicMetadataService],
  exports: [MusicService],
})
export class MusicModule {}
